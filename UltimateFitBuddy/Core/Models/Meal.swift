import Foundation
import SwiftData

@Model
final class Meal: Identifiable {
    var id: UUID = UUID()
    var date: Date = Calendar.current.startOfDay(for: .now)
    var type: String = MealType.breakfast.rawValue

    @Relationship(deleteRule: .cascade, inverse: \FoodEntry.meal)
    var entries: [FoodEntry]? = []

    init(date: Date = Calendar.current.startOfDay(for: .now), type: MealType = .breakfast) {
        self.date = date
        self.type = type.rawValue
    }

    var mealType: MealType {
        MealType(rawValue: type) ?? .snack
    }

    var totalMacros: Macros {
        (entries ?? []).reduce(.zero) { $0 + $1.macros }
    }
}

enum MealType: String, CaseIterable, Identifiable, Codable {
    case breakfast, lunch, dinner, snack
    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
    var systemIcon: String {
        switch self {
        case .breakfast: "sun.horizon.fill"
        case .lunch: "sun.max.fill"
        case .dinner: "moon.stars.fill"
        case .snack: "carrot.fill"
        }
    }
}
