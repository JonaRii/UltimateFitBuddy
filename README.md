# UltimateFitBuddy

A personal iOS fitness app that replaces Strong (workout tracking) and MyFitnessPal (nutrition + macros) in a single native app. No subscription, no backend, no account. Local-first with iCloud sync.

## Status

Alpha scaffold. Built on Windows for handover to a Mac for the first build. See `docs/HANDOFF.md`.

## Stack

- SwiftUI + SwiftData (iOS 17+)
- HealthKit (read steps/weight/energy, write workouts + nutrition)
- AVFoundation (barcode scanner)
- USDA FoodData Central (bundled seed) + Open Food Facts API (barcode lookup)
- XcodeGen (project file generation)

## Getting started (on a Mac)

```bash
# one-time setup
brew install xcodegen python@3.12
cd UltimateFitBuddy

# build the food seed database
cd data-pipeline
pip install -r requirements.txt
python download_usda.py
python build_seed_db.py
cd ..

# generate the Xcode project
xcodegen generate

# open and run
open UltimateFitBuddy.xcodeproj
```

Then in Xcode: select the `UltimateFitBuddy` scheme, set the team to your free Apple ID under Signing & Capabilities, plug in your iPhone, and Run.

## What's in alpha

- [x] Workout logging (exercise → sets/reps/weight, rest timer, plate calculator)
- [x] Nutrition logging (search bundled foods, scan barcodes, daily macro totals)
- [x] Today dashboard (calories vs goal, macro rings, workout summary)
- [x] HealthKit integration (read & write)
- [x] iCloud sync (best-effort; falls back to local if entitlement unavailable)
- [ ] Recipe builder *(post-alpha)*
- [ ] Workout templates / programs *(post-alpha)*
- [ ] Apple Watch companion *(later)*
