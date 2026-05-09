import Foundation
import SwiftData

@Model
final class ExerciseSet: Identifiable {
    var id: UUID = UUID()
    var exerciseId: UUID?
    var exerciseName: String = ""
    var session: WorkoutSession?
    var ordinal: Int = 0
    var reps: Int = 0
    var weightKg: Double = 0
    var rpe: Double?
    var isWarmup: Bool = false
    var isCompleted: Bool = false
    var restSeconds: Int?
    var performedAt: Date = Date.now

    init(
        exerciseId: UUID? = nil,
        exerciseName: String = "",
        ordinal: Int = 0,
        reps: Int = 0,
        weightKg: Double = 0,
        isWarmup: Bool = false
    ) {
        self.exerciseId = exerciseId
        self.exerciseName = exerciseName
        self.ordinal = ordinal
        self.reps = reps
        self.weightKg = weightKg
        self.isWarmup = isWarmup
    }

    var estimatedOneRepMaxKg: Double {
        guard reps > 0, weightKg > 0 else { return 0 }
        // Epley formula
        return weightKg * (1.0 + Double(reps) / 30.0)
    }
}
