import Foundation
import SwiftData

@Model
final class WorkoutSession: Identifiable {
    var id: UUID = UUID()
    var startedAt: Date = Date.now
    var endedAt: Date?
    var name: String = ""
    var notes: String = ""

    @Relationship(deleteRule: .cascade, inverse: \ExerciseSet.session)
    var sets: [ExerciseSet]? = []

    init(name: String = "", startedAt: Date = .now) {
        self.name = name
        self.startedAt = startedAt
    }

    var durationSeconds: TimeInterval {
        let end = endedAt ?? .now
        return end.timeIntervalSince(startedAt)
    }

    var totalVolumeKg: Double {
        (sets ?? []).reduce(0) { $0 + (Double($1.reps) * $1.weightKg) }
    }

    var setsByExercise: [(exerciseId: UUID, exerciseName: String, sets: [ExerciseSet])] {
        let grouped = Dictionary(grouping: sets ?? []) { $0.exerciseId ?? UUID() }
        return grouped
            .map { (id, sets) -> (UUID, String, [ExerciseSet]) in
                let sorted = sets.sorted { $0.ordinal < $1.ordinal }
                let name = sorted.first?.exerciseName ?? ""
                return (id, name, sorted)
            }
            .sorted { ($0.2.first?.performedAt ?? .now) < ($1.2.first?.performedAt ?? .now) }
            .map { (exerciseId: $0.0, exerciseName: $0.1, sets: $0.2) }
    }
}
