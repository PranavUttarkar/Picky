import json
import ast
import os
import re
import sys
from typing import List, Dict

ROOT = os.path.dirname(os.path.dirname(__file__))
DEFAULT_IN = 'events.json'

KEYWORD_TAGS = [
    # Engineering-specific series and event types (more specific first)
    (r"\bmeloy\s*speaker\b", ["meloy-speaker", "talk"]),
    (r"\baggies?\s*invent\b", ["aggies-invent", "hackathon"]),
    (r"\btailgate\b", ["tailgate", "community"]),
    (r"\bbanquet\b", ["banquet", "celebration"]),
    (r"\b(info\s*session|informational|virtual\s*grad\s*preview)\b", ["info-session"]),
    (r"\b(career|resume|offers?\s*&\s*negotiations|my\s*first\b)\b", ["career"]),
    (r"\b(counselor\s*connect)\b", ["wellness", "community"]),
    (r"\bgo\s*grad\s*fair\b", ["grad-fair", "exhibition"]),
    (r"\b(trotter\s*prize|trotter\s*lecture)\b", ["trotter-lecture", "talk"]),
    (r"\b(art\s*competition)\b", ["competition", "exhibition"]),
    (r"\b(bush\s*school)\b", ["bush-school"]),
    (r"\b(chemistry)\b", ["chemistry"]),

    # OPAS-specific (performing arts presenter)
    (r"\bopas\b|\bopas\s*presents\b", ["opas", "performing-arts"]),

    # Performing arts / entertainment
    (r"\b(opas|performance|concert|choir|musical|orchestra|band|recital|theatre|theater|film)\b", ["performing-arts"]),
    (r"\b(choir|gospel)\b", ["music", "choir"]),
    (r"\b(mrs\.?\s*doubtfire)\b", ["theatre", "comedy"]),

    # Exhibitions / galleries / museums
    (r"\b(exhibit|exhibition|gallery|galleries|museum|art|prints|printmaking)\b", ["exhibition"]),
    (r"\b(printmaking|linocut)\b", ["workshop", "printmaking"]),

    # Science / STEM outreach
    (r"\b(physics|astronomy|demos?)\b", ["science-outreach"]),

    # Community / campus life
    (r"\b(downtown\s*bryan|first\s*friday|maroon\s*&?\s*white\s*night)\b", ["community"]),
    (r"\b(festival|fair)\b", ["festival"]),

    # Student life / memorials / deadlines
    (r"\b(silver\s*taps)\b", ["memorial"]),
    (r"\b(deadline|last\s*day\s*to\s*apply|verification\s*deadline)\b", ["deadline"]),

    # Locations (coarse and engineering venues)
    (r"\b(rudder\s*auditorium|rudder\s*complex|rudder\s*exhibit\s*hall)\b", ["campus"]),
    (r"\b(memorial\s*student\s*center|\bmsc\b)\b", ["campus", "msc"]),
    (r"\b(academic\s*building)\b", ["campus"]),
    (r"\b(zachry|zachry\s*engineering\s*education\s*complex|\bzach\b)\b", ["campus", "zachry"]),
    (r"\b(evans\s*library)\b", ["campus", "library"]),
    (r"\b(cavalry\s*court|hilton\s*hotel|stella\s*hotel)\b", ["hotel"]),
    (r"\b(the\s*gardens)\b", ["gardens"]),
    (r"\b(downtown\s*bryan)\b", ["downtown"]),
]

EXACT_TITLE_TAGS = [
    (r"^silver\s*taps$", ["memorial", "tradition"]),
]

TIME_TAGS = [
    (r"all\s*day", ["all-day"]),
]


def add_tags_from_text(tags: List[str], text: str, patterns: List):
    t = text.lower()
    for pat, pat_tags in patterns:
        if re.search(pat, t):
            for tg in pat_tags:
                if tg not in tags:
                    tags.append(tg)


def extract_tags(ev: Dict) -> List[str]:
    tags: List[str] = []
    title = (ev.get('title') or '').strip()
    desc = (ev.get('description') or '').strip()
    loc = (ev.get('location') or '').strip()
    time_val = (ev.get('time') or '').strip()

    # Exact title matches first
    add_tags_from_text(tags, title, EXACT_TITLE_TAGS)

    # Broad keyword tags from title+desc+location
    combo = ' '.join([title, desc, loc])
    add_tags_from_text(tags, combo, KEYWORD_TAGS)

    # Time-based tags
    add_tags_from_text(tags, time_val, TIME_TAGS)

    # Generic categories based on simple heuristics
    low = combo.lower()
    if 'workshop' in low and 'workshop' not in tags:
        tags.append('workshop')
    if 'gallery' in low and 'exhibition' not in tags:
        tags.append('exhibition')
    if 'all day' in (time_val or '').lower() and 'all-day' not in tags:
        tags.append('all-day')

    # Fallback: if nothing matched, try to add coarse tags from location
    if not tags and loc:
        if re.search(r"rudder|msc|academic building|zachry|campus", loc.lower()):
            tags.append('campus')
        if re.search(r"downtown", loc.lower()):
            tags.append('community')

    return tags


def main():
    # Allow optional filename argument
    filename = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IN
    in_path = os.path.join(ROOT, filename)
    bak_path = in_path + '.bak'

    if not os.path.exists(in_path):
        raise FileNotFoundError(in_path)

    with open(in_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError('events.json root is not a list')

    # Backup
    if not os.path.exists(bak_path):
        with open(bak_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    updated = []
    for ev in data:
        if not isinstance(ev, dict):
            updated.append(ev)
            continue
        # Convert stringified list in 'tags' field (e.g. "['a', 'b']") to real list if present
        if 'tags' in ev and isinstance(ev['tags'], str) and ev['tags'].strip().startswith('['):
            try:
                parsed = ast.literal_eval(ev['tags'])
                if isinstance(parsed, list):
                    ev['tags'] = parsed
            except Exception:
                # Leave as-is if parsing fails
                pass
        tags = extract_tags(ev)
        ev = ev.copy()
        # Replace URL value with tags array as requested
        ev['url'] = tags
        updated.append(ev)

    with open(in_path, 'w', encoding='utf-8') as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)

    print(f"Updated {len(updated)} events; backup saved to {bak_path}")


if __name__ == '__main__':
    main()
