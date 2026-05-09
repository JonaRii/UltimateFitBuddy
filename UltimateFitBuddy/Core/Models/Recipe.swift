import Foundation
import SwiftData

@Model
final class Recipe: Identifiable {
    var id: UUID = UUID()
    var name: String = ""
    var servings: Int = 1
    var notes: String = ""
    // Parallel arrays — kept simple to avoid an extra @Model + relationship
    // for a personal-scope app. Index i in `foodIds` matches index i in
    // `gramsList`. Either both are populated or the recipe is empty.
    var foodIds: [UUID] = []
    var gramsList: [Double] = []
    var createdAt: Date = Date.now

    init(name: String = "", servings: Int = 1) {
        self.name = name
        self.servings = max(1, servings)
    }

    /// Computed per-serving macros given a foodLookup function.
    func perServing(foodFor: (UUID) -> Food?) -> Macros {
        var totals = Macros.zero
        for i in 0..<min(foodIds.count, gramsList.count) {
            guard let food = foodFor(foodIds[i]) else { continue }
            totals = totals + food.macros(forGrams: gramsList[i])
        }
        let s = max(1, servings)
        return Macros(
            calories: totals.calories / Double(s),
            protein: totals.protein / Double(s),
            carbs: totals.carbs / Double(s),
            fat: totals.fat / Double(s),
            fiber: totals.fiber / Double(s)
        )
    }
}
