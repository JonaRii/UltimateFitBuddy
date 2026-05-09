# Mac handoff — first build

This is a checklist for the Mac side. Goal: take you from "freshly cloned repo on the Mac" to "alpha app installed on your iPhone" with as little manual work as possible.

## 0. Prerequisites

- macOS with the latest stable Xcode installed (App Store).
- Your iPhone, the Lightning/USB-C cable.
- Your free Apple ID signed in to Xcode (`Xcode → Settings → Accounts`).
- Homebrew (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`).

## 1. Sync the project to the Mac

If you used iCloud Drive or git, just open the project on the Mac. Otherwise, copy the `UltimateFitBuddy/` folder over (rsync, AirDrop the zip, USB).

## 2. Install tools (one-time)

```bash
brew install xcodegen python@3.12
```

## 3. Build the food seed database

This runs locally on the Mac. The download is ~150-300 MB; the resulting bundled SQLite is ~10-20 MB.

```bash
cd UltimateFitBuddy/data-pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_usda.py
python build_seed_db.py
```

The script writes `seed/usda_seed.sqlite` and copies it into `../UltimateFitBuddy/Resources/usda_seed.sqlite`. That file gets bundled with the app.

If anything fails here, the app will still build — `SeedDataService` falls back to a much smaller hard-coded set of common foods.

## 4. Generate the Xcode project

```bash
cd ..  # back to repo root
xcodegen generate
```

This produces `UltimateFitBuddy.xcodeproj`. The `.xcodeproj` is gitignored — it gets regenerated on demand.

## 5. Open and configure signing

```bash
open UltimateFitBuddy.xcodeproj
```

In Xcode:
1. Click the project in the navigator → select the `UltimateFitBuddy` target → `Signing & Capabilities`.
2. Set **Team** to your personal Apple ID (free).
3. **Bundle Identifier** is `com.jonatanriise.fitbuddy`. Change the prefix if Xcode complains it's taken (try `com.jonatanriise.fitbuddy.dev`).
4. **Capabilities present** in the entitlements:
   - HealthKit
   - iCloud (CloudKit)
   - Background modes (workout sessions)
   
   If iCloud throws errors with a free Apple ID (it sometimes does — paid accounts are technically required for some CloudKit features), **remove the iCloud capability** and the app falls back to local-only SwiftData. See "Known free-tier issues" below.

## 6. Build & run on simulator first

Cmd+R with an iPhone simulator selected. Verify:
- All four tabs load.
- Dashboard shows zeroed-out widgets.
- You can tap "Start workout" and log a fake set.
- Food search returns bundled USDA results.

## 7. Run on your iPhone

1. Plug in the phone.
2. Trust this computer if prompted on the phone.
3. Select the phone from the device picker in Xcode.
4. Cmd+R. The first install takes a minute.
5. **On the phone**, go to `Settings → General → VPN & Device Management → Developer App`, and trust your Apple ID. Then re-launch.
6. The HealthKit permission sheet will appear on first use — grant the categories.

## 8. The 7-day cert reality

With a free Apple ID, the provisioning profile expires every 7 days. To re-sign:
- Plug the phone in.
- Open the project in Xcode.
- Cmd+R. Done.

If you want to lift this constraint, get a paid Apple Developer account ($99/year) and switch to TestFlight. The codebase is structured so that's a config change in `project.yml` and one capability tweak — no code rewrite.

## Known free-tier issues

| Symptom | Cause | Fix |
|---|---|---|
| `Couldn't enable iCloud capability` | Free Apple ID may lack CloudKit container creation | Remove iCloud capability; SwiftData uses local store only |
| `Provisioning profile doesn't include the HealthKit entitlement` | Stale profile | Xcode → Product → Clean Build Folder, then re-run |
| Push not allowed | Push requires paid account | We don't use push in alpha; ignore |
| App stops launching after 7 days | Cert expired | Re-run from Xcode |

## When something goes wrong

If you hit anything that's not in this doc, run a Claude Code session in `UltimateFitBuddy/` and the project's `ios-build` subagent (defined in `.claude/agents/ios-build.md`) knows how to drive `xcodebuild`, `simctl`, and `devicectl` from the command line.
