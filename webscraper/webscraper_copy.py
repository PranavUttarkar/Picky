# # Enhanced Web Scraper
# # This scraper can access and extract specific website elements

from bs4 import BeautifulSoup
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime, date
import re
import json
import csv

# Base domain for resolving relative hrefs
# Note: listing_url controls the page being scraped; BASE_URL should remain the site root for joining relative paths
BASE_URL = "https://calendar.tamu.edu"

def setup_driver():
    """Setup Chrome WebDriver (recommended on macOS)"""
    # Use Chrome with Selenium Manager (Selenium 4.6+ automatically handles chromedriver)
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.chrome.service import Service as ChromeService

    chrome_options = ChromeOptions()
    # Run headless for automation environments; use the modern headless implementation
    chrome_options.add_argument("--headless=new")
    # Set a consistent viewport; many sites rely on a minimum size
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    # Provide a modern user agent; some sites hide content for old/headless UAs
    chrome_options.add_argument(
        "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    )
    # Reduce obvious automation fingerprinting
    try:
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
    except Exception:
        pass

    try:
        # Rely on Selenium Manager to resolve the correct ChromeDriver
        driver = webdriver.Chrome(options=chrome_options)
        return driver
    except Exception as e:
        print(f"Error setting up Chrome driver: {e}")
        print("Troubleshooting:")
        print("  • Ensure Google Chrome is installed and up to date")
        print("  • Ensure you have Selenium 4.6+ so Selenium Manager can fetch chromedriver automatically")
        print("  • Alternatively, install ChromeDriver manually (e.g., with Homebrew: 'brew install chromedriver')")
        raise

def get_event_links(driver, listing_url):
    """
    Extract event links from the calendar listing page using Selenium
    """
    print(f"Loading calendar page: {listing_url}")
    driver.get(listing_url)

    # Wait for the page to load and events to appear
    print("Waiting for events to load...")
    wait = WebDriverWait(driver, 20)

    # Try clicking "Show All" to expand the listing if available
    try:
        before_count = len(driver.find_elements(By.CSS_SELECTOR, "a[href*='/event/']"))
        show_all_selectors = [
            "a.lw_cal_all",
            ".lw_cal_all",
            "a.list-button.caret-button.lw_cal_all",
        ]
        clicked = False
        for sel in show_all_selectors:
            try:
                el = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.CSS_SELECTOR, sel)))
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
                try:
                    el.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", el)
                clicked = True
                print("Clicked 'Show All' button")
                break
            except Exception:
                continue
        if not clicked:
            # XPath fallback
            try:
                el = WebDriverWait(driver, 3).until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@class,'lw_cal_all') or contains(., 'Show All')]")))
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
                try:
                    el.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", el)
                clicked = True
                print("Clicked 'Show All' button via XPath")
            except Exception:
                print("No 'Show All' control detected")
        if clicked:
            # Wait for the number of event links to increase (or short delay as fallback)
            try:
                WebDriverWait(driver, 10).until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "a[href*='/event/']")) > before_count)
            except Exception:
                time.sleep(1.5)
    except Exception as e:
        print(f"Error while attempting 'Show All': {e}")

    # Wait for calendar events to be present
    # Optimized selectors focusing on TAMU calendar structure
    possible_selectors = [
        "div.top-info h4 a",                 # Primary: event link inside .top-info > h4
        ".top-info h4 a",                    # Variant without explicit div type
        "a[href^='/event/']",                # Direct event URL pattern match
        "h3.lw_event_item_title a",          # LiveWhale listing title links
        ".lw_events_title a"                 # LiveWhale event title links
    ]

    event_links = []

    for selector in possible_selectors:
        try:
            print(f"Trying selector: {selector}")
            elements = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, selector)))
            print(f"Found {len(elements)} elements with selector: {selector}")

            for element in elements:
                href = element.get_attribute('href')
                if not href:
                    continue
                # Filter out obvious non-detail links and blocked phrases
                txt = (element.text or '').strip()
                txt_lower = txt.lower()
                bad_keywords = ["register", "share", "contact", "add to calendar", "ical", "rss"]
                if any(k in txt_lower for k in bad_keywords):
                    continue
                # Skip redundant/useless events (user-provided)
                if (
                    "wellness wherever you are" in txt_lower or
                    "fall break - no classes" in txt_lower or
                    ("transit" in txt_lower and "service" in txt_lower)
                ):
                    print(f"  Skipping event: {txt}")
                    continue
                if href.startswith('/'):
                    href = BASE_URL + href
                event_links.append(href)
                print(f"  Found event: {href}")

            # Do not break; we want to gather links from multiple selector variants

        except Exception as e:
            print(f"Selector {selector} didn't work: {e}")
            continue

    # If we still have fewer than 5, try to find any links that look like events
    if len(event_links) < 5:
        print("Fewer than 5 events found with specific selectors, trying broader search...")
        try:
            all_links = driver.find_elements(By.TAG_NAME, "a")
            print(f"Found {len(all_links)} total links on page")

            for link in all_links:
                href = link.get_attribute('href')
                text = (link.text or '').strip()
                if href and '/event/' in href:
                    # Skip same blocked phrases in broad scan
                    tl = text.lower()
                    if (
                        "wellness wherever you are" in tl or
                        "fall break - no classes" in tl or
                        ("transit" in tl and "service" in tl)
                    ):
                        print(f"  Skipping event (broad scan): {text}")
                        continue
                    if href.startswith('/'):
                        href = BASE_URL + href
                    event_links.append(href)
                    print(f"  Found potential event: {text[:50]} -> {href}")

        except Exception as e:
            print(f"Error in broad search: {e}")

    print(f"🎯 Total event links found: {len(event_links)}")
    unique_links = list(dict.fromkeys(event_links))  # Preserve order, remove duplicates
    print(f"🎯 Unique event links after deduplication: {len(unique_links)}")

    if len(unique_links) < 5:
        print(f"⚠️  Warning: Only found {len(unique_links)} events, expected at least 5")
        print("🔍 This might mean:")
        print("  • The selectors need to be updated")
        print("  • Events are loaded differently than expected")
        print("  • The website structure has changed")

    return unique_links

def parse_event(driver, event_url):
    """
    Parse individual event page using Selenium
    """
    print(f"Parsing event: {event_url}")
    try:
        print(f"    Navigating from: {driver.current_url}")
        driver.get(event_url)
        print(f"    After get(), current URL: {driver.current_url}")

        # Wait for page to load and for TAMU right column title to appear (fallback to generic h1)
        wait = WebDriverWait(driver, 20)
        try:
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '#tamu_cal_event_rightcol h1')))
        except Exception:
            try:
                wait.until(EC.presence_of_element_located((By.TAG_NAME, 'h1')))
            except Exception:
                wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))

        # Helpful debug: print the document title
        try:
            print(f"    Page title: {driver.title}")
        except Exception:
            pass

        # Get page source and parse with BeautifulSoup
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        # Extract title - prioritize TAMU right column container
        title_selectors = [
            '#tamu_cal_event_rightcol h1',
            'h1.lw_event_title',
            '.lw_event_title h1',
            '.event-title h1',
            'h1.event-title',
            'h1'
        ]
        
        title = None
        for selector in title_selectors:
            element = soup.select_one(selector)
            if element:
                title = element.get_text(strip=True)
                # Skip blocked phrases at parse level too
                if title:
                    tl = title.lower()
                    if (
                        "transit: no service" in tl or
                        ("transit" in tl and "service" in tl) or
                        "wellness wherever you are" in tl or
                        "fall break - no classes" in tl
                    ):
                        print(f"    Skipping blocked event: {title}")
                        return None
                # OPAS Presents -> See ... live! transformation
                try:
                    if title and re.search(r"\bopas\s+presents\b", title, flags=re.IGNORECASE):
                        # Replace leading phrase (case-insensitive) with 'See '
                        new_title = re.sub(r"(?i)\bopas\s+presents\b\s*[:\-–—]?\s*", "See ", title)
                        # Collapse multiple spaces
                        new_title = re.sub(r"\s+", " ", new_title).strip()
                        # Remove dangling trailing punctuation before appending ' live!'
                        new_title = re.sub(r"[\s,;:]+$", "", new_title)
                        # Append ' live!' if not already present
                        if not re.search(r"\blive!$", new_title, flags=re.IGNORECASE):
                            new_title = f"{new_title} live!"
                        title = new_title
                        print(f"    ✏️  Normalized OPAS title -> {title}")
                except Exception:
                    pass
                break
        
        # Extract description
        desc_selectors = [
            '.intro',                        # Texas A&M intro section
            '.lw_calender_event_description', # LiveWhale description
            '.event-description',
            '.tribe-events-single-event-description',
            '.lw_event_description',
            '.event-content',
            '.description',                   # Generic description class
            '[class*="description"]',         # Any class containing "description"
            '[class*="intro"]',              # Any class containing "intro"
            'p'                              # Generic paragraphs as fallback
        ]
        
        description = None
        print(f"    🔍 Looking for description with {len(desc_selectors)} selectors...")
        for selector in desc_selectors:
            element = soup.select_one(selector)
            if element:
                description = element.get_text(separator=' ', strip=True)
                print(f"    ✅ Found description with selector '{selector}': {description[:100]}...")
                if len(description) > 25:  # Only use if substantial content
                    break
                else:
                    print(f"    ⚠️  Description too short ({len(description)} chars), trying next selector...")
        
        if not description:
            print(f"    ❌ No description found with any selector")
            # Try to get some text content for debugging
            all_text = soup.get_text()[:500]
            print(f"    🔍 Sample page text: {all_text}...")
        
        # Extract TIME (unchanged logic)
        time_selectors = [
            '#tamu_cal_event_rightcol .lw_start_time',
            '#tamu_cal_event_rightcol time',
            '.lw_start_time',
            '.event-time',
            'time'
        ]

        time_text = None
        for selector in time_selectors:
            element = soup.select_one(selector)
            if element:
                time_text = element.get_text(separator=' ', strip=True)
                break

        # Fallback: detect 'All day' time in right column meta when no explicit time found
        if not time_text:
            def is_all_day(txt: str) -> bool:
                if not txt:
                    return False
                t = txt.strip().lower().replace('-', ' ')
                return 'all day' in t

            for el in soup.select('#tamu_cal_event_rightcol .lw_cal_event_loc p, #tamu_cal_event_rightcol .lw_cal_event_loc'):
                txt = el.get_text(separator=' ', strip=True)
                if is_all_day(txt):
                    time_text = 'All day'
                    break
            if not time_text:
                # Broaden search to any text in the right column
                rc = soup.select_one('#tamu_cal_event_rightcol')
                if rc:
                    if is_all_day(rc.get_text(separator=' ', strip=True)):
                        time_text = 'All day'

        # Extract DATE (user-specified: within right column, .lw_cal_event_loc). We'll detect a date-like string to avoid conflicts with location.
        def is_date_like(txt: str) -> bool:
            if not txt:
                return False
            t = txt.lower()
            months = [
                'january','february','march','april','may','june','july','august','september','october','november','december',
                'jan','feb','mar','apr','jun','jul','aug','sep','sept','oct','nov','dec'
            ]
            if any(m in t for m in months):
                return True
            import re
            # Match common date formats like 9/26/2025 or 09-26-25
            if re.search(r'\b\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?\b', t):
                return True
            # Weekday names sometimes included with date
            weekdays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','mon','tue','wed','thu','fri','sat','sun']
            if any(w in t for w in weekdays):
                return True
            return False

        date_text = None
        date_candidates = soup.select('#tamu_cal_event_rightcol .lw_cal_event_loc')
        for el in date_candidates:
            txt = el.get_text(separator=' ', strip=True)
            if is_date_like(txt):
                date_text = txt
                break
        if not date_text:
            # Fallbacks in case of markup variation
            for selector in ['#tamu_cal_event_rightcol .lw_event_when', '#tamu_cal_event_rightcol .event-date']:
                el = soup.select_one(selector)
                if el:
                    cand = el.get_text(separator=' ', strip=True)
                    if is_date_like(cand):
                        date_text = cand
                        break

        if not date_text:
            # Last resort: scan the right column text for common date patterns
            import re
            container = soup.select_one('#tamu_cal_event_rightcol')
            if container:
                text = container.get_text(separator=' ', strip=True)
                # Patterns: Month Day, Year | Mon Day, Year | MM/DD/YYYY
                month_names = r'(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)'
                patterns = [
                    rf'\b{month_names}\s+\d{{1,2}},\s*\d{{4}}\b',
                    rf'\b{month_names}\s+\d{{1,2}}\b',
                    r'\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b',
                ]
                for pat in patterns:
                    m = re.search(pat, text)
                    if m:
                        date_text = m.group(0)
                        break
        if not date_text:
            # Fallback: LiveWhale day header e.g.
            # <div id="lw_cal_scroll_links"><span id="lw_cal_this_day">Sept<span>ember</span> <span class="lw_date">27</span><span class="lw_year">, 2025</span></span>
            # Try inside the container first, then anywhere on page
            this_day = soup.select_one('#lw_cal_scroll_links #lw_cal_this_day') or soup.select_one('#lw_cal_this_day')
            if this_day:
                # Get text with inner spans combined, preserving spaces
                raw = this_day.get_text(separator=' ', strip=True)
                # Normalize cases like "Sept ember 27 , 2025" to "September 27, 2025"
                import re as _re_norm
                # Merge split month names like "Sept ember" -> "September"
                raw = _re_norm.sub(r'\bSept\s*ember\b', 'September', raw)
                raw = _re_norm.sub(r'\bNov\s*ember\b', 'November', raw)
                raw = _re_norm.sub(r'\bDec\s*ember\b', 'December', raw)
                raw = _re_norm.sub(r'\bOct\s*ober\b', 'October', raw)
                raw = _re_norm.sub(r'\bAug\s*ust\b', 'August', raw)
                raw = _re_norm.sub(r'\bJan\s*u?ary\b', 'January', raw)
                raw = _re_norm.sub(r'\bFeb\s*ruary\b', 'February', raw)
                raw = _re_norm.sub(r'\bMar\s*ch\b', 'March', raw)
                raw = _re_norm.sub(r'\bApr\s*il\b', 'April', raw)
                raw = _re_norm.sub(r'\bJu\s*ne\b', 'June', raw)
                raw = _re_norm.sub(r'\bJu\s*ly\b', 'July', raw)
                # Fix stray spaces before commas: "27 , 2025" -> "27, 2025"
                raw = _re_norm.sub(r'\s+,\s*', ', ', raw)
                # Compress multiple spaces
                raw = ' '.join(raw.split())
                # Prefer full form like "September 27, 2025" if present
                month_names = r'(January|February|March|April|May|June|July|August|September|October|November|December)'
                mfull = _re_norm.search(rf'\b{month_names}\s+\d{{1,2}},\s*\d{{4}}\b', raw)
                if mfull:
                    date_text = mfull.group(0)
                else:
                    # Accept shorter forms like "Sept 27, 2025" or "September 27"
                    malt = _re_norm.search(rf'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{{1,2}}(,\s*\d{{4}})?\b', raw)
                    if malt:
                        date_text = malt.group(0)

        if not date_text:
            # Fallback: ISO date from <time datetime="YYYY-MM-DDTHH:MM:SSZ">
            time_nodes = soup.select('#tamu_cal_event_rightcol time[datetime], time[datetime]')
            for tn in time_nodes:
                dt_iso = (tn.get('datetime') or '').strip()
                if not dt_iso:
                    continue
                # Extract date portion (before 'T') if present
                date_part = dt_iso.split('T')[0]
                if date_part:
                    date_text = date_part
                    break

        if not date_text:
            # Fallback: meta tags or JSON-LD structured data for startDate
            # 1) meta itemprop/startDate
            metas = soup.select('meta[itemprop="startDate"], meta[property*="start_time" i], meta[name*="start_date" i]')
            for m in metas:
                content = (m.get('content') or '').strip()
                if content:
                    # Prefer date part if ISO-like
                    date_text = content.split('T')[0] if 'T' in content else content
                    break
            # 2) JSON-LD
            if not date_text:
                for script in soup.select('script[type="application/ld+json"]'):
                    try:
                        import json as _json
                        data = _json.loads(script.string or '')
                        # Could be dict or list
                        items = data if isinstance(data, list) else [data]
                        for it in items:
                            if isinstance(it, dict) and it.get('@type') in ('Event', 'MusicEvent', 'ExhibitionEvent'):
                                sd = it.get('startDate') or it.get('start_time')
                                if sd:
                                    date_text = sd.split('T')[0] if 'T' in sd else sd
                                    raise StopIteration
                    except StopIteration:
                        break
                    except Exception:
                        continue

        if not date_text:
            # Final fallback: scan entire page text for a date
            import re as _re3
            full_text = soup.get_text(separator=' ', strip=True)
            month_names = r'(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)'
            for pat in [
                rf'\b{month_names}\s+\d{{1,2}},\s*\d{{4}}\b',
                rf'\b{month_names}\s+\d{{1,2}}\b',
                r'\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b',
            ]:
                m = _re3.search(pat, full_text)
                if m:
                    date_text = m.group(0)
                    break

        # Label-based fallback: look for dt/dd with 'When' to populate date/time if still missing
        if not date_text or not time_text:
            dts = soup.select('#tamu_cal_event_rightcol dt') or soup.select('dt')
            for dt in dts:
                label = (dt.get_text(strip=True) or '').lower()
                if any(k in label for k in ['when', 'date']):
                    dd = dt.find_next_sibling('dd')
                    if not dd:
                        continue
                    val = dd.get_text(' ', strip=True)
                    if not val:
                        continue
                    # Try to extract date if missing
                    if not date_text:
                        extracted_date = None
                        import re as _re
                        month_names = r'(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)'
                        for pat in [
                            rf'\b{month_names}\s+\d{{1,2}},\s*\d{{4}}\b',
                            rf'\b{month_names}\s+\d{{1,2}}\b',
                            r'\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b',
                        ]:
                            m = _re.search(pat, val)
                            if m:
                                extracted_date = m.group(0)
                                break
                        if extracted_date:
                            date_text = extracted_date
                    # Try to extract time if missing
                    if not time_text:
                        vlow = val.lower()
                        if 'all day' in vlow:
                            time_text = 'All day'
                        else:
                            import re as _re2
                            tpat = _re2.search(r'\b\d{1,2}(:\d{2})?\s*(am|pm)\b', val, _re2.IGNORECASE)
                            if tpat:
                                time_text = tpat.group(0)

        # Extract location (avoid picking date-like strings)
        location_selectors = [
            '#tamu_cal_event_rightcol .lw_event_location',
            '#tamu_cal_event_rightcol .lw_cal_event_loc',
            '.lw_event_location',
            '.lw_cal_event_loc',
            '.event-details__where',
            '.tribe-events-venue-details',
            '.event-location'
        ]

        location_text = None
        # Try multiple matches and select the first non-date-like value
        for selector in location_selectors:
            elements = soup.select(selector)
            if not elements:
                continue
            for el in elements:
                cand = el.get_text(separator=' ', strip=True)
                if cand and not is_date_like(cand) and 'all day' not in cand.lower():
                    location_text = cand
                    break
            if location_text:
                break
        
        # Extract image URL
        image_selectors = [
            '#tamu_cal_event_leftcol img',
            '#tamu_cal_event_rightcol img',
            '.lw_image img',
            'img.lw_event_image',
            '.event-image img',
            '.event-photo img',
            'img[alt*="event"]',
            'img'
        ]

        def is_bad_image(src: str) -> bool:
            s = src.lower()
            bad_tokens = ['logo', 'icon', 'sprite', 'favicon', 'pixel', '.svg']
            return any(t in s for t in bad_tokens)

        image_url = None
        for selector in image_selectors:
            element = soup.select_one(selector)
            if not element:
                continue
            # Try to get src attribute first, then data-src (for lazy loading)
            candidate = element.get('src') or element.get('data-src')
            if not candidate:
                continue
            # Convert relative URLs to absolute
            if candidate.startswith('/'):
                candidate = BASE_URL + candidate
            elif candidate.startswith('//'):
                candidate = 'https:' + candidate
            # Skip icons/logos
            if is_bad_image(candidate):
                continue
            image_url = candidate
            break
        
        # Normalize to ISO YYYY-MM-DD
        def extract_year_from_context(soup_obj) -> int:
            # 1) From lw_cal_this_day .lw_year
            try:
                yel = soup_obj.select_one('#lw_cal_scroll_links #lw_cal_this_day .lw_year, #lw_cal_this_day .lw_year, .lw_year')
                if yel:
                    m = re.search(r'(\d{4})', yel.get_text(' ', strip=True))
                    if m:
                        return int(m.group(1))
            except Exception:
                pass
            # 2) From time[datetime]
            for tn in soup_obj.select('#tamu_cal_event_rightcol time[datetime], time[datetime]'):
                dt_iso = (tn.get('datetime') or '').strip()
                if len(dt_iso) >= 4 and dt_iso[:4].isdigit():
                    return int(dt_iso[:4])
            # 3) From meta tags
            metas = soup_obj.select('meta[itemprop="startDate"], meta[property*="start_time" i], meta[name*="start_date" i]')
            for m in metas:
                content = (m.get('content') or '').strip()
                if len(content) >= 4 and content[:4].isdigit():
                    return int(content[:4])
            # 4) From JSON-LD
            try:
                for script in soup_obj.select('script[type="application/ld+json"]'):
                    import json as _json
                    data = _json.loads(script.string or '')
                    items = data if isinstance(data, list) else [data]
                    for it in items:
                        if isinstance(it, dict) and it.get('@type') in ('Event', 'MusicEvent', 'ExhibitionEvent'):
                            sd = it.get('startDate') or it.get('start_time')
                            if sd and len(sd) >= 4 and sd[:4].isdigit():
                                return int(sd[:4])
            except Exception:
                pass
            # 5) Fallback: current year
            return date.today().year

        def normalize_to_iso(date_str: str, soup_obj) -> str:
            if not date_str:
                return None
            s = date_str.strip()
            # If ISO datetime or date
            if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
                return s
            if re.match(r'^\d{4}-\d{2}-\d{2}T', s):
                return s.split('T')[0]
            # Try MM/DD[/YY|YYYY]
            m = re.match(r'^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$', s)
            if m:
                mm = int(m.group(1)); dd = int(m.group(2)); yy = m.group(3)
                if yy:
                    y = int(yy)
                    year_val = 2000 + y if y < 100 else y
                else:
                    year_val = extract_year_from_context(soup_obj)
                return f"{year_val:04d}-{mm:02d}-{dd:02d}"
            # Try Month DD[, YYYY]
            month_map = {
                'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,
                'july':7,'august':8,'september':9,'october':10,'november':11,'december':12,
                'jan':1,'feb':2,'mar':3,'apr':4,'jun':6,'jul':7,'aug':8,'sep':9,'sept':9,'oct':10,'nov':11,'dec':12
            }
            m2 = re.match(r'^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?$', s, re.IGNORECASE)
            if m2:
                mm = month_map[m2.group(1).lower()]
                dd = int(m2.group(2))
                year_val = int(m2.group(3)) if m2.group(3) else extract_year_from_context(soup_obj)
                return f"{year_val:04d}-{mm:02d}-{dd:02d}"
            # Try common strptime forms
            for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d", "%b %d"):
                try:
                    dt = datetime.strptime(s, fmt)
                    year_val = dt.year if "%Y" in fmt else extract_year_from_context(soup_obj)
                    return f"{year_val:04d}-{dt.month:02d}-{dt.day:02d}"
                except Exception:
                    continue
            return None

        date_iso = normalize_to_iso(date_text, soup)

        return {
            'title': title,
            'description': description,
            'date': date_text,
            'date_iso': date_iso,
            'time': time_text,
            'location': location_text,
            'image_url': image_url,
            'tags': event_url
        }
        
    except Exception as e:
        print(f"Error parsing {event_url}: {e}")
        return None
        
    finally:
        pass

def scrape_events(main_listing_url, delay=1.0, max_events=None):
    """
    Scrape events from a listing page using Selenium, return list of event dicts.
    """
    events = []
    seen_titles = set()  # Track event titles we've already seen

    # Use a single Chrome driver for the whole session so navigation is visible
    driver = setup_driver()
    try:
        links = get_event_links(driver, main_listing_url)
        print(f"Found {len(links)} events to parse.")

        # Collect all events (no limit)
        print(f"Processing all {len(links)} events found")

        for i, link in enumerate(links, 1):
            print(f"\n--- Processing Event {i}/{len(links)} ---")
            try:
                ev = parse_event(driver, link)
                if ev:  # Only add if parsing was successful
                    event_title = ev.get('title', '').strip()

                    # Check for duplicate titles
                    if event_title and event_title in seen_titles:
                        print(f"⏭️  Skipping duplicate: {event_title}")
                        continue

                    # Add to seen titles and events list
                    if event_title:
                        seen_titles.add(event_title)

                    events.append(ev)
                    print(f"✅ Successfully parsed: {ev.get('title', 'No title')}")

                    # Show what data we got
                    print(f"   📅 Date: {ev.get('date', 'None found')}  🕒 Time: {ev.get('time', 'None found')}")
                    if ev.get('date_iso'):
                        print(f"   📆 ISO: {ev['date_iso']}")
                    print(f"   📍 Location: {ev.get('location', 'None found')}")
                    print(f"   🔗 URL: {ev.get('url', 'None found')}")
                    print(f"   🖼️  Image: {ev.get('image_url', 'None found')}")
                    if ev.get('description'):
                        desc_preview = ev['description'][:100] + "..." if len(ev['description']) > 100 else ev['description']
                        print(f"   📝 Description: {desc_preview}")
                    else:
                        print(f"   📝 Description: None found")
                    # Extra debug if date is missing
                    if not ev.get('date'):
                        # Try to pull helpful context from page again
                        try:
                            soup_dbg = BeautifulSoup(driver.page_source, 'html.parser')
                            rc_dbg = soup_dbg.select_one('#tamu_cal_event_rightcol')
                            day_dbg = soup_dbg.select_one('#lw_cal_scroll_links #lw_cal_this_day')
                            if rc_dbg:
                                print("   🔎 Debug rightcol snippet:", rc_dbg.get_text(separator=' ', strip=True)[:140], '...')
                            if day_dbg:
                                print("   🔎 Debug this_day:", day_dbg.get_text(separator=' ', strip=True))
                        except Exception:
                            pass
                else:
                    print(f"❌ Failed to parse event")
            except Exception as e:
                print(f"❌ Error parsing {link}: {e}")

            time.sleep(delay)  # be polite
    finally:
        try:
            driver.quit()
        except Exception:
            pass
        
    return events

if __name__ == "__main__":
    print("=== Texas A&M Calendar Scraper (Selenium + Chrome) ===")
    print("=== Processing all available events ===")
    
    try:
        listing_url = "https://calendar.tamu.edu/athletics/all"
        print("Starting scraping process...")
        
        # Process all events (no limit)
        events = scrape_events(listing_url, delay=1.0)
        
        print(f"\n{'='*60}")
        print(f"FINAL RESULTS - Found {len(events)} events")
        print(f"{'='*60}")
        
        if not events:
            print("❌ No events were successfully scraped")
            print("This might mean:")
            print("  • The website structure has changed")
            print("  • Events are loaded differently than expected")
            print("  • The selectors need to be updated")
        else:
            for i, event in enumerate(events, 1):
                print(f"\n📋 EVENT {i}:")
                print(f"   Title: {event.get('title', '❌ NOT FOUND')}")
                print(f"   Date: {event.get('date', '❌ NOT FOUND')}  Time: {event.get('time', '❌ NOT FOUND')}")
                print(f"   Location: {event.get('location', '❌ NOT FOUND')}")
                print(f"   URL: {event.get('url', '❌ NOT FOUND')}")
                print(f"   Image: {event.get('image_url', '❌ NOT FOUND')}")
                
                if event.get('description'):
                    desc = event['description'][:200] + "..." if len(event['description']) > 200 else event['description']
                    print(f"   Description: {desc}")
                else:
                    print(f"   Description: ❌ NOT FOUND")
                
                # Data quality check
                missing_fields = []
                if not event.get('title'): missing_fields.append('title')
                if not event.get('date'): missing_fields.append('date')
                if not event.get('time'): missing_fields.append('time')
                if not event.get('location'): missing_fields.append('location')
                if not event.get('image_url'): missing_fields.append('image')
                
                if missing_fields:
                    print(f"   ⚠️  Missing: {', '.join(missing_fields)}")
                else:
                    print(f"   ✅ All key fields found")
        
        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY:")
        print(f"  • Events attempted: {len([e for e in events if e])}")
        print(f"  • Events successfully parsed: {len(events)}")
        
        if events:
            titles_found = sum(1 for e in events if e.get('title'))
            dates_found = sum(1 for e in events if e.get('date'))
            times_found = sum(1 for e in events if e.get('time'))
            locations_found = sum(1 for e in events if e.get('location'))
            images_found = sum(1 for e in events if e.get('image_url'))
            
            print(f"  • Titles found: {titles_found}/{len(events)}")
            print(f"  • Dates found: {dates_found}/{len(events)}")
            iso_found = sum(1 for e in events if e.get('date_iso'))
            print(f"  • ISO dates found: {iso_found}/{len(events)}")
            print(f"  • Times found: {times_found}/{len(events)}")
            print(f"  • Locations found: {locations_found}/{len(events)}")
            print(f"  • Images found: {images_found}/{len(events)}")
        # Export results to JSON
        try:
            out_path = 'games.json' #change to "events.json" once implemented into Picky
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(events, f, ensure_ascii=False, indent=2)
            print(f"\n💾 Saved {len(events)} events to {out_path}")
        except Exception as ex:
            print(f"\n❌ Failed to save JSON: {ex}")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"❌ Critical Error: {e}")
        import traceback
        traceback.print_exc()
