#!/usr/bin/env python3
"""clean_description_urls.py

Remove URL substrings from a description field in a JSON array (or dict containing
an array) OR from a CSV file. For JSON, edits are in-place (with optional backup)
unless an output file is specified. For CSV, writes a new file (or overwrite with backup).

URL detection: any token starting with http:// or https:// until first whitespace.

Examples:
  python scripts/clean_description_urls.py games.json --backup
  python scripts/clean_description_urls.py games.json -o games_clean.json
  python scripts/clean_description_urls.py games.csv --csv --backup -o games_clean.csv

Exit codes:
 0 success
 1 usage error
 2 IO error / parse error
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import csv
from typing import Any, List, Dict, Iterable

URL_RE = re.compile(r"https?://\S+")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Remove URLs from description fields in JSON or CSV data.")
    p.add_argument("input", help="Input JSON or CSV file path")
    p.add_argument("-o", "--output", help="Output file path (default: overwrite input)")
    p.add_argument("--field", default="description", help="Field/column name containing text to clean (default: description)")
    p.add_argument("--csv", action="store_true", help="Treat input as CSV (default: JSON)")
    p.add_argument("--backup", action="store_true", help="Create .bak backup when overwriting input")
    p.add_argument("--encoding", default="utf-8", help="File encoding (default: utf-8)")
    p.add_argument("--dry-run", action="store_true", help="Show what would change without writing output")
    p.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    return p.parse_args()


def log(msg: str, *, verbose: bool):
    if verbose:
        print(msg, file=sys.stderr)


def strip_urls(text: str) -> str:
    # Replace URLs with nothing, then collapse extra spaces
    cleaned = URL_RE.sub("", text)
    # Remove any leftover multiple spaces
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


# JSON processing

def load_json_records(path: str, encoding: str, verbose: bool) -> List[Dict[str, Any]]:
    try:
        with open(path, "r", encoding=encoding) as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERROR: Failed to read/parse JSON: {e}", file=sys.stderr)
        sys.exit(2)
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list) and all(isinstance(x, dict) for x in v):
                log("Using first list-of-dicts value in root object", verbose=verbose)
                return v
    print("ERROR: JSON root must be array or object containing an array of objects", file=sys.stderr)
    sys.exit(2)


def save_json_records(path: str, records: List[Dict[str, Any]], encoding: str):
    try:
        with open(path, "w", encoding=encoding) as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"ERROR: Failed to write JSON: {e}", file=sys.stderr)
        sys.exit(2)


# CSV processing

def load_csv(path: str, encoding: str):
    try:
        with open(path, "r", encoding=encoding, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            headers = reader.fieldnames or []
    except OSError as e:
        print(f"ERROR: Failed to read CSV: {e}", file=sys.stderr)
        sys.exit(2)
    return headers, rows


def save_csv(path: str, headers: List[str], rows: List[Dict[str, Any]], encoding: str):
    try:
        with open(path, "w", encoding=encoding, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
    except OSError as e:
        print(f"ERROR: Failed to write CSV: {e}", file=sys.stderr)
        sys.exit(2)


def backup_file(path: str, encoding: str):
    bak = path + ".bak"
    try:
        with open(bak, "w", encoding=encoding) as out_f, open(path, "r", encoding=encoding) as in_f:
            out_f.write(in_f.read())
        return bak
    except OSError as e:
        print(f"ERROR: Failed to create backup: {e}", file=sys.stderr)
        sys.exit(2)


def process_json(input_path: str, output_path: str, field: str, *, backup: bool, dry_run: bool, encoding: str, verbose: bool):
    records = load_json_records(input_path, encoding, verbose)
    changed = 0
    total = 0
    for rec in records:
        if field not in rec or not isinstance(rec[field], str):
            continue
        original = rec[field]
        total += 1
        cleaned = strip_urls(original)
        if cleaned != original:
            changed += 1
            if not dry_run:
                rec[field] = cleaned
    if dry_run:
        print(f"DRY-RUN(JSON): {changed} of {total} descriptions would change")
        return
    if output_path == input_path and backup:
        bak = backup_file(input_path, encoding)
        log(f"Backup written: {bak}", verbose=verbose)
    save_json_records(output_path, records, encoding)
    print(f"Updated {changed} of {total} descriptions -> {output_path}")


def process_csv(input_path: str, output_path: str, field: str, *, backup: bool, dry_run: bool, encoding: str, verbose: bool):
    headers, rows = load_csv(input_path, encoding)
    if field not in headers:
        print(f"ERROR: Column '{field}' not found in CSV", file=sys.stderr)
        sys.exit(1)
    changed = 0
    total = 0
    for row in rows:
        val = row.get(field, "")
        if not isinstance(val, str) or not val:
            continue
        total += 1
        cleaned = strip_urls(val)
        if cleaned != val:
            changed += 1
            if not dry_run:
                row[field] = cleaned
    if dry_run:
        print(f"DRY-RUN(CSV): {changed} of {total} descriptions would change")
        return
    if output_path == input_path and backup:
        bak = backup_file(input_path, encoding)
        log(f"Backup written: {bak}", verbose=verbose)
    save_csv(output_path, headers, rows, encoding)
    print(f"Updated {changed} of {total} descriptions -> {output_path}")


def main():
    args = parse_args()
    input_path = args.input
    output_path = args.output or input_path
    if not os.path.exists(input_path):
        print(f"ERROR: Input not found: {input_path}", file=sys.stderr)
        sys.exit(2)
    if args.csv:
        process_csv(input_path, output_path, args.field, backup=args.backup, dry_run=args.dry_run, encoding=args.encoding, verbose=args.verbose)
    else:
        process_json(input_path, output_path, args.field, backup=args.backup, dry_run=args.dry_run, encoding=args.encoding, verbose=args.verbose)


if __name__ == "__main__":
    main()
