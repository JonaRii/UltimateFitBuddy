import Foundation
import SwiftData

@Model
final class WaterEntry: Identifiable {
    var id: UUID = UUID()
    var ml: Int = 250
    var consumedAt: Date = Date.now

    init(ml: Int = 250, consumedAt: Date = .now) {
        self.ml = ml
        self.consumedAt = consumedAt
    }
}
