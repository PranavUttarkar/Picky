#!/usr/bin/env python3
"""pipeline_convert.py

Unified pipeline to transform a JSON array (events/games) into a cleaned CSV.
Operations (optional & configurable):
  1. Strip URLs from a text field (default: description).
    2. Normalize tags to a list and serialize as joined, JSON, or brace format.
  3. Normalize date field using an ISO companion or by parsing formats.
  4. Humanize date field into 'Month D, YYYY' (optional) while retaining a separate ISO column.
  5. Write CSV with deterministic header ordering.

This script consolidates functionality from:
  - json_to_csv.py
  - clean_description_urls.py
  - humanize_csv_dates.py

Examples:
  python scripts/pipeline_convert.py games.json -o games_pipeline.csv \
      --strip-urls --normalize-date --humanize-date

  python scripts/pipeline_convert.py events.json --tags-format json \
      --strip-urls --normalize-date --date-output-format %Y-%m-%d

  python scripts/pipeline_convert.py games.json --no-humanize-date \
      --normalize-date --tags-sep '|' --force

  # Export aligned to events table schema (title, description, image_url, date_time, location, tags, rsvp_url, created_by, image_urls)
  python scripts/pipeline_convert.py games.json -o games_events_import.csv \
      --strip-urls --normalize-date --no-humanize-date --events-schema --tags-format json

Exit codes:
  0 Success
  1 Argument/usage error
  2 IO error
  3 JSON parse error
"""
from __future__ import annotations

import argparse
import ast
import csv
import json
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

ISO_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"https?://\S+")

DATE_PATTERNS_WITH_YEAR = [
    "%B %d, %Y",
    "%B %d %Y",
    "%b %d, %Y",
    "%b %d %Y",
    "%Y-%m-%d",
]
DATE_PATTERNS_NO_YEAR = ["%B %d", "%b %d"]

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Unified JSON -> CSV cleanup pipeline.")
    p.add_argument("input", help="Input JSON file (array or object containing array)")
    p.add_argument("-o", "--output", help="Output CSV (default: input base name + _pipeline.csv)")

    # URL strip
    p.add_argument("--strip-urls", action="store_true", help="Strip URLs from description/text field before output")
    p.add_argument("--text-field", default="description", help="Field to clean URLs from (default: description)")

    # Tags
    p.add_argument("--tags-format", choices=["join", "json", "braces"], default="join", help="Serialize tags field as joined string, JSON list, or brace format {t1,t2}")
    p.add_argument("--tags-sep", default=";", help="Separator when --tags-format=join (default: ';')")
    p.add_argument("--tags-field", default="tags", help="Name of tags field in input (default: tags)")

    # Date normalization / humanization
    p.add_argument("--normalize-date", action="store_true", help="Normalize date using ISO or parsing")
    p.add_argument("--date-field", default="date", help="Human-readable date field (default: date)")
    p.add_argument("--date-iso-field", default="date_iso", help="ISO date companion field (default: date_iso)")
    p.add_argument("--date-output-format", default="%Y-%m-%d", help="Normalized date output format (default: %Y-%m-%d)")
    p.add_argument("--assume-year", type=int, default=None, help="Assume year for dates missing year (default: current year)")
    p.add_argument("--humanize-date", dest="humanize_date", action="store_true", help="Humanize date field after normalization")
    p.add_argument("--no-humanize-date", dest="humanize_date", action="store_false", help="Disable humanization step")
    p.set_defaults(humanize_date=True)
    p.add_argument("--humanize-format", default="{month} {day}, {year}", help="Template for human date (default: '{month} {day}, {year}')")
    p.add_argument("--keep-iso-date", action="store_true", help="Retain normalized ISO form in a separate column (date_iso_norm)")
    p.add_argument("--events-schema", action="store_true", help="Output columns matching events table schema (title,description,image_url,date_time,location,tags,rsvp_url,created_by,image_urls)")
    p.add_argument("--default-time", default="00:00", help="Fallback HH:MM (24h) if no time field present when building date_time (default: 00:00)")
    p.add_argument("--timezone", default="UTC", help="Timezone suffix to append when constructing date_time if input lacks tz (default: UTC)")
    # Handling missing date_time after synthesis
    p.add_argument("--drop-missing-date-time", action="store_true", help="Drop records where date_time cannot be constructed (prevents empty timestamp errors)")
    p.add_argument("--fallback-date-time", default=None, help="Fallback full timestamp (e.g. '2025-01-01 00:00:00 UTC') if date_time cannot be built and not dropping")
    p.add_argument(
        "--quote-array-elements",
        action="store_true",
        help="Wrap each tag element in double quotes for Postgres array parsing (example: {\"tag1\",\"tag2\"})"
    )
    p.add_argument("--sport-rsvp-mode", choices=["off", "override", "fill"], default="override", help="Control sport-based RSVP URL mapping: off (disable), override (replace any existing), fill (only if missing) (default: override)")
    p.add_argument("--sport-rsvp-prefix", default="https://www.tamu.edu/athletics/", help="Base prefix for generated sport RSVP URLs (default: https://www.tamu.edu/athletics/)")
    p.add_argument("--sport-rsvp-map", default=None, help="Optional JSON file with {sport: path_or_full_url}. If value starts with http it is used verbatim; else joined to prefix.")

    # Misc / output
    p.add_argument("--force", action="store_true", help="Overwrite output if exists")
    p.add_argument("--encoding", default="utf-8", help="File encoding")
    p.add_argument("--no-header-sort", action="store_true", help="Do not sort header keys")
    p.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")

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
        print(f"ERROR: JSON parse error: {e}", file=sys.stderr)
        sys.exit(3)

    if isinstance(data, list):
        recs = data
    elif isinstance(data, dict):
        recs = None
        for v in data.values():
            if isinstance(v, list) and all(isinstance(x, dict) for x in v):
                recs = v
                log("Using first list-of-dicts value in root object", verbose=verbose)
                break
        if recs is None:
            print("ERROR: No list-of-dicts found in root object", file=sys.stderr)
            sys.exit(3)
    else:
        print("ERROR: Root must be list or object containing list", file=sys.stderr)
        sys.exit(3)

    # Filter only dict items
    out: List[Dict[str, Any]] = []
    for idx, r in enumerate(recs):
        if isinstance(r, dict):
            out.append(r)
        else:
            log(f"Skipping non-object at index {idx}", verbose=verbose)
    return out


def strip_urls(text: str) -> str:
    cleaned = URL_RE.sub("", text)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def normalize_tags(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        if (s.startswith("[") and s.endswith("]")) or (s.startswith("(") and s.endswith(")")):
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, (list, tuple)):
                    return [str(v) for v in parsed]
            except Exception:
                pass
        if "," in s:
            return [part.strip() for part in s.split(",") if part.strip()]
        return [s]
    if isinstance(value, (set, tuple)):
        return [str(v) for v in value]
    return [str(value)]


def normalize_date_value(rec: Dict[str, Any], *, date_field: str, date_iso_field: str, out_fmt: str,
                         assume_year: Optional[int], verbose: bool) -> Optional[str]:
    raw_iso = rec.get(date_iso_field)
    if isinstance(raw_iso, str) and ISO_REGEX.match(raw_iso):
        try:
            dt = datetime.strptime(raw_iso, "%Y-%m-%d")
            rec[date_field] = dt.strftime(out_fmt)
            return rec[date_field]
        except Exception:
            pass
    value = rec.get(date_field)
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    for pattern in DATE_PATTERNS_WITH_YEAR:
        try:
            dt = datetime.strptime(text, pattern)
            rec[date_field] = dt.strftime(out_fmt)
            return rec[date_field]
        except ValueError:
            continue
    if re.search(r"\d{4}", text):
        return None
    year = assume_year or datetime.now().year
    augmented = [f"{text}, {year}", f"{text} {year}"]
    for base in augmented:
        for patt in ["%B %d, %Y", "%b %d, %Y"]:
            try:
                dt = datetime.strptime(base, patt)
                rec[date_field] = dt.strftime(out_fmt)
                return rec[date_field]
            except ValueError:
                continue
    if verbose:
        log(f"WARN: Could not normalize date '{text}'", verbose=verbose)
    return None


def humanize_date_str(iso_str: str, template: str) -> str:
    if not ISO_REGEX.match(iso_str):
        return iso_str
    try:
        dt = datetime.strptime(iso_str, "%Y-%m-%d")
    except ValueError:
        return iso_str
    return template.format(month=MONTH_NAMES[dt.month - 1], day=dt.day, year=dt.year)


def determine_header(records: Iterable[Dict[str, Any]], *, sort: bool) -> List[str]:
    seen_order: List[str] = []
    seen_set = set()
    for rec in records:
        for k in rec.keys():
            if k not in seen_set:
                seen_set.add(k)
                seen_order.append(k)
    return sorted(seen_order) if sort else seen_order


def serialize_value(key: str, val: Any) -> Any:
    if isinstance(val, (str, int, float)) or val is None:
        return val
    return json.dumps(val, ensure_ascii=False)


def build_date_time(date_str: Optional[str], time_str: Optional[str], *, tz: str, default_time: str) -> Optional[str]:
    if not date_str:
        return None
    # date_str may be humanized or ISO. Prefer ISO if matches pattern.
    iso_candidate = None
    if ISO_REGEX.match(date_str):
        iso_candidate = date_str
    else:
        # Attempt parse common human formats
        for fmt in ("%B %d, %Y", "%b %d, %Y"):
            try:
                dt = datetime.strptime(date_str, fmt)
                iso_candidate = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
    if not iso_candidate:
        return None
    raw_time = (time_str or default_time).strip()
    # Normalize time (handles 'All day', blank, or times like '6:30pm')
    if not raw_time or raw_time.lower() == 'all day':
        raw_time = default_time
    # Parse 12h formats with am/pm
    tm_iso = None
    try:
        if re.search(r"am|pm", raw_time.lower()):
            tm_iso = datetime.strptime(raw_time.lower().replace(' ', ''), "%I:%M%p").strftime("%H:%M")
        else:
            # maybe HH:MM already
            datetime.strptime(raw_time, "%H:%M")
            tm_iso = raw_time
    except Exception:
        # Remove trailing missing minutes e.g. '7pm'
        m = re.match(r"^(\d{1,2})(am|pm)$", raw_time.lower())
        if m:
            try:
                tm_iso = datetime.strptime(raw_time.lower(), "%I%p").strftime("%H:%M")
            except Exception:
                tm_iso = default_time
        else:
            tm_iso = default_time
    return f"{iso_candidate} {tm_iso}:00 {tz}"


def main():
    args = parse_args()
    input_path = args.input
    output_path = args.output or os.path.splitext(input_path)[0] + "_pipeline.csv"

    if os.path.exists(output_path) and not args.force:
        print(f"ERROR: Output exists: {output_path} (use --force)", file=sys.stderr)
        sys.exit(1)

    records = load_json_records(input_path, encoding=args.encoding, verbose=args.verbose)
    if not records:
        print("WARN: No records found", file=sys.stderr)

    # Counters
    url_changed = 0
    tag_converted = 0
    date_normalized = 0
    missing_date_time = 0

    # Process each record
    for rec in records:
        # Strip URLs
        if args.strip_urls and args.text_field in rec and isinstance(rec[args.text_field], str):
            original = rec[args.text_field]
            cleaned = strip_urls(original)
            if cleaned != original:
                rec[args.text_field] = cleaned
                url_changed += 1

        # Normalize tags
        if args.tags_field in rec:
            before = rec[args.tags_field]
            norm = normalize_tags(before)
            if norm != before:
                tag_converted += 1
            rec[args.tags_field] = norm

        # Date normalization
        if args.normalize_date:
            prev = rec.get(args.date_field)
            iso_before = rec.get(args.date_field)
            normalized = normalize_date_value(
                rec,
                date_field=args.date_field,
                date_iso_field=args.date_iso_field,
                out_fmt=args.date_output_format,
                assume_year=args.assume_year,
                verbose=args.verbose,
            )
            if normalized and normalized != iso_before:
                date_normalized += 1
            # Preserve ISO norm copy if requested
            if args.keep_iso_date and normalized:
                rec["date_iso_norm"] = rec[args.date_field]

    # Humanize date (after normalization) if requested
    if args.humanize_date:
        for rec in records:
            val = rec.get(args.date_field)
            if isinstance(val, str) and ISO_REGEX.match(val):
                human = humanize_date_str(val, args.humanize_format)
                rec[args.date_field] = human

    if args.events_schema:
        # Fixed column order for DB import
        header = [
            "title",
            "description",
            "image_url",
            "date_time",
            "location",
            "tags",
            "rsvp_url",
            "created_by",
            "image_urls",
        ]

        # Load sport RSVP mapping (used to derive generic sport landing RSVP URLs)
        default_sport_map = {
            "football": "https://12thmanfoundation.evenue.net/events/FH",
            "soccer": "https://12thmanfoundation.evenue.net/events/SH",
            "baseball": "https://12thmanfoundation.evenue.net/events/BH",
            "softball": "https://12thmanfoundation.evenue.net/events/SO",
            "volleyball": "https://12thmanfoundation.evenue.net/list/VB",
            "basketball": "https://12thmanfoundation.evenue.net/events/MBS",
            "mens-basketball": "https://12thmanfoundation.evenue.net/events/MB",
            "womens-basketball": "https://12thmanfoundation.evenue.net/list/WB",
            "mens-golf": "https://12thmanfoundation.evenue.net/events/MG",
            "womens-golf": "https://12thmanfoundation.evenue.net/events/WG",
            "golf": "https://12thmanfoundation.evenue.net/events/G",
            "tennis": "https://12thmanfoundation.evenue.net/events/T",
            "equestrian": "https://12thmanfoundation.evenue.net/events/EQ",
            "cross-country": "https://12thmanfoundation.evenue.net/events/CC",
            "swimming-diving": "https://12thmanfoundation.evenue.net/events/SD",
        }
        # External override map
        if args.sport_rsvp_map:
            try:
                with open(args.sport_rsvp_map, 'r', encoding=args.encoding) as mf:
                    ext_map = json.load(mf)
                if isinstance(ext_map, dict):
                    default_sport_map.update({str(k): str(v) for k, v in ext_map.items()})
            except Exception as e:
                log(f"WARN: Failed to load sport RSVP map {args.sport_rsvp_map}: {e}", verbose=args.verbose)

        def sport_from(title: Optional[str], tags: List[str]) -> Optional[str]:
            """Infer sport key from title or tags.

            Ensures that 'mens-golf' / 'womens-golf' take precedence over generic 'golf'.
            The generic 'golf' will only be used if neither specific variant appears
            in title nor tags.
            """
            candidates: List[str] = []
            # Add tag-derived candidates first (preserve order)
            if tags:
                candidates.extend(tags)
            # Title keyword detection
            if title:
                lower = title.lower()
                for key in default_sport_map.keys():
                    if key in lower and key not in candidates:
                        candidates.append(key)
            # Normalize ordering: dedupe preserving first occurrence
            deduped = list(dict.fromkeys(candidates))
            # If generic 'golf' appears along with mens-golf or womens-golf, drop the generic
            if 'golf' in deduped and any(s in deduped for s in ('mens-golf', 'womens-golf')):
                deduped = [c for c in deduped if c != 'golf']
            # Now prioritize by length (more specific keys tend to be longer)
            for c in sorted(deduped, key=len, reverse=True):
                if c in default_sport_map:
                    return c
            return None

        def build_sport_url(sport: str) -> str:
            target = default_sport_map.get(sport, sport)
            if target.startswith('http://') or target.startswith('https://'):
                return target
            base = args.sport_rsvp_prefix
            if not base.endswith('/'):
                base += '/'
            return base + target.strip('/') + '/'
        out_rows: List[Dict[str, Any]] = []
        for rec in records:
            title = rec.get("title")
            desc = rec.get(args.text_field) or rec.get("description")
            image_url = rec.get("image_url")
            # Build date_time from normalized date (prefer date_iso_norm/date_iso) and time field
            date_source = rec.get("date_iso_norm") or rec.get(args.date_iso_field) or rec.get(args.date_field)
            date_time = build_date_time(date_source, rec.get("time"), tz=args.timezone, default_time=args.default_time)
            location = rec.get("location")
            tags_list = rec.get(args.tags_field) if isinstance(rec.get(args.tags_field), list) else normalize_tags(rec.get(args.tags_field))
            existing_rsvp = rec.get("game_url") or rec.get("url")
            chosen_sport = sport_from(title, tags_list)
            rsvp_url = existing_rsvp
            if args.sport_rsvp_mode != 'off' and chosen_sport:
                sport_link = build_sport_url(chosen_sport)
                if args.sport_rsvp_mode == 'override':
                    rsvp_url = sport_link
                elif args.sport_rsvp_mode == 'fill' and not existing_rsvp:
                    rsvp_url = sport_link
            if tags_list:
                # Escape internal quotes and optionally wrap elements
                esc = [t.replace('"', '\\"') for t in tags_list]
                if args.quote_array_elements:
                    safe_tags = [f'"{e}"' for e in esc]
                else:
                    safe_tags = esc
                tags_cell = '{' + ','.join(safe_tags) + '}'
            else:
                tags_cell = '{}'  # empty array
            # Handle missing date_time
            if not date_time:
                missing_date_time += 1
                if args.drop_missing_date_time:
                    continue  # skip this record entirely
                if args.fallback_date_time:
                    date_time = args.fallback_date_time.strip()
                else:
                    # Last resort: use today's date with default time to avoid blank
                    try:
                        today = datetime.utcnow().strftime('%Y-%m-%d')
                        date_time = f"{today} {args.default_time}:00 {args.timezone}"
                    except Exception:
                        date_time = f"1970-01-01 00:00:00 {args.timezone}"
            created_by = ''  # left blank for now
            image_urls = ''  # could derive a small gallery later
            out_rows.append({
                "title": title,
                "description": desc,
                "image_url": image_url,
                "date_time": date_time,
                "location": location,
                "tags": tags_cell,
                "rsvp_url": rsvp_url,
                "created_by": created_by or None,
                "image_urls": image_urls or None,
            })
    else:
        # Determine header and finalize tags serialization
        header = determine_header(records, sort=not args.no_header_sort)
        if args.tags_field not in header:
            header.append(args.tags_field)
        out_rows = []
        for rec in records:
            row: Dict[str, Any] = {}
            for key in header:
                val = rec.get(key)
                if key == args.tags_field:
                    tags_list = val if isinstance(val, list) else normalize_tags(val)
                    if args.tags_format == "join":
                        row[key] = args.tags_sep.join(tags_list)
                    elif args.tags_format == "json":
                        row[key] = json.dumps(tags_list, ensure_ascii=False)
                    else:  # braces
                        row[key] = "{" + ",".join(tags_list) + "}"
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

    print(f"Pipeline wrote {len(out_rows)} records -> {output_path}")
    if args.verbose:
        print(f"URL cleaned: {url_changed}; tags normalized: {tag_converted}; dates normalized: {date_normalized}; missing date_time handled: {missing_date_time}", file=sys.stderr)
        print(f"Header: {header}", file=sys.stderr)


if __name__ == "__main__":
    main()
