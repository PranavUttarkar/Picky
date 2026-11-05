"""Import upcoming Texas A&M calendar and Get Involved events into Supabase."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from datetime import date, datetime, time as day_time, timedelta
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

TZ = ZoneInfo("America/Chicago")
SOURCES = {
    "tamu_calendar": "https://calendar.tamu.edu/all",
    "tamu_getinvolved": "https://getinvolved.tamu.edu/events",
}
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def text(node: Any) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)) if node else ""


def fetch(url: str) -> BeautifulSoup:
    response = SESSION.get(url, timeout=30)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def abs_url(url: str | None, base: str) -> str | None:
    if not url:
        return None
    return urljoin(base, url.strip())


def walk_jsonld(value: Any):
    if isinstance(value, list):
        for item in value:
            yield from walk_jsonld(item)
    elif isinstance(value, dict):
        if "@graph" in value:
            yield from walk_jsonld(value["@graph"])
        yield value


def jsonld_event(soup: BeautifulSoup) -> dict[str, Any]:
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.string or script.get_text())
        except (json.JSONDecodeError, TypeError):
            continue
        for item in walk_jsonld(payload):
            kind = item.get("@type", [])
            kinds = [kind] if isinstance(kind, str) else kind
            if any("event" in str(k).lower() for k in kinds):
                return item
    return {}


def meta(soup: BeautifulSoup, *names: str) -> str | None:
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def parse_datetime(value: Any, *, default_date: date | None = None) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, day_time.min)
    elif value:
        try:
            parsed = date_parser.parse(str(value), fuzzy=True, default=datetime.combine(default_date or date.today(), day_time.min))
        except (ValueError, OverflowError, TypeError):
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ)
    return parsed.astimezone(TZ)


def image_value(item: dict[str, Any], soup: BeautifulSoup, base: str) -> str | None:
    image = item.get("image")
    if isinstance(image, list):
        image = image[0] if image else None
    if isinstance(image, dict):
        image = image.get("url")
    return abs_url(str(image), base) if image else abs_url(meta(soup, "og:image", "twitter:image"), base)


def normalize_identity_part(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", " ", ascii_text).strip()


def canonical_identity(record: dict[str, Any]) -> tuple[str, str, str]:
    start = parse_datetime(record["date_time"])
    if not start:
        raise ValueError(f"Event has an invalid start time: {record.get('title', '')}")
    return (
        normalize_identity_part(record.get("title")),
        start.strftime("%Y-%m-%dT%H:%M"),
        normalize_identity_part(record.get("location")),
    )


def event_record(url: str, source: str, soup: BeautifulSoup) -> dict[str, Any] | None:
    item = jsonld_event(soup)
    title = str(item.get("name") or meta(soup, "og:title") or text(soup.find("h1"))).strip()
    if not title:
        return None
    description = item.get("description") or meta(soup, "og:description", "description")
    if not description:
        description = text(soup.select_one(".description, .event-description, main"))
    start = parse_datetime(item.get("startDate"))
    end = parse_datetime(item.get("endDate"))
    location = item.get("location")
    if isinstance(location, dict):
        address = location.get("address")
        if isinstance(address, dict):
            location = ", ".join(str(address.get(k)) for k in ("name", "streetAddress", "addressLocality", "addressRegion") if address.get(k))
        else:
            location = location.get("name")

    # Get Involved event detail pages expose labeled When/Where blocks even
    # when structured event metadata is absent.
    page_text = text(soup.select_one("main") or soup.body)
    if not start:
        when_match = re.search(r"(?:When\s*)?([A-Z][a-z]+day,\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[ap]m(?:\s*-\s*.*)?|[A-Z][a-z]+\s+\d{1,2},\s+\d{4}[^.]{0,40})", page_text, re.I)
        if when_match:
            time_range = when_match.group(1)
            range_match = re.search(r"(.+?\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(.+)", time_range, re.I)
            start = parse_datetime(range_match.group(1) if range_match else time_range)
            if range_match:
                end = parse_datetime(range_match.group(2), default_date=start.date() if start else None)
    if not location:
        where_match = re.search(r"Where\s+(.+?)(?:\s+Description\b|$)", page_text, re.I)
        if where_match:
            location = where_match.group(1).strip()
    if not start:
        return None

    if not description:
        description = ""
    if isinstance(description, dict):
        description = description.get("text") or ""
    source_id = url.rstrip("/").split("/")[-1]
    if not source_id or source_id in {"all", "events"}:
        source_id = hashlib.sha256(url.encode()).hexdigest()[:24]
    tags = [source]
    organizer = item.get("organizer")
    if isinstance(organizer, dict) and organizer.get("name"):
        tags.append(str(organizer["name"]))
    elif isinstance(organizer, list):
        tags.extend(str(org["name"]) for org in organizer if isinstance(org, dict) and org.get("name"))

    record: dict[str, Any] = {
        "title": title,
        "description": str(description).strip() or None,
        "date_time": start.isoformat(),
        "end_time": None,
        "end_date": None,
        "location": str(location).strip() if location else None,
        "latitude": None,
        "longitude": None,
        "image_url": image_value(item, soup, url),
        "image_urls": [image_value(item, soup, url)] if image_value(item, soup, url) else None,
        "tags": list(dict.fromkeys(tags)),
        "rsvp_url": url,
        "source_url": url,
        "external_source": source,
        "external_id": source_id,
        "visibility": "public",
        "created_by": None,
        "allow_join_requests": False,
        "rsvp_required": False,
        "is_ticketed": False,
    }
    if end:
        if end.date() == start.date():
            record["end_time"] = end.isoformat()
        else:
            record["end_date"] = end.isoformat()
    return record


def listing_links(url: str, source: str) -> set[str]:
    links: set[str] = set()
    seen_pages: set[str] = set()
    page_url = url
    for page_number in range(1, 51):
        if source == "tamu_getinvolved":
            query = urlencode({"page": page_number})
            page_url = f"{url}?{query}" if page_number > 1 else url
        if page_url in seen_pages:
            break
        seen_pages.add(page_url)
        soup = fetch(page_url)
        prior_count = len(links)
        for anchor in soup.select("a[href]"):
            href = abs_url(anchor.get("href"), page_url)
            if not href:
                continue
            parsed = urlparse(href)
            if source == "tamu_calendar":
                if parsed.netloc.endswith("calendar.tamu.edu") and re.search(r"/events?/", parsed.path):
                    links.add(href.split("#")[0])
            else:
                if parsed.netloc.endswith("getinvolved.tamu.edu") and re.search(r"/events?/\d+", parsed.path):
                    links.add(href.split("#")[0].rstrip("/"))
        if source == "tamu_getinvolved":
            if len(links) == prior_count:
                break
            time.sleep(0.2)
            continue
        next_link = soup.select_one('a[rel="next"], .pagination a.next, a[aria-label*="Next"]')
        if not next_link or not next_link.get("href"):
            # Both source sites use numbered links. Follow the next page in
            # sequence until no additional pagination URL is present.
            candidate = None
            for anchor in soup.select("a[href]"):
                label = text(anchor).lower()
                if label in {"next", "›", "→", "next »"}:
                    candidate = abs_url(anchor["href"], page_url)
                    break
            next_link = {"href": candidate} if candidate else None
        if not next_link:
            break
        page_url = abs_url(next_link.get("href"), page_url) or ""
        time.sleep(0.25)
    return links


def calendar_api_records() -> list[dict[str, Any]]:
    """Use LiveWhale's public JSON API to collect the entire main calendar."""
    api_url = "https://calendar.tamu.edu/live/json/v2/events/response_fields/all/paginate/false"
    response = SESSION.get(api_url, timeout=60)
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", [])
    # paginate/false is capped at 1,000; follow the API's next link if needed.
    next_url = (payload.get("links") or {}).get("next")
    while next_url:
        response = SESSION.get(next_url, timeout=60)
        response.raise_for_status()
        page = response.json()
        data.extend(page.get("data", []))
        next_url = (page.get("links") or {}).get("next")

    result = []
    now = datetime.now(TZ) - timedelta(days=1)
    for item in data:
        if item.get("is_canceled") or not item.get("url"):
            continue
        start = parse_datetime(item.get("date_iso") or item.get("date_utc"))
        if not start or start < now:
            continue
        url = item["url"]
        image = item.get("thumbnail")
        if isinstance(image, dict):
            image = image.get("url") or image.get("src")
        elif isinstance(image, list):
            image = image[0] if image else None
        if isinstance(image, dict):
            image = image.get("url") or image.get("src")
        image_url = abs_url(str(image), url) if image else None
        description = item.get("description") or item.get("summary")
        if description:
            description = BeautifulSoup(str(description), "html.parser").get_text("\n", strip=True)
        tags = item.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        tags = [tag.get("name", "") if isinstance(tag, dict) else str(tag) for tag in tags]
        end = parse_datetime(item.get("date2_iso") or item.get("date2_utc")) if item.get("date2_iso") or item.get("date2_utc") else None
        result.append({
            "title": item.get("title") or "Untitled event",
            "description": description,
            "date_time": start.isoformat(),
            "end_time": end.isoformat() if end and end.date() == start.date() else None,
            "end_date": end.isoformat() if end and end.date() != start.date() else None,
            "location": item.get("location_title") or item.get("location") or ("Online" if item.get("is_online") else None),
            "latitude": float(item["location_latitude"]) if item.get("location_latitude") not in (None, "") else None,
            "longitude": float(item["location_longitude"]) if item.get("location_longitude") not in (None, "") else None,
            "image_url": image_url,
            "image_urls": [image_url] if image_url else None,
            "tags": list(dict.fromkeys(["tamu_calendar", *[str(tag) for tag in tags]])),
            "rsvp_url": url,
            "source_url": url,
            "external_source": "tamu_calendar",
            "external_id": str(item.get("id")),
            "visibility": "public",
            "created_by": None,
            "allow_join_requests": False,
            "rsvp_required": False,
            "is_ticketed": False,
        })
    return result


def collect() -> list[dict[str, Any]]:
    records: dict[tuple[str, str], dict[str, Any]] = {}
    try:
        calendar_records = calendar_api_records()
        print(f"Found {len(calendar_records)} upcoming university calendar events from LiveWhale JSON")
        for record in calendar_records:
            records[("tamu_calendar", record["external_id"])] = record
    except (requests.RequestException, ValueError, KeyError) as exc:
        print(f"LiveWhale JSON unavailable; falling back to calendar pages: {exc}", file=sys.stderr)
        for source, url in [("tamu_calendar", SOURCES["tamu_calendar"])]:
            for link in sorted(listing_links(url, source)):
                try:
                    record = event_record(link, source, fetch(link))
                    if record:
                        records[(source, record["external_id"])] = record
                except requests.RequestException as page_exc:
                    print(f"Unable to fetch {link}: {page_exc}", file=sys.stderr)

    source = "tamu_getinvolved"
    listing_url = SOURCES[source]
    print(f"Reading {source}: {listing_url}")
    try:
        links = listing_links(listing_url, source)
    except requests.RequestException as exc:
        print(f"WARNING: unable to read Get Involved; its events were skipped this run: {exc}", file=sys.stderr)
        links = set()
    print(f"Found {len(links)} event pages")
    for url in sorted(links):
        try:
            record = event_record(url, source, fetch(url))
            if record and datetime.fromisoformat(record["date_time"]) > datetime.now(TZ) - timedelta(days=1):
                records[(source, record["external_id"])] = record
        except requests.RequestException as exc:
            print(f"Unable to fetch {url}: {exc}", file=sys.stderr)
        time.sleep(0.15)
    deduped: dict[tuple[str, str, str], dict[str, Any]] = {}
    source_order = {"tamu_calendar": 0, "tamu_getinvolved": 1}
    stable_records = sorted(
        records.values(),
        key=lambda record: (source_order.get(record["external_source"], 9), record["external_id"]),
    )
    for record in stable_records:
        identity = canonical_identity(record)
        current = deduped.get(identity)
        if current is None:
            deduped[identity] = record
            continue
        tags = list(dict.fromkeys([*(current.get("tags") or []), *(record.get("tags") or [])]))
        current["tags"] = tags
    return list(deduped.values())


def upsert(records: list[dict[str, Any]]) -> int:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    endpoint = f"{supabase_url}/rest/v1/events?on_conflict=external_source,external_id"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    written = 0
    for offset in range(0, len(records), 100):
        batch = records[offset : offset + 100]
        response = SESSION.post(endpoint, headers=headers, json=batch, timeout=60)
        if not response.ok:
            raise RuntimeError(f"Supabase upsert failed ({response.status_code}): {response.text[:500]}")
        written += len(batch)
    return written


if __name__ == "__main__":
    records = collect()
    print(f"Collected {len(records)} upcoming events")
    count = upsert(records) if records else 0
    print(f"Upserted {count} TAMU events")
