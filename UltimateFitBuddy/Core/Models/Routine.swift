import Foundation
import SwiftData

@Model
final class Routine: Identifiable {
    var id: UUID = UUID()
    var name: String = ""
    var notes: String = ""
    var exerciseOrder: [UUID] = []
    var createdAt: Date = Date.now

    init(name: String = "") {
        self.name = name
    }
}
