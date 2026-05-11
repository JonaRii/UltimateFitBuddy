# Hosting plan

This is a single-user, no-backend, no-paid-account app. "Hosting" here means: how do I keep it running on my phone, where does my data live, and when is it worth spending money.

## Where everything lives

| Asset | Location | Backed up where |
|---|---|---|
| Source code | this repo (local + git remote) | git remote (GitHub) |
| Xcode project file | regenerated on demand by `xcodegen generate` | not backed up — it's a build artifact |
| Bundled food seed | `UltimateFitBuddy/Resources/usda_seed.sqlite` | reproducible from `data-pipeline/` scripts |
| App data on phone (workouts, meals, weights, body comp) | SwiftData on-device store | iCloud (if entitled) OR nowhere |
| HealthKit data (steps, weight, dietary energy, workouts) | Apple Health on-device | iCloud Health backup (free, automatic) |

**Rule of thumb**: HealthKit is your durable storage for anything Apple already tracks (weight, workouts, dietary energy). The SwiftData store is your durable storage for anything Apple doesn't (PRs, routines, recipes, body comp entries, water log).

## The free-tier reality (default plan)

You're running on a free Apple ID. Three constraints to live with:

1. **7-day re-sign cycle.** The provisioning profile expires every 7 days. Your installed app silently stops launching. Re-sign by plugging the phone in, opening the project, Cmd+R. Takes ~60 seconds.
2. **No CloudKit.** Free accounts often can't create CloudKit containers. SwiftData runs local-only. If you wipe the app or get a new phone, you lose everything not also in HealthKit.
3. **Sideload-only distribution.** No TestFlight, no App Store. Re-installing on a new phone means plugging it into the Mac and Cmd+R'ing.

### Mitigations

**Sunday-evening Cmd+R habit.** Pick a day, plug in, re-sign. If you forget, the app stops working until you do. No data is lost — the on-device store survives a re-sign.

**Write everything to HealthKit.** Already wired in. Means: even if the SwiftData store is wiped, your weights, workouts, and dietary energy are recoverable from Apple Health. PRs, exact set/rep history, recipes, and body-comp entries are *not* in HealthKit and *would* be lost.

**Manual export script (todo).** Add a "Settings → Export data" button that dumps the SwiftData store as JSON to the Files app. Run it monthly. Trivial to add — every model is `Codable`-friendly. Filed for v0.2.

**iCloud Drive folder for the export.** If you put the export JSON in `~/iCloud Drive/UltimateFitBuddy/`, Apple's iCloud syncs it across your devices for free, no CloudKit container needed. This is the "poor man's sync" until you upgrade to a paid account.

## When to upgrade to paid ($99/yr)

Upgrade when **any** of these become true:

- The 7-day cycle is annoying you more than $8/month is worth.
- You want to install on more than one device (iPad, second iPhone).
- You want a friend or family member to try it.
- You want CloudKit sync to "just work."
- You want to ship to the App Store eventually.

What changes when you upgrade:

| Thing | Free tier | Paid tier |
|---|---|---|
| Cert lifetime | 7 days | 1 year |
| TestFlight | no | yes (up to 10k testers) |
| Push notifications | no | yes |
| CloudKit containers | flaky | reliable |
| App Store distribution | no | yes |
| Code changes needed | — | none — just flip the team in `project.yml` and re-add the iCloud capability |

The codebase is already structured to flip this switch. Bundle id stays the same; entitlements file stays the same; you just stop manually re-signing.

## Backup discipline

**Weekly:** none required (the cert re-sign isn't a backup). Just plug in and Cmd+R.

**Monthly:** if/when the export feature ships, run it once a month. Save to `~/iCloud Drive/UltimateFitBuddy/` so it follows you.

**Phone replacement:** the on-device SwiftData store is gone. HealthKit data restores automatically from iCloud. To restore the rest, install the app on the new phone and re-import the most recent JSON export.

**Repo backup:** the git remote is your durable copy. Every commit pushes to it.

## Operational checks

Once a week:
- Open the app, log something, confirm it persists.
- If launch fails: re-sign (Cmd+R from Xcode).

Once a month:
- Pull main on the Mac; `xcodegen generate`; rebuild. Catches any drift.
- If you've added new `@Model` classes, verify CloudKit schema is happy (or shrug if you're local-only).
- Run the web prototype's smoke test as a sanity check — `cd web-prototype && node smoke.js` should still print "51 passed, 0 failed."

Once a quarter:
- Re-run `data-pipeline/download_usda.py && data-pipeline/build_seed_db.py` to refresh the food database. New entries appear; nothing breaks.
- Review `docs/ROADMAP.md` and reshuffle.

## Cost ledger

| Item | Cost | Why we're not paying |
|---|---|---|
| Apple Developer Program | $0 | free Apple ID is enough for one device |
| GitHub | $0 | personal repo, free runner minutes for public repos |
| App Store | $0 | not shipping |
| TestFlight | $0 | not shipping |
| CloudKit | $0 | not using (free tier doesn't reliably enable it anyway) |
| USDA / Open Food Facts | $0 | both are public-domain data |
| Hosting | $0 | the app is the host |

Total: $0/year for as long as you're willing to plug your phone in once a week.

## When this plan stops working

Triggers to revisit:

- **Multi-device demand**: you start using an iPad for tracking, or want it on a second phone. → Upgrade to paid.
- **Friends/family want it**: → Upgrade to paid; ship via TestFlight.
- **You miss a Sunday twice**: → Upgrade to paid (your time is worth more than $99/yr).
- **CloudKit sync becomes essential** (e.g. after a phone wipe loses data): → Upgrade to paid.
- **You want to charge money**: → Upgrade, set up the App Store, file taxes. Different game.

Until any of those, the plan is: build, sideload, re-sign weekly, push commits to the remote, and let HealthKit + iCloud Drive cover the backup story.
