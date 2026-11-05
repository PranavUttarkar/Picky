# Texas A&M Calendar Web Scraper

## Automatic TAMU event sync

`sync_tamu_events.py` imports upcoming events from the public LiveWhale JSON API
for the university calendar and from Get Involved's paginated event listings.
It follows event detail pages to retain source descriptions, dates, locations,
registration links, and image URLs. Times are saved in the `America/Chicago`
timezone; source images remain linked at their official TAMU URLs.

The importer writes directly to the existing `events` schema. It maps the
primary image to both `image_url` and `image_urls`, keeps coordinates when
provided by LiveWhale, records multi-day endings in `end_date`, and stores each
source's stable ID and URL for repeatable upserts. Imported events are public
and have no user creator. The sync runs every four hours through GitHub Actions
and can also be started manually from the Actions tab.

### One-time setup

1. Apply `supabase/migrations/0048_external_event_sources.sql` to the Supabase
   project before running the importer.
2. In the GitHub repository, add Actions secrets named `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. Use the project URL and service role key from
   Supabase project settings. The key is only consumed by the scheduled server
   workflow and must not be placed in the app or committed to the repository.
3. Run **Sync TAMU events** once from GitHub Actions to populate the catalog.

The importer skips events that ended more than a day ago, refreshes matching
source records on each run, and leaves user-created events untouched. If a
source removes an event, its previously imported row is retained for saved
event references and moderation history.

This folder contains a Selenium-based scraper that collects event details from Texas A&M calendars and writes results to JSON, with optional CSV conversion.

Key files:

- Chrome scraper: [webscraper_copy.py](webscraper_copy.py)
- Safari scraper (macOS): [webscraper_safari.py](webscraper_safari.py)
- Output examples: games.json, events.json, events.csv
- Utilities (conversion/cleanup): scripts/json_to_csv.py, scripts/pipeline_convert.py, scripts/clean_description_urls.py, scripts/humanize_csv_dates.py

## Requirements

- macOS or Linux recommended
- Python 3.13 (venv provided in `webscraper_env/`)
- Google Chrome for the Chrome path
- Safari with Remote Automation enabled for the Safari path

Python packages (installed in venv):

- selenium
- beautifulsoup4

## Quick Start (VS Code Terminal)

1. Change into the webscraper folder:

```sh
cd /Users/pranavnair/Personal/Code/Python/webscraper
```

2. Activate the bundled venv:

```sh
source webscraper_env/bin/activate
```

If needed, install/upgrade deps:

```sh
pip install --upgrade pip
pip install selenium beautifulsoup4
```

3. Run the Chrome scraper (headless):

```sh
python webscraper_copy.py
```

- Output: `games.json` in this folder

To view the browser, edit webscraper_copy.py and remove the `--headless=new` option in `setup_driver()`.

## Safari (macOS) Setup

One-time enable:

```sh
safaridriver --enable
```

Safari > Settings > Advanced: check “Show Develop menu”
Develop > Allow Remote Automation

Run the Safari scraper:

```sh
python webscraper_safari.py
```

## Changing What Gets Scraped

- Listing URL: edit the `listing_url` inside `if __name__ == "__main__":` in `webscraper_copy.py`
  - Example: `https://calendar.tamu.edu/athletics/all` or other category pages
- The scraper attempts to click “Show All” when present and collects links that match `/event/`

## Output Schema

Each event record includes:

- title
- description
- date (raw)
- date_iso (normalized YYYY-MM-DD when detected)
- time
- location
- image_url
- tags (currently set to the event URL)

Output file: `games.json`

## Convert JSON to CSV

Option A: Simple conversion

```sh
python scripts/json_to_csv.py games.json -o games.csv
```

- Options:
  - `--tags-format {join|json}` and `--tags-sep '|'`
  - `--no-header-sort` to preserve key order

Option B: Unified pipeline (strip URLs, normalize date, humanize date, and write CSV)

```sh
python scripts/pipeline_convert.py games.json -o games_events_import.csv \
  --strip-urls --normalize-date --no-humanize-date --events-schema --tags-format json
```

Other helpers:

- Remove URLs from descriptions (in-place or to new file):
  ```sh
  python scripts/clean_description_urls.py games.json --backup
  ```
- Humanize ISO dates in a CSV column:
  ```sh
  python scripts/humanize_csv_dates.py games.csv -o games_human.csv
  ```

## Troubleshooting

- ChromeDriver errors:

  - Ensure Chrome is installed and up to date
  - Upgrade Selenium:
    ```sh
    pip install --upgrade selenium
    ```
  - The script relies on Selenium Manager (no manual driver needed on Selenium 4.6+)

- Few or no events found:

  - The site structure may have changed; update selectors in `get_event_links()` and `parse_event()` in `webscraper_copy.py`
  - Remove headless and watch the browser to verify what loads

- Safari:
  - Confirm `safaridriver --enable`
  - Ensure Develop > Allow Remote Automation is enabled

## Notes

- The Chrome scraper uses a desktop user agent and a fixed window size for consistent layout.
- Relative image URLs are resolved against `BASE_URL`.
- JSON is saved atomically; a `.bak` may be produced by some scripts when `--backup` is used.

## Project Structure

- Scrapers
  - webscraper_copy.py (Chrome)
  - webscraper_safari.py (Safari)
- Data
  - games.json, events.json, \*.csv
- Scripts
  - scripts/json_to_csv.py
  - scripts/pipeline_convert.py
  - scripts/clean_description_urls.py
  - scripts/humanize_csv_dates.py
- Environment
  - webscraper_env/ (Python 3.13 venv)

````// filepath: /Users/pranavnair/Personal/Code/Python/webscraper/README.md
# Texas A&M Calendar Web Scraper

This folder contains a Selenium-based scraper that collects event details from Texas A&M calendars and writes results to JSON, with optional CSV conversion.

Key files:
- Chrome scraper: [webscraper_copy.py](webscraper_copy.py)
- Safari scraper (macOS): [webscraper_safari.py](webscraper_safari.py)
- Output examples: games.json, events.json, events.csv
- Utilities (conversion/cleanup): scripts/json_to_csv.py, scripts/pipeline_convert.py, scripts/clean_description_urls.py, scripts/humanize_csv_dates.py

## Requirements

- macOS or Linux recommended
- Python 3.13 (venv provided in `webscraper_env/`)
- Google Chrome for the Chrome path
- Safari with Remote Automation enabled for the Safari path

Python packages (installed in venv):
- selenium
- beautifulsoup4

## Quick Start (VS Code Terminal)

1) Change into the webscraper folder:
```sh
cd /Users/pranavnair/Personal/Code/Python/webscraper
````

2. Activate the bundled venv:

```sh
source webscraper_env/bin/activate
```

If needed, install/upgrade deps:

```sh
pip install --upgrade pip
pip install selenium beautifulsoup4
```

3. Run the Chrome scraper (headless):

```sh
python webscraper_copy.py
```

- Output: `games.json` in this folder

To view the browser, edit webscraper_copy.py and remove the `--headless=new` option in `setup_driver()`.

## Safari (macOS) Setup

One-time enable:

```sh
safaridriver --enable
```

Safari > Settings > Advanced: check “Show Develop menu”
Develop > Allow Remote Automation

Run the Safari scraper:

```sh
python webscraper_safari.py
```

## Changing What Gets Scraped

- Listing URL: edit the `listing_url` inside `if __name__ == "__main__":` in `webscraper_copy.py`
  - Example: `https://calendar.tamu.edu/athletics/all` or other category pages
- The scraper attempts to click “Show All” when present and collects links that match `/event/`

## Output Schema

Each event record includes:

- title
- description
- date (raw)
- date_iso (normalized YYYY-MM-DD when detected)
- time
- location
- image_url
- tags (currently set to the event URL)

Output file: `games.json`

## Convert JSON to CSV

Option A: Simple conversion

```sh
python scripts/json_to_csv.py games.json -o games.csv
```

- Options:
  - `--tags-format {join|json}` and `--tags-sep '|'`
  - `--no-header-sort` to preserve key order

Option B: Unified pipeline (strip URLs, normalize date, humanize date, and write CSV)

```sh
python scripts/pipeline_convert.py games.json -o games_events_import.csv \
  --strip-urls --normalize-date --no-humanize-date --events-schema --tags-format json
```

Other helpers:

- Remove URLs from descriptions (in-place or to new file):
  ```sh
  python scripts/clean_description_urls.py games.json --backup
  ```
- Humanize ISO dates in a CSV column:
  ```sh
  python scripts/humanize_csv_dates.py games.csv -o games_human.csv
  ```

## Troubleshooting

- ChromeDriver errors:

  - Ensure Chrome is installed and up to date
  - Upgrade Selenium:
    ```sh
    pip install --upgrade selenium
    ```
  - The script relies on Selenium Manager (no manual driver needed on Selenium 4.6+)

- Few or no events found:

  - The site structure may have changed; update selectors in `get_event_links()` and `parse_event()` in `webscraper_copy.py`
  - Remove headless and watch the browser to verify what loads

- Safari:
  - Confirm `safaridriver --enable`
  - Ensure Develop > Allow Remote Automation is enabled

## Notes

- The Chrome scraper uses a desktop user agent and a fixed window size for consistent layout.
- Relative image URLs are resolved against `BASE_URL`.
- JSON is saved atomically; a `.bak` may be produced by some scripts when `--backup` is used.

## Project Structure

- Scrapers
  - webscraper_copy.py (Chrome)
  - webscraper_safari.py (Safari)
- Data
  - games.json, events.json, \*.csv
- Scripts
  - scripts/json_to_csv.py
  - scripts/pipeline_convert.py
  - scripts/clean_description_urls.py
  - scripts/humanize_csv_dates.py
- Environment
  - webscraper_env/ (Python 3.13 venv)
