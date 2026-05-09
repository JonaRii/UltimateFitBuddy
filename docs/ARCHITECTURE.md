# Architecture

Single-process iOS app, no server, no auth.

## Layers

```
┌──────────────────────────────────────────────────────────┐
│                     SwiftUI Views                         │
│   Dashboard / Workouts / Nutrition / Profile              │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────┴─────────────────────────────────────┐
│                    Services (actors)                      │
│   HealthKitService  FoodSearchService  BarcodeService     │
│   SeedDataService                                         │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────┴─────────────────────────────────────┐
│              SwiftData ModelContainer                     │
│   User · Exercise · Routine · WorkoutSession · Set        │
│   Food · FoodEntry · Meal · BodyMeasurement               │
└────────────────────┬─────────────────────────────────────┘
                     │
              ┌──────┴──────┐
              │             │
     ┌────────┴───┐  ┌──────┴──────┐
     │ Local SQLite│  │  CloudKit   │
     │ (always)    │  │ (if entitled)│
     └─────────────┘  └─────────────┘
```

## Data sources

- **Bundled USDA seed** (`Resources/usda_seed.sqlite`): read-only SQLite shipped in the app bundle. ~5-10k high-quality foods. `SeedDataService` imports rows lazily as users search.
- **Open Food Facts API** (runtime): hit `world.openfoodfacts.org/api/v2/product/<barcode>.json` on barcode scan. If found, materialise a `Food` row in SwiftData and cache for offline.
- **HealthKit**: read-only stream of steps, active energy, body mass, dietary energy. Write workouts and dietary entries when the user logs.

## Why SwiftData + CloudKit (not Core Data + custom sync)

- SwiftData's CloudKit integration is automatic for `@Model` types matching CloudKit's constraints (no required relationships, no unique constraints, all properties optional or with defaults).
- Models in `Core/Models/` follow those constraints — relationships are optional, every scalar has a default.
- This lets the same `@Model` file drive both local persistence and cross-device sync with no extra code.

## CloudKit sync model

- **Private database only** (no shared, no public). Single user.
- Conflict resolution: last-writer-wins (SwiftData default).
- Entitlement is best-effort: if the iCloud capability isn't granted (free Apple ID quirk), `ModelContainer+Setup.swift` falls back to a local-only configuration. The user sees no difference except sync stops.

## HealthKit boundary

- `HealthKitService` is a `@MainActor` class wrapping `HKHealthStore`.
- Reads happen on app foreground (steps, active energy, weight) and on dashboard refresh.
- Writes happen at workout-end (HKWorkout sample) and food-log-tap (HKQuantitySample for dietary energy/protein/carbs/fat).
- All HealthKit categories we touch are declared in `Info.plist` and the entitlements file.

## Threading

- SwiftUI views observe SwiftData via `@Query`. No manual fetching in views.
- Background work (USDA seed import on first launch, OFF API calls) runs in actor-isolated services and writes back through a `ModelContext` on `MainActor`.

## What's deferred

- Watch app (HealthKit live workout sessions during lifting).
- Recipe builder (composite Food rows).
- Workout templates / programs (Routine model exists but UI deferred).
- Charts beyond per-exercise PR line.
- Multi-user / sharing.
