import json
import os
import re
from typing import List, Dict, Any


# Simple keyword -> image mapping for common Texas A&M sports.
# Update the URLs/paths to match your assets (can be external URLs or local paths).
SPORT_IMAGE_MAP: List[Dict[str, str]] = [
	{"pattern": r"\bsoccer\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-soccer.jpg"},
	{"pattern": r"\bcross\s*country\b|\bxc\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-womens-cross-country.jpg"},
	{"pattern": r"\bbaseball\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-baseball-batter.jpg"},
	{"pattern": r"\bfootball\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-football.jpg"},
	{"pattern": r"\bgolf\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-golf.jpg"},
	{"pattern": r"\bvolleyball\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-volleyball.jpg"},
	{"pattern": r"\bswimming(\s*and\s*diving)?\b|\bdiving\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-men-swimming.jpg"},
	{"pattern": r"\bequestrian\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-women-equestrian.jpg"},
	{"pattern": r"\bsoftball\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-softball-batter-hits.jpeg"},
	{"pattern": r"\bbasketball\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-mens-basketball.jpg"},
	{"pattern": r"\btennis\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-mens-tennis.jpg"},
	{"pattern": r"\btrack(\s*&\s*|\s*and\s*)field\b|\btrack\b|\bfield\b", "image": "https://www.tamu.edu/_files/images/athletics/tamu-men-track-field-hurdles.jpg"},
]

DEFAULT_IMAGE = "https://yt3.googleusercontent.com/Q3NQBQf8hqKI8bjw4yPDvvp6E2LQgD1O4nXQwva47SuG0Pwm2_YYHc9WJZ5YHFGQYE52IejpBQ=s900-c-k-c0x00ffffff-no-rj"


def choose_image(title: str) -> str:
	"""Return an image URL based on the title keywords. First match wins."""
	t = (title or "").strip()
	if not t:
		return DEFAULT_IMAGE
	for rule in SPORT_IMAGE_MAP:
		pat = rule.get("pattern")
		img = rule.get("image")
		if not pat or not img:
			continue
		try:
			if re.search(pat, t, flags=re.IGNORECASE):
				return img
		except re.error:
			# Skip invalid patterns silently
			continue
	return DEFAULT_IMAGE


def main(path: str = "games.json", only_if_missing: bool = True) -> None:
	if not os.path.exists(path):
		raise FileNotFoundError(path)

	with open(path, "r", encoding="utf-8") as f:
		data = json.load(f)
	if not isinstance(data, list):
		raise ValueError("Input JSON must be a list of objects")

	# Backup once
	bak_path = path + ".bak"
	if not os.path.exists(bak_path):
		with open(bak_path, "w", encoding="utf-8") as f:
			json.dump(data, f, ensure_ascii=False, indent=2)

	updated = 0
	for item in data:
		if not isinstance(item, dict):
			continue
		title = item.get("title") or ""
		current = (item.get("image_url") or "").strip()
		if only_if_missing and current:
			continue
		new_img = choose_image(title)
		if new_img and new_img != current:
			item["image_url"] = new_img
			updated += 1

	with open(path, "w", encoding="utf-8") as f:
		json.dump(data, f, ensure_ascii=False, indent=2)

	print(f"Updated {updated} items; backup at {bak_path}")


if __name__ == "main__":
	# If accidentally executed with a typo, do nothing
	pass

# Execute when run directly
if __name__ == "__main__":
	# Edit games.json in-place; set only_if_missing=False to overwrite any existing images
	main(path="games.json", only_if_missing=False)
    