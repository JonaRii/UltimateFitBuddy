import Foundation
import SwiftData
import os

enum AppModelContainer {
    static let logger = Logger(subsystem: "com.jonatanriise.fitbuddy", category: "modelcontainer")

    static let shared: SharedContainer = {
        SharedContainer()
    }()

    static var previewContainer: ModelContainer = {
        let schema = Schema(allModels)
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        // swiftlint:disable:next force_try
        return try! ModelContainer(for: schema, configurations: [config])
    }()

    static let allModels: [any PersistentModel.Type] = [
        User.self,
        Exercise.self,
        Routine.self,
        WorkoutSession.self,
        ExerciseSet.self,
        Food.self,
        FoodEntry.self,
        Meal.self,
        BodyMeasurement.self,
        WaterEntry.self,
        CardioEntry.self
    ]
}

final class SharedContainer {
    let container: ModelContainer
    let usesCloudKit: Bool

    init() {
        let schema = Schema(AppModelContainer.allModels)
        // First try a CloudKit-backed config. If anything fails (entitlement missing,
        // network unavailable on first launch, schema mismatch) fall back to local.
        let cloudConfig = ModelConfiguration(
            "FitBuddyCloud",
            schema: schema,
            isStoredInMemoryOnly: false,
            allowsSave: true,
            cloudKitDatabase: .private("iCloud.com.jonatanriise.fitbuddy")
        )
        let localConfig = ModelConfiguration(
            "FitBuddyLocal",
            schema: schema,
            isStoredInMemoryOnly: false,
            allowsSave: true,
            cloudKitDatabase: .none
        )

        do {
            self.container = try ModelContainer(for: schema, configurations: [cloudConfig])
            self.usesCloudKit = true
            AppModelContainer.logger.info("ModelContainer initialised with CloudKit private DB")
        } catch {
            AppModelContainer.logger.error("CloudKit container failed (\(error.localizedDescription, privacy: .public)) — falling back to local")
            do {
                self.container = try ModelContainer(for: schema, configurations: [localConfig])
                self.usesCloudKit = false
            } catch {
                fatalError("Could not create local ModelContainer: \(error)")
            }
        }
    }
}
