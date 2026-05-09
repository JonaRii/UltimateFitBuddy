"""Build the bundled food seed from extracted USDA CSVs.

Reads:
  seed/raw/foundation/*.csv
  seed/raw/sr_legacy/*.csv

Writes:
  seed/usda_seed.sqlite       (full filtered set, ready to be wired up via sqlite3)
  seed/common_foods.json      (top ~1000 by USDA quality + name commonality, used as
                               the SwiftData first-launch import for searchable foods)

If the raw inputs are missing this script falls back to writing only the
hand-curated `common_foods.json` from `seed/curated_common_foods.json`,
so the iOS app always has *some* seed.
"""
from __future__ import annotations

import csv
import json
import os
import shutil
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent
RAW_DIR = ROOT / "seed" / "raw"
OUT_DIR = ROOT / "seed"
APP_BUNDLE_RESOURCES = ROOT.parent / "UltimateFitBuddy" / "Resources"

# USDA nutrient IDs we care about.
NUTRIENT_IDS = {
    1008: "calories",   # Energy (kcal)
    1003: "protein",    # Protein (g)
    1005: "carbs",      # Carbohydrate, by difference (g)
    1004: "fat",        # Total fat (g)
    1079: "fiber",      # Fiber, total dietary (g)
    2000: "sugar",      # Sugars, total
    1093: "sodium",     # Sodium (mg)
}


def find_csv(parent: Path, name: str) -> Path | None:
    """Recursively find a CSV by basename inside the extracted USDA tree."""
    for p in parent.rglob(name):
        return p
    return None


def load_dataset(parent: Path, source_label: str) -> list[dict]:
    food_csv = find_csv(parent, "food.csv")
    nutrient_csv = find_csv(parent, "food_nutrient.csv")
    if not food_csv or not nutrient_csv:
        print(f"  skipping {parent} — missing food.csv or food_nutrient.csv")
        return []

    print(f"  reading {food_csv.name} from {parent}")
    foods: dict[int, dict] = {}
    with food_csv.open(encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            try:
                fdc_id = int(row["fdc_id"])
            except (KeyError, ValueError):
                continue
            description = (row.get("description") or "").strip()
            if not description:
                continue
            foods[fdc_id] = {
                "fdc_id": fdc_id,
                "name": description,
                "category": (row.get("food_category_id") or "").strip(),
                "source": source_label,
            }

    print(f"  reading {nutrient_csv.name} ({len(foods)} foods to enrich)")
    by_food: dict[int, dict[str, float]] = defaultdict(dict)
    with nutrient_csv.open(encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            try:
                fdc_id = int(row["fdc_id"])
                nutrient_id = int(row["nutrient_id"])
                amount = float(row["amount"] or 0)
            except (KeyError, ValueError):
                continue
            if nutrient_id in NUTRIENT_IDS and fdc_id in foods:
                by_food[fdc_id][NUTRIENT_IDS[nutrient_id]] = amount

    out = []
    for fdc_id, food in foods.items():
        macros = by_food.get(fdc_id, {})
        if not macros.get("calories"):
            continue
        merged = {**food, **{k: macros.get(k, 0.0) for k in NUTRIENT_IDS.values()}}
        out.append(merged)
    print(f"  retained {len(out)} foods with calorie data from {source_label}")
    return out


def write_sqlite(rows: list[dict], path: Path) -> None:
    print(f"Writing SQLite to {path}")
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE foods (
            fdc_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            source TEXT,
            category TEXT,
            calories REAL,
            protein REAL,
            carbs REAL,
            fat REAL,
            fiber REAL,
            sugar REAL,
            sodium REAL
        );
        CREATE VIRTUAL TABLE foods_fts USING fts5(name, content='foods', content_rowid='fdc_id');
        """
    )
    cur.executemany(
        """INSERT INTO foods (fdc_id, name, source, category, calories, protein, carbs, fat, fiber, sugar, sodium)
        VALUES (:fdc_id, :name, :source, :category, :calories, :protein, :carbs, :fat, :fiber, :sugar, :sodium)""",
        rows,
    )
    cur.execute("INSERT INTO foods_fts(rowid, name) SELECT fdc_id, name FROM foods;")
    conn.commit()
    conn.close()
    print(f"  wrote {path.stat().st_size // 1024} KB")


def write_common_json(rows: list[dict], path: Path, limit: int = 1000) -> None:
    """Pick a manageable subset for first-launch SwiftData import."""
    # Heuristic: prefer Foundation Foods (lab-analyzed), then SR Legacy. Within
    # each, prefer shorter, more-common names ("Chicken, breast, raw" beats
    # "Chicken, broiler or fryers, breast, meat only, raw").
    rows = sorted(
        rows,
        key=lambda r: (
            0 if r["source"] == "foundation" else 1,
            len(r["name"]),
            r["name"],
        ),
    )
    seen_names: set[str] = set()
    out = []
    for r in rows:
        key = r["name"].split(",")[0].strip().lower()
        if key in seen_names:
            continue
        seen_names.add(key)
        out.append(
            {
                "externalId": str(r["fdc_id"]),
                "source": "usda",
                "name": r["name"],
                "caloriesPer100g": r["calories"],
                "proteinPer100g": r["protein"],
                "carbsPer100g": r["carbs"],
                "fatPer100g": r["fat"],
                "fiberPer100g": r["fiber"],
                "sugarPer100g": r["sugar"],
                "sodiumMgPer100g": r["sodium"] * 1000,
                "servingSizeG": 100,
                "servingDescription": "100 g",
            }
        )
        if len(out) >= limit:
            break
    path.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(out)} common foods to {path}")


def fallback_curated() -> list[dict]:
    p = ROOT / "seed" / "curated_common_foods.json"
    if not p.exists():
        return []
    return json.loads(p.read_text())


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    APP_BUNDLE_RESOURCES.mkdir(parents=True, exist_ok=True)

    rows = []
    rows += load_dataset(RAW_DIR / "foundation", "foundation")
    rows += load_dataset(RAW_DIR / "sr_legacy", "sr_legacy")

    if not rows:
        print("USDA raw data not present — using curated fallback only.")
        curated = fallback_curated()
        if not curated:
            print("ERROR: no curated fallback at seed/curated_common_foods.json", file=sys.stderr)
            return 2
        out_json = OUT_DIR / "common_foods.json"
        out_json.write_text(json.dumps(curated, indent=2))
    else:
        sqlite_path = OUT_DIR / "usda_seed.sqlite"
        write_sqlite(rows, sqlite_path)
        write_common_json(rows, OUT_DIR / "common_foods.json")
        # Copy SQLite into the app bundle resources
        shutil.copy2(sqlite_path, APP_BUNDLE_RESOURCES / "usda_seed.sqlite")

    # Always copy the JSON into the app bundle
    shutil.copy2(OUT_DIR / "common_foods.json", APP_BUNDLE_RESOURCES / "common_foods.json")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
