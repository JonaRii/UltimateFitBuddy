import Foundation
import SwiftData

@Model
final class User: Identifiable {
    var id: UUID = UUID()
    var displayName: String = ""
    var birthdate: Date?
    var biologicalSex: String = ""
    var heightCm: Double = 0
    var weightKgGoal: Double = 0
    var calorieGoal: Int = 2200
    var proteinGoalG: Int = 160
    var carbsGoalG: Int = 220
    var fatGoalG: Int = 70
    var activityLevel: String = "moderate"
    var createdAt: Date = Date.now

    init(displayName: String = "") {
        self.displayName = displayName
    }
}
