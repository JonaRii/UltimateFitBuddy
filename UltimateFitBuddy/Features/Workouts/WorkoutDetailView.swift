import SwiftUI
import SwiftData

struct WorkoutDetailView: View {
    @Bindable var session: WorkoutSession

    var body: some View {
        List {
            Section {
                LabeledContent("Started", value: session.startedAt.formatted(.dateTime.month().day().hour().minute()))
                if let end = session.endedAt {
                    LabeledContent("Ended", value: end.formatted(.dateTime.hour().minute()))
                    LabeledContent("Duration", value: formatDuration(session.durationSeconds))
                }
                LabeledContent("Total volume", value: "\(Int(session.totalVolumeKg)) kg")
            }
            ForEach(session.setsByExercise, id: \.exerciseId) { group in
                Section(group.exerciseName) {
                    ForEach(group.sets) { set in
                        HStack {
                            Text("Set \(set.ordinal + 1)")
                                .font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text("\(Int(set.weightKg)) kg × \(set.reps)")
                                .font(.body.monospacedDigit())
                            if set.isCompleted {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(AppTheme.accent)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(session.name.isEmpty ? "Workout" : session.name)
    }

    private func formatDuration(_ t: TimeInterval) -> String {
        let s = Int(t)
        return String(format: "%dh %02dm", s / 3600, (s % 3600) / 60)
    }
}
