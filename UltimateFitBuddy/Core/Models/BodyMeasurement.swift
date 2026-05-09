import Foundation
import SwiftData

@Model
final class BodyMeasurement: Identifiable {
    var id: UUID = UUID()
    var recordedAt: Date = Date.now
    var weightKg: Double = 0
    var bodyFatPct: Double = 0
    var notes: String = ""

    init(weightKg: Double = 0, recordedAt: Date = .now) {
        self.weightKg = weightKg
        self.recordedAt = recordedAt
    }
}
