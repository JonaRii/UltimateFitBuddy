"""Download the latest USDA FoodData Central Foundation Foods + SR Legacy CSV zips.

USDA changes the date-stamped filenames every release, so we scrape the
download index page to find the current URLs. Both archives are tiny
(<10 MB combined) and the data is CC0, so this is safe to bake into
the build pipeline.

Outputs:
  data-pipeline/seed/raw/foundation/   (extracted CSVs)
  data-pipeline/seed/raw/sr_legacy/    (extracted CSVs)
"""
from __future__ import annotations

import io
import os
import re
import sys
import zipfile
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

DOWNLOAD_PAGE = "https://fdc.nal.usda.gov/download-datasets"
USER_AGENT = "UltimateFitBuddy/0.1 (+https://github.com/jonatanriise; alpha build)"

ROOT = Path(__file__).parent
RAW_DIR = ROOT / "seed" / "raw"


def find_zip_url(html: str, fragment: str) -> Optional[str]:
    """Return the first href in the page that points to a zip whose URL contains <fragment>."""
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if fragment in href and href.endswith(".zip"):
            if href.startswith("/"):
                href = "https://fdc.nal.usda.gov" + href
            return href
    return None


def fetch_index() -> str:
    print(f"Fetching {DOWNLOAD_PAGE}")
    r = requests.get(DOWNLOAD_PAGE, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    return r.text


def download_and_extract(url: str, target: Path) -> None:
    print(f"Downloading {url}")
    target.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, stream=True, timeout=120)
    r.raise_for_status()
    buf = io.BytesIO()
    for chunk in r.iter_content(chunk_size=1 << 16):
        buf.write(chunk)
    print(f"  {buf.tell() // 1024} KB downloaded")
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        zf.extractall(target)
    print(f"  extracted to {target}")


def main() -> int:
    html = fetch_index()

    foundation_url = find_zip_url(html, "foundation_food_csv")
    legacy_url = find_zip_url(html, "sr_legacy_food_csv")

    if not foundation_url:
        print("ERROR: could not find Foundation Foods CSV zip on the download page", file=sys.stderr)
        return 2
    if not legacy_url:
        print("ERROR: could not find SR Legacy CSV zip on the download page", file=sys.stderr)
        return 2

    download_and_extract(foundation_url, RAW_DIR / "foundation")
    download_and_extract(legacy_url, RAW_DIR / "sr_legacy")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
