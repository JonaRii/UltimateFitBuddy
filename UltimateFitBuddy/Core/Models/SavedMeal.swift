import Foundation
import SwiftData

@Model
final class SavedMeal: Identifiable {
    var id: UUID = UUID()
    var name: String = ""
    /// Parallel arrays: `foodIds[i]` matches `gramsList[i]`.
    var foodIds: [UUID] = []
    var gramsList: [Double] = []
    var createdAt: Date = Date.now

    init(name: String = "") { self.name = name }
}
