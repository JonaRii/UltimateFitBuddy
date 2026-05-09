import SwiftUI
import SwiftData

struct WorkoutsTabView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor(\WorkoutSession.startedAt, order: .reverse)])
    private var workouts: [WorkoutSession]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink(destination: ActiveWorkoutView()) {
                        Label("Start empty workout", systemImage: "play.fill")
                            .foregroundStyle(AppTheme.accent)
                    }
                    NavigationLink(destination: ExerciseLibraryView()) {
                        Label("Exercise library", systemImage: "books.vertical")
                    }
                }
                Section("History") {
                    if workouts.isEmpty {
                        Text("No workouts logged yet")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(workouts) { w in
                            NavigationLink(destination: WorkoutDetailView(session: w)) {
                                WorkoutRowView(session: w)
                            }
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Workouts")
        }
    }

    private func delete(_ offsets: IndexSet) {
        for i in offsets {
            modelContext.delete(workouts[i])
        }
        try? modelContext.save()
    }
}

struct WorkoutRowView: View {
    let session: WorkoutSession
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(session.name.isEmpty ? "Workout" : session.name)
                .font(.headline)
            HStack {
                Text(session.startedAt, format: .dateTime.month(.abbreviated).day().hour().minute())
                Spacer()
                Text("\((session.sets ?? []).count) sets")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }
}
