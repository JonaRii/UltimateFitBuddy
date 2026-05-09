import Foundation
import SwiftData

@Model
final class Food: Identifiable {
    var id: UUID = UUID()
    var externalId: String?
    var source: String = "custom"
    var name: String = ""
    var brand: String?
    var barcode: String?
    var caloriesPer100g: Double = 0
    var proteinPer100g: Double = 0
    var carbsPer100g: Double = 0
    var fatPer100g: Double = 0
    var fiberPer100g: Double = 0
    var sugarPer100g: Double = 0
    var sodiumMgPer100g: Double = 0
    var servingSizeG: Double = 100
    var servingDescription: String = "100 g"
    var createdAt: Date = Date.now

    init(name: String = "", source: String = "custom") {
        self.name = name
        self.source = source
    }

    func macros(forGrams grams: Double) -> Macros {
        let factor = grams / 100.0
        return Macros(
            calories: caloriesPer100g * factor,
            protein: proteinPer100g * factor,
            carbs: carbsPer100g * factor,
            fat: fatPer100g * factor,
            fiber: fiberPer100g * factor
        )
    }
}

struct Macros: Equatable, Hashable {
    var calories: Double = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fat: Double = 0
    var fiber: Double = 0

    static let zero = Macros()

    static func + (lhs: Macros, rhs: Macros) -> Macros {
        Macros(
            calories: lhs.calories + rhs.calories,
            protein: lhs.protein + rhs.protein,
            carbs: lhs.carbs + rhs.carbs,
            fat: lhs.fat + rhs.fat,
            fiber: lhs.fiber + rhs.fiber
        )
    }
}
