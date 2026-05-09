import Foundation
import SwiftData

@Model
final class CardioEntry: Identifiable {
    var id: UUID = UUID()
    var activity: String = "Running"
    var minutes: Int = 30
    var caloriesBurned: Int = 300
    var performedAt: Date = Date.now
    var notes: String = ""

    init(
        activity: String = "Running",
        minutes: Int = 30,
        caloriesBurned: Int = 300,
        performedAt: Date = .now
    ) {
        self.activity = activity
        self.minutes = minutes
        self.caloriesBurned = caloriesBurned
        self.performedAt = performedAt
    }
}
