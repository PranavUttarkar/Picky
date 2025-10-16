#!/usr/bin/env python3
"""
Tag Texas A&M athletics events in games.json (or another file) with sport + context tags.

- Reads a JSON list of game/event dicts
- Existing 'tags' field currently holds a URL; we preserve it as 'game_url'
- Writes back updating 'tags' to a list of derived tags (e.g. ['soccer','home','vs','sec'])
- Backs up original file to <name>.bak (only if no existing backup)

Usage:
  python scripts/tag_games.py games.json
  python scripts/tag_games.py games.json --dry-run

Tag heuristics:
  Sport: soccer, football, baseball, softball, basketball(men/women), volleyball, tennis, golf(men/women), cross-country, track-field, equestrian, swimming-diving
  Home/Away: 'vs' => home, 'at' => away (first occurrence near sport name)
  Tournament / context keywords: regional, championship, tournament, invitational, classic, showcase, scrimmage, exhibition, opener
  Conference hints: sec, ncaa

Extend SPORT_PATTERNS or CONTEXT_KEYWORDS to expand coverage.
"""
from __future__ import annotations
import argparse
import json
import os
import re
from typing import List, Dict, Any

SPORT_PATTERNS = [
    (r"soccer", "soccer"),
    (r"football", "football"),
    (r"baseball", "baseball"),
    (r"softball", "softball"),
    (r"women['’]s\s+basketball", "womens-basketball"),
    (r"men['’]s\s+basketball", "mens-basketball"),
    (r"basketball", "basketball"),  # fallback if gender not specified
    (r"volleyball", "volleyball"),
    (r"cross\s*country", "cross-country"),
    (r"women['’]s\s+golf", "womens-golf"),
    (r"men['’]s\s+golf", "mens-golf"),
    (r"golf", "golf"),
    (r"track\s*(and|&)\s*field|track", "track-field"),
    (r"equestrian", "equestrian"),
    (r"swimming\s*(and|&)\s*diving|diving", "swimming-diving"),
    (r"tennis", "tennis"),
]

CONTEXT_KEYWORDS = [
    (r"regional", "regional"),
    (r"super\s*regional", "super-regional"),
    (r"championship", "championship"),
    (r"tournament", "tournament"),
    (r"invitational", "invitational"),
    (r"classic", "classic"),
    (r"showcase", "showcase"),
    (r"matchplay", "matchplay"),
    (r"exhibition", "exhibition"),
    (r"scrimmage", "scrimmage"),
    (r"opener", "opener"),
]

CONFERENCE_KEYWORDS = [
    (r"\bsec\b", "sec"),
    (r"\bncaa\b", "ncaa"),
]

def detect_sport(title: str) -> List[str]:
    tags: List[str] = []
    for pat, label in SPORT_PATTERNS:
        if re.search(pat, title, flags=re.IGNORECASE):
            if label not in tags:
                tags.append(label)
    return tags


def detect_context(title: str) -> List[str]:
    tags: List[str] = []
    for pat, label in CONTEXT_KEYWORDS:
        if re.search(pat, title, flags=re.IGNORECASE):
            if label not in tags:
                tags.append(label)
    for pat, label in CONFERENCE_KEYWORDS:
        if re.search(pat, title, flags=re.IGNORECASE):
            if label not in tags:
                tags.append(label)
    return tags


def detect_home_away(title: str) -> List[str]:
    # Heuristic: 'vs' => home, 'at' => away. If both appear, first matched wins.
    t = title.lower()
    idx_vs = t.find(' vs ')
    idx_at = t.find(' at ')
    if idx_vs == -1 and t.startswith('vs '):
        idx_vs = 0
    if idx_at == -1 and t.startswith('at '):
        idx_at = 0
    if idx_vs != -1 and (idx_at == -1 or idx_vs < idx_at):
        return ['home']
    if idx_at != -1 and (idx_vs == -1 or idx_at < idx_vs):
        return ['away']
    return []


def build_tags(title: str) -> List[str]:
    title_norm = title.strip()
    tags: List[str] = []
    tags.extend(detect_sport(title_norm))
    tags.extend(detect_context(title_norm))
    tags.extend(detect_home_away(title_norm))
    # Deduplicate preserving order
    seen = set()
    deduped = []
    for tg in tags:
        if tg not in seen:
            seen.add(tg)
            deduped.append(tg)
    return deduped


def process(data: List[Dict[str, Any]]) -> int:
    changed = 0
    for ev in data:
        if not isinstance(ev, dict):
            continue
        title = ev.get('title') or ''
        orig_tags_field = ev.get('tags')
        # Preserve original URL if that 'tags' field is a URL string
        if isinstance(orig_tags_field, str) and orig_tags_field.startswith('http'):  # naive URL check
            if 'game_url' not in ev:
                ev['game_url'] = orig_tags_field
        new_tags = build_tags(title)
        ev['tags'] = new_tags
        changed += 1
    return changed


def main() -> int:
    ap = argparse.ArgumentParser(description="Tag athletics games with sport/context/home-away")
    ap.add_argument('file', nargs='?', default='games.json', help='Input JSON file (list)')
    ap.add_argument('--dry-run', action='store_true', help='Show summary without writing changes')
    args = ap.parse_args()

    path = args.file
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return 1
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, list):
        print('Input JSON must be a list of objects')
        return 2

    backup_path = path + '.bak'
    if not os.path.exists(backup_path):
        with open(backup_path, 'w', encoding='utf-8') as bf:
            json.dump(data, bf, ensure_ascii=False, indent=2)

    changed = process(data)

    if args.dry_run:
        print(f"[dry-run] Would tag {changed} records")
        return 0

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Tagged {changed} records; backup at {backup_path}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
