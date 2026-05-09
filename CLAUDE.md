# UltimateFitBuddy — project instructions

Personal iOS app to replace Strong (workout tracking) and MyFitnessPal (nutrition tracking) in one place. Loaded for any Claude Code session under `Personal/Code/UltimateFitBuddy/`.

## Decisions on file (do not re-litigate without explicit ask)

- **Platform:** native iOS, SwiftUI + SwiftData. Deployment target iOS 17.0 (SwiftData minimum). Single-user, single-device-primary.
- **Persistence:** SwiftData with optional CloudKit private-DB sync. Falls back to local-only if iCloud entitlement isn't available.
- **No backend.** "Hosted on the Mac" was clarified to mean Mac is dev machine only, not a server.
- **Apple developer account:** free Apple ID. Sideload via Xcode every 7 days. App must compile and run cleanly on a free-tier provisioning profile.
- **Food data:**
  - **Bundled seed:** USDA FoodData Central Foundation + SR Legacy, filtered subset, shipped as SQLite read-only inside the app bundle.
  - **Runtime barcode lookups:** Open Food Facts public REST API (`world.openfoodfacts.org/api/v2/product/<barcode>.json`), no auth.
- **Exercise data:** curated JSON in `data-pipeline/exercises/exercises.json`, loaded into SwiftData on first launch.
- **HealthKit:** read steps / active energy / body weight; write workouts + dietary energy + macros on log.

## Layout

```
UltimateFitBuddy/                  # Xcode app source (Swift)
  App/                             # @main, root scene, tab nav
  Core/
    Models/                        # @Model SwiftData entities
    Services/                      # HealthKit, food search, barcode, seed
    Persistence/                   # ModelContainer setup
    Theme/                         # colors, fonts, spacing
  Features/
    Dashboard/                     # today view
    Workouts/                      # log + history
    Nutrition/                     # search + log + scan
    Profile/                       # goals + permissions
  Resources/                       # Info.plist (generated), assets, seed files

data-pipeline/                     # Python — runs on any OS
  download_usda.py                 # pull USDA CSVs
  build_seed_db.py                 # filter + emit SQLite seed
  exercises/exercises.json         # curated exercise library
  seed/                            # build outputs

docs/
  HANDOFF.md                       # mechanical steps for the Mac
  ARCHITECTURE.md
  ROADMAP.md

project.yml                        # XcodeGen spec — generates UltimateFitBuddy.xcodeproj
.claude/
  agents/ios-build.md              # subagent for xcodebuild / simctl / devicectl on Mac
  settings.json                    # permissions for python pipeline + xcodebuild
```

## Conventions

- **Swift style:** standard SwiftUI idioms. View files end in `View.swift`. SwiftData models use `@Model` and live in `Core/Models/`. ViewModels are `@Observable` classes only when state is non-trivial; otherwise inline `@State` is fine.
- **One model per file.** Keep SwiftData entity definitions atomic — easier to reason about CloudKit schema migrations.
- **No third-party dependencies for MVP.** Everything we need is in the standard SDKs (SwiftUI, SwiftData, HealthKit, AVFoundation, Charts).
- **Async everywhere.** Network and HealthKit work goes through `async`/`await`; no completion handlers in new code.
- **Error handling:** surface user-facing errors via a single `AppErrorBanner` overlay. Background errors log to `os.Logger` only.

## Workflow split

- **Windows side (today):** scaffold all Swift, all Python, all docs, the XcodeGen spec, the seed datasets. No `xcodebuild` runs because there is no Xcode here.
- **Mac side (tomorrow):** install XcodeGen (`brew install xcodegen`), run `xcodegen generate`, open `UltimateFitBuddy.xcodeproj`, set the development team to your free Apple ID, plug in the iPhone, build & run. Detailed steps in `docs/HANDOFF.md`.

## Git

Delegate to `git-steward` per the parent `Personal/Code/CLAUDE.md`. Conventional Commits.

## Forbidden

- Web/Android/Watch companions in alpha. Do not scaffold them.
- A backend server. Doesn't exist; don't write code that talks to one.
- Login flows / accounts. Single user, no auth.
- Subscription/paywall code. The whole point is to not pay anything.
- Telemetry, analytics, crash reporting. Not in alpha.
