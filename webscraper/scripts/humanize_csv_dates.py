#!/usr/bin/env python3
"""humanize_csv_dates.py

Convert ISO date strings (YYYY-MM-DD) in a CSV column into human-readable form
(e.g. 2025-12-11 -> December 11, 2025) while preserving other rows / columns.

Features:
- In-place or new-file writing with backup option.
- Auto-detect column name (default 'date').
- Only transforms values strictly matching ^\d{4}-\d{2}-\d{2}$.
- Skips already human-readable date strings (those containing a month name) and empty values.
- Provides a summary of conversions.

Usage:
  python scripts/humanize_csv_dates.py games.csv --backup
  python scripts/humanize_csv_dates.py games.csv -o games_human.csv
  python scripts/humanize_csv_dates.py games.csv --column event_date

Exit codes:
 0 success
 1 argument / usage error
 2 IO error
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from datetime import datetime
from typing import List

ISO_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Humanize ISO dates in a CSV column.")
    p.add_argument("input", help="Input CSV file path")
    p.add_argument("-o", "--output", help="Output CSV file path (default: overwrite input)")
    p.add_argument("--column", default="date", help="Column containing dates to humanize (default: date)")
    p.add_argument("--backup", action="store_true", help="Create a .bak backup when overwriting input")
    p.add_argument("--encoding", default="utf-8", help="File encoding (default: utf-8)")
    p.add_argument("--dry-run", action="store_true", help="Show planned changes without writing output")
    p.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    return p.parse_args()


def humanize(iso_str: str) -> str:
    m = ISO_RE.match(iso_str.strip())
    if not m:
        return iso_str
    year, month, day = m.groups()
    try:
        dt = datetime(int(year), int(month), int(day))
    except ValueError:
        return iso_str
    return f"{MONTH_NAMES[dt.month - 1]} {dt.day}, {dt.year}"


def main():
    args = parse_args()
    input_path = args.input
    output_path = args.output or input_path

    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(2)

    # Read entire CSV
    try:
        with open(input_path, "r", encoding=args.encoding, newline="") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            fieldnames = reader.fieldnames or []
    except OSError as e:
        print(f"ERROR: Failed to read input CSV: {e}", file=sys.stderr)
        sys.exit(2)

    if args.column not in fieldnames:
        print(f"ERROR: Column '{args.column}' not found in CSV header", file=sys.stderr)
        sys.exit(1)

    changed = 0
    total = 0
    for row in rows:
        val = row.get(args.column, "")
        if not val:
            continue
        total += 1
        if ISO_RE.match(val.strip()):
            new_val = humanize(val)
            if new_val != val:
                row[args.column] = new_val
                changed += 1

    if args.dry_run:
        print(f"DRY-RUN: {changed} of {total} date values would change.")
        if changed and args.verbose:
            # Show first 5 examples
            shown = 0
            for r in rows:
                old = r.get(args.column, "")
                if ISO_RE.match(old):
                    print(f"  {old} -> {humanize(old)}")
                    shown += 1
                    if shown >= 5:
                        break
        return

    # Backup if overwriting input
    if output_path == input_path and args.backup:
        bak_path = input_path + ".bak"
        try:
            with open(bak_path, "w", encoding=args.encoding, newline="") as bf:
                with open(input_path, "r", encoding=args.encoding, newline="") as inf:
                    bf.write(inf.read())
            if args.verbose:
                print(f"Backup written: {bak_path}")
        except OSError as e:
            print(f"ERROR: Failed to create backup: {e}", file=sys.stderr)
            sys.exit(2)

    # Write output
    try:
        with open(output_path, "w", encoding=args.encoding, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    except OSError as e:
        print(f"ERROR: Failed to write output CSV: {e}", file=sys.stderr)
        sys.exit(2)

    print(f"Updated {changed} of {total} date values -> {output_path}")


if __name__ == "__main__":
    main()
