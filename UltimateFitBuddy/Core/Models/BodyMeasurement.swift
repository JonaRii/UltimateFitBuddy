import Foundation
import SwiftData

@Model
final class BodyMeasurement: Identifiable {
    var id: UUID = UUID()
    var recordedAt: Date = Date.now
    var weightKg: Double = 0
    var bodyFatPct: Double = 0
    /// Optional named measurements (chest/waist/hips/arm/thigh/neck etc.)
    /// Stored alongside the legacy weight + bodyFat fields so existing data
    /// keeps working.
    var kind: String = "weight"
    var value: Double = 0
    var unit: String = "cm"
    var notes: String = ""

    init(
        weightKg: Double = 0,
        recordedAt: Date = .now,
        kind: String = "weight",
        value: Double = 0,
        unit: String = "kg"
    ) {
        self.weightKg = weightKg
        self.recordedAt = recordedAt
        self.kind = kind
        self.value = value
        self.unit = unit
    }
}

enum BodyMeasurementKind: String, CaseIterable, Identifiable {
    case weight, chest, waist, hips, arm, thigh, neck, bodyFat
    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .weight: "Weight"
        case .chest: "Chest"
        case .waist: "Waist"
        case .hips: "Hips"
        case .arm: "Arm"
        case .thigh: "Thigh"
        case .neck: "Neck"
        case .bodyFat: "Body fat"
        }
    }
    var unit: String {
        switch self {
        case .weight: "kg"
        case .bodyFat: "%"
        default: "cm"
        }
    }
}
