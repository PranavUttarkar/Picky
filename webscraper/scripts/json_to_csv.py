#!/usr/bin/env python3
"""
json_to_csv.py

Convert a JSON file containing an array of event/game records into a CSV file.
Ensures the `tags` field is a list. If `tags` is a string literal representation
of a Python list (e.g. "['performing-arts', 'campus']") it will be safely
converted using ast.literal_eval. If it is a plain comma-separated string it
will be split on commas.

Features:
- Auto-detect and normalize tags to a Python list.
- Flexible output formatting for tags: joined with a separator (default ';') or JSON list.
- Dynamically determines CSV header as the union of all keys across records.
- Optional date normalization: copy/parse from a companion ISO field or parse common textual date formats.
- Non-scalar values (lists/dicts) besides tags are JSON-encoded for preservation.
- Optional overwrite protection (default: won't overwrite existing output unless --force).

Usage examples:
  python scripts/json_to_csv.py events.json
  python scripts/json_to_csv.py events.json -o events.csv
  python scripts/json_to_csv.py events.json --tags-format json -o events.csv
  python scripts/json_to_csv.py events.json --tags-sep '|' -o events.csv

Exit codes:
  0 success
  1 usage / argument errors
  2 file / IO errors
  3 JSON parse errors
"""
from __future__ import annotations

import argparse
import ast
import csv
import json
import os
import sys
from datetime import datetime
from typing import Any, Iterable, List, Dict, Optional
import re


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Convert JSON array of records to CSV with tag normalization.")
    p.add_argument("input", help="Path to input JSON file (array of objects)")
    p.add_argument("-o", "--output", help="Output CSV file path (default: same name with .csv)")
    p.add_argument("--tags-format", choices=["join", "json"], default="join", help="How to serialize tags field in CSV")
    p.add_argument("--tags-sep", default=";", help="Separator for tags when --tags-format=join (default: ';')")
    p.add_argument("--force", action="store_true", help="Overwrite existing output file if present")
    p.add_argument("--encoding", default="utf-8", help="File encoding for input/output (default: utf-8)")
    p.add_argument("--no-header-sort", action="store_true", help="Do not sort header keys (preserve discovery order)")
    # Tag / serialization options
    p.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    # Date normalization options
    p.add_argument("--normalize-date", action="store_true", help="Normalize date field using date_iso or parsing")
    p.add_argument("--date-field", default="date", help="Field name containing the human-readable date (default: date)")
    p.add_argument("--date-iso-field", default="date_iso", help="Field name containing ISO date (default: date_iso)")
    p.add_argument("--date-output-format", default="%Y-%m-%d", help="strftime format to output normalized date (default: %Y-%m-%d)")
    p.add_argument("--assume-year", type=int, default=None, help="Year to assume when parsing dates without a year (default: current year)")
    return p.parse_args()


def log(msg: str, *, verbose: bool):
    if verbose:
        print(msg, file=sys.stderr)


def load_json_records(path: str, *, encoding: str, verbose: bool) -> List[Dict[str, Any]]:
    try:
        with open(path, "r", encoding=encoding) as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Input file not found: {path}", file=sys.stderr)
        sys.exit(2)
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse JSON: {e}", file=sys.stderr)
        sys.exit(3)

    # Accept either a list or a dict whose first list value we can use (fallback convenience)
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        # Attempt to use the first value that is a list of dicts
        records = None
        for v in data.values():
            if isinstance(v, list) and all(isinstance(x, dict) for x in v):
                records = v
                log("Input root is object; using first list-of-dicts value as records", verbose=verbose)
                break
        if records is None:
            print("ERROR: JSON root is an object and no list-of-dicts value was found", file=sys.stderr)
            sys.exit(3)
    else:
        print("ERROR: JSON root must be an array or object containing an array", file=sys.stderr)
        sys.exit(3)

    # Ensure all records are dicts
    filtered: List[Dict[str, Any]] = []
    for idx, rec in enumerate(records):
        if not isinstance(rec, dict):
            log(f"Skipping non-object at index {idx}", verbose=verbose)
            continue
        filtered.append(rec)
    return filtered


def normalize_tags(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        # Ensure they are strings
        return [str(v) for v in value]
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        # Attempt safe literal eval for Python list syntax
        if (s.startswith("[") and s.endswith("]")) or (s.startswith("(") and s.endswith(")")):
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, (list, tuple)):
                    return [str(v) for v in parsed]
            except Exception:
                # fall back to splitting
                pass
        # Fallback: split on commas
        if "," in s:
            return [part.strip() for part in s.split(",") if part.strip()]
        # Single tag
        return [s]
    # Other types (e.g., set, tuple, int) -> coerce
    if isinstance(value, (set, tuple)):
        return [str(v) for v in value]
    return [str(value)]


def determine_header(records: Iterable[Dict[str, Any]], *, sort: bool) -> List[str]:
    seen_order: List[str] = []
    seen_set = set()
    for rec in records:
        for k in rec.keys():
            if k not in seen_set:
                seen_set.add(k)
                seen_order.append(k)
    if sort:
        return sorted(seen_order)
    return seen_order


DATE_PATTERNS_WITH_YEAR = [
    "%B %d, %Y",    # October 5, 2025
    "%B %d %Y",     # October 5 2025
    "%b %d, %Y",    # Oct 5, 2025
    "%b %d %Y",     # Oct 5 2025
    "%Y-%m-%d",     # 2025-10-05
]

DATE_PATTERNS_NO_YEAR = [
    "%B %d",        # October 5
    "%b %d",        # Oct 5
]

ISO_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalize_date_value(rec: Dict[str, Any], *, date_field: str, date_iso_field: str,
                         out_fmt: str, assume_year: Optional[int], verbose: bool):
    """Normalize the record's date field in-place.

    Strategy:
    1. If date_iso_field exists and matches YYYY-MM-DD, parse that.
    2. Else attempt to parse current date_field value with year-aware patterns.
    3. If that fails and the string appears without a year, append assume_year/current year and parse with *_NO_YEAR patterns.
    4. On success, overwrite date_field with formatted string; otherwise leave original.
    """
    raw_iso = rec.get(date_iso_field)
    if isinstance(raw_iso, str) and ISO_REGEX.match(raw_iso):
        try:
            dt = datetime.strptime(raw_iso, "%Y-%m-%d")
            rec[date_field] = dt.strftime(out_fmt)
            return
        except Exception:
            pass  # fall back

    value = rec.get(date_field)
    if not isinstance(value, str) or not value.strip():
        return
    text = value.strip()

    # Try year-included patterns first
    for pattern in DATE_PATTERNS_WITH_YEAR:
        try:
            dt = datetime.strptime(text, pattern)
            rec[date_field] = dt.strftime(out_fmt)
            return
        except ValueError:
            continue

    # If string already contains a digit sequence of 4 (likely year) but failed above -> give up
    if re.search(r"\d{4}", text):
        return

    # Patterns without year: add assumed year
    year = assume_year or datetime.now().year
    augmented_variants = [f"{text}, {year}", f"{text} {year}"]
    for base in augmented_variants:
        for patt in [p.replace("%B %d", "%B %d, %Y").replace("%b %d", "%b %d, %Y") for p in DATE_PATTERNS_NO_YEAR]:
            try:
                dt = datetime.strptime(base, patt)
                rec[date_field] = dt.strftime(out_fmt)
                return
            except ValueError:
                continue
    if verbose:
        print(f"WARN: Could not normalize date '{text}'", file=sys.stderr)


def serialize_value(key: str, value: Any) -> Any:
    # Keep scalars as-is for CSV writer; convert complex types (other than tags) to JSON
    if key == "tags":
        # will be handled separately before calling this
        return value
    if isinstance(value, (str, int, float)) or value is None:
        return value
    return json.dumps(value, ensure_ascii=False)


def main():
    args = parse_args()
    input_path = args.input
    output_path = args.output or os.path.splitext(input_path)[0] + ".csv"

    if os.path.exists(output_path) and not args.force:
        print(f"ERROR: Output file {output_path} exists (use --force to overwrite)", file=sys.stderr)
        sys.exit(1)

    records = load_json_records(input_path, encoding=args.encoding, verbose=args.verbose)
    if not records:
        print("WARN: No records found; writing empty CSV with header 'tags' only", file=sys.stderr)

    # Normalize tags first
    for rec in records:
        rec["tags"] = normalize_tags(rec.get("tags"))

    # Optional date normalization
    if args.normalize_date:
        for rec in records:
            normalize_date_value(
                rec,
                date_field=args.date_field,
                date_iso_field=args.date_iso_field,
                out_fmt=args.date_output_format,
                assume_year=args.assume_year,
                verbose=args.verbose,
            )

    header = determine_header(records, sort=not args.no_header_sort)
    if "tags" not in header:
        header.append("tags")

    # Prepare rows
    out_rows = []
    for rec in records:
        row: Dict[str, Any] = {}
        for key in header:
            val = rec.get(key)
            if key == "tags":
                tags_list = rec.get("tags") or []
                if not isinstance(tags_list, list):  # safety
                    tags_list = normalize_tags(tags_list)
                if args.tags_format == "join":
                    row[key] = args.tags_sep.join(tags_list)
                else:  # json
                    row[key] = json.dumps(tags_list, ensure_ascii=False)
            else:
                row[key] = serialize_value(key, val)
        out_rows.append(row)

    # Write CSV
    try:
        with open(output_path, "w", encoding=args.encoding, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=header)
            writer.writeheader()
            writer.writerows(out_rows)
    except OSError as e:
        print(f"ERROR: Failed to write CSV: {e}", file=sys.stderr)
        sys.exit(2)

    print(f"Converted {len(out_rows)} records -> {output_path}")
    if args.verbose:
        print(f"Header columns: {header}", file=sys.stderr)
        sample = out_rows[0] if out_rows else {}
        print(f"Sample row keys: {list(sample.keys())}", file=sys.stderr)


if __name__ == "__main__":
    main()
