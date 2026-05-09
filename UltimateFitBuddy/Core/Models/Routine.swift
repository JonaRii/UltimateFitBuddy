import Foundation
import SwiftData

@Model
final class Routine: Identifiable {
    var id: UUID = UUID()
    var name: String = ""
    var notes: String = ""
    var exerciseOrder: [UUID] = []
    var exerciseNames: [String] = []   // denormalized for display
    var createdAt: Date = Date.now

    init(name: String = "", exerciseOrder: [UUID] = [], exerciseNames: [String] = []) {
        self.name = name
        self.exerciseOrder = exerciseOrder
        self.exerciseNames = exerciseNames
    }
}
