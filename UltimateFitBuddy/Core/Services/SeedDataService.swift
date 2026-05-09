import Foundation
import SwiftData
import os

/// Loads bundled seed datasets on first launch:
/// - `exercises.json` → `Exercise` rows
/// - `usda_seed.sqlite` → `Food` rows (lazily; full import would balloon CloudKit churn)
///
/// On subsequent launches this service is a no-op.
enum SeedDataService {
    static let logger = Logger(subsystem: "com.jonatanriise.fitbuddy", category: "seed")

    static func bootstrap(context: ModelContext) {
        ensureUser(context: context)
        ensureExercises(context: context)
        ensureFoods(context: context)
        ensureFoodSeed(context: context)
    }

    // MARK: - User

    private static func ensureUser(context: ModelContext) {
        let descriptor = FetchDescriptor<User>()
        if (try? context.fetch(descriptor))?.isEmpty == false { return }
        context.insert(User(displayName: ""))
        try? context.save()
    }

    // MARK: - Exercises

    private static func ensureExercises(context: ModelContext) {
        let countDescriptor = FetchDescriptor<Exercise>()
        let existing = (try? context.fetch(countDescriptor)) ?? []
        if !existing.isEmpty { return }

        guard let url = Bundle.main.url(forResource: "exercises", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            logger.warning("exercises.json not bundled — seeding hard-coded fallback")
            for ex in fallbackExercises() {
                context.insert(ex)
            }
            try? context.save()
            return
        }

        do {
            let decoded = try JSONDecoder().decode([SeedExercise].self, from: data)
            for ex in decoded {
                let model = Exercise(
                    name: ex.name,
                    primaryMuscle: ex.primaryMuscle,
                    secondaryMuscles: ex.secondaryMuscles ?? [],
                    equipment: ex.equipment,
                    mechanic: ex.mechanic ?? "compound",
                    category: ex.category ?? "strength",
                    instructions: ex.instructions ?? ""
                )
                context.insert(model)
            }
            try context.save()
            logger.info("Seeded \(decoded.count) exercises")
        } catch {
            logger.error("Failed to seed exercises: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Foods (bundled JSON)

    private static func ensureFoods(context: ModelContext) {
        let countDescriptor = FetchDescriptor<Food>()
        let existing = (try? context.fetch(countDescriptor)) ?? []
        if !existing.isEmpty { return }

        guard let url = Bundle.main.url(forResource: "common_foods", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            logger.warning("common_foods.json not bundled — food search will rely on barcode scans")
            return
        }
        do {
            let decoded = try JSONDecoder().decode([SeedFood].self, from: data)
            for s in decoded {
                let food = Food(name: s.name, source: s.source ?? "curated")
                food.externalId = s.externalId
                food.caloriesPer100g = s.caloriesPer100g
                food.proteinPer100g = s.proteinPer100g
                food.carbsPer100g = s.carbsPer100g
                food.fatPer100g = s.fatPer100g
                food.fiberPer100g = s.fiberPer100g ?? 0
                food.sugarPer100g = s.sugarPer100g ?? 0
                food.sodiumMgPer100g = s.sodiumMgPer100g ?? 0
                food.servingSizeG = s.servingSizeG ?? 100
                food.servingDescription = s.servingDescription ?? "100 g"
                context.insert(food)
            }
            try context.save()
            logger.info("Seeded \(decoded.count) foods")
        } catch {
            logger.error("Failed to seed foods: \(error.localizedDescription, privacy: .public)")
        }
    }

    private struct SeedFood: Decodable {
        let externalId: String?
        let source: String?
        let name: String
        let caloriesPer100g: Double
        let proteinPer100g: Double
        let carbsPer100g: Double
        let fatPer100g: Double
        let fiberPer100g: Double?
        let sugarPer100g: Double?
        let sodiumMgPer100g: Double?
        let servingSizeG: Double?
        let servingDescription: String?
    }

    private struct SeedExercise: Decodable {
        let name: String
        let primaryMuscle: String
        let secondaryMuscles: [String]?
        let equipment: String
        let mechanic: String?
        let category: String?
        let instructions: String?
    }

    private static func fallbackExercises() -> [Exercise] {
        [
            Exercise(name: "Back Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "core"], equipment: "barbell", mechanic: "compound"),
            Exercise(name: "Deadlift", primaryMuscle: "hamstrings", secondaryMuscles: ["back", "glutes"], equipment: "barbell", mechanic: "compound"),
            Exercise(name: "Bench Press", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "barbell", mechanic: "compound"),
            Exercise(name: "Overhead Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps", "core"], equipment: "barbell", mechanic: "compound"),
            Exercise(name: "Pull-up", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "bodyweight", mechanic: "compound"),
            Exercise(name: "Barbell Row", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "barbell", mechanic: "compound"),
            Exercise(name: "Dumbbell Curl", primaryMuscle: "biceps", equipment: "dumbbell", mechanic: "isolation"),
            Exercise(name: "Triceps Pushdown", primaryMuscle: "triceps", equipment: "cable", mechanic: "isolation"),
            Exercise(name: "Plank", primaryMuscle: "core", equipment: "bodyweight", mechanic: "isolation"),
            Exercise(name: "Romanian Deadlift", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes"], equipment: "barbell", mechanic: "compound")
        ]
    }

    // MARK: - Food seed

    /// We do *not* import the entire USDA seed at launch — that would create
    /// thousands of CloudKit records the user might never use. Instead the
    /// bundled SQLite is queried directly via `BundledFoodSeed`, and a row
    /// is materialised into SwiftData only when the user actually logs it.
    private static func ensureFoodSeed(context: ModelContext) {
        BundledFoodSeed.shared.warmUp()
    }
}

/// Read-only access to the bundled USDA SQLite seed.
final class BundledFoodSeed {
    static let shared = BundledFoodSeed()
    private let logger = Logger(subsystem: "com.jonatanriise.fitbuddy", category: "bundledfoodseed")
    private(set) var available = false

    func warmUp() {
        guard let url = Bundle.main.url(forResource: "usda_seed", withExtension: "sqlite") else {
            logger.warning("usda_seed.sqlite not bundled — bundled food search disabled")
            available = false
            return
        }
        // We intentionally skip opening here — actual queries open & close per call
        // to keep things simple. Just confirm presence.
        available = FileManager.default.fileExists(atPath: url.path)
    }

    /// Stubbed search. The real implementation reads the bundled SQLite via
    /// `sqlite3` C API. For alpha, callers should rely on the SwiftData index
    /// of foods that have been logged at least once. Bundled-seed search will
    /// be wired up in a follow-up alongside the data pipeline.
    func search(_ query: String, limit: Int = 30) -> [SeedFoodRow] {
        // TODO: open `usda_seed.sqlite` via sqlite3 and FTS-match against name.
        // Returning empty for now keeps the app fully functional via OFF lookups
        // and manual entry until the C-bridge is wired.
        return []
    }
}

struct SeedFoodRow {
    let externalId: String
    let name: String
    let caloriesPer100g: Double
    let proteinPer100g: Double
    let carbsPer100g: Double
    let fatPer100g: Double
    let fiberPer100g: Double
}
