import SwiftUI
import SwiftData

struct RoutinesListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor(\Routine.createdAt, order: .reverse)])
    private var routines: [Routine]

    @State private var startingRoutine: Routine?

    var body: some View {
        List {
            if routines.isEmpty {
                ContentUnavailableView(
                    "No routines yet",
                    systemImage: "list.bullet.rectangle",
                    description: Text("Save the next workout as a routine to reuse it later.")
                )
            } else {
                ForEach(routines) { r in
                    Button {
                        startingRoutine = r
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.name.isEmpty ? "Routine" : r.name).font(.headline)
                            Text("\(r.exerciseOrder.count) exercises")
                                .font(.caption).foregroundStyle(.secondary)
                            if !r.notes.isEmpty {
                                Text(r.notes).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .onDelete(perform: delete)
            }
        }
        .navigationTitle("Routines")
        .sheet(item: $startingRoutine) { r in
            NavigationStack {
                ActiveWorkoutView(seed: r)
            }
        }
    }

    private func delete(_ offsets: IndexSet) {
        for i in offsets {
            modelContext.delete(routines[i])
        }
        try? modelContext.save()
    }
}
