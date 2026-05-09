import Foundation
import SwiftData

@Model
final class FoodEntry: Identifiable {
    var id: UUID = UUID()
    var food: Food?
    var meal: Meal?
    var foodNameSnapshot: String = ""
    var brandSnapshot: String = ""
    var gramsConsumed: Double = 100
    var caloriesSnapshot: Double = 0
    var proteinSnapshot: Double = 0
    var carbsSnapshot: Double = 0
    var fatSnapshot: Double = 0
    var consumedAt: Date = Date.now

    init(food: Food? = nil, gramsConsumed: Double = 100) {
        self.food = food
        self.gramsConsumed = gramsConsumed
        if let food {
            self.foodNameSnapshot = food.name
            self.brandSnapshot = food.brand ?? ""
            let macros = food.macros(forGrams: gramsConsumed)
            self.caloriesSnapshot = macros.calories
            self.proteinSnapshot = macros.protein
            self.carbsSnapshot = macros.carbs
            self.fatSnapshot = macros.fat
        }
    }

    var macros: Macros {
        Macros(
            calories: caloriesSnapshot,
            protein: proteinSnapshot,
            carbs: carbsSnapshot,
            fat: fatSnapshot
        )
    }
}
