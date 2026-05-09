import SwiftUI
import SwiftData

struct ExercisePickerView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: [SortDescriptor(\Exercise.name)]) private var exercises: [Exercise]

    var onPick: (Exercise) -> Void

    @State private var query = ""
    @State private var selectedMuscle: String = "all"

    private var filteredExercises: [Exercise] {
        exercises.filter { ex in
            (query.isEmpty || ex.name.localizedCaseInsensitiveContains(query))
            && (selectedMuscle == "all" || ex.primaryMuscle == selectedMuscle)
        }
    }

    private var muscles: [String] {
        Array(Set(exercises.map { $0.primaryMuscle })).sorted()
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Muscle", selection: $selectedMuscle) {
                        Text("All").tag("all")
                        ForEach(muscles, id: \.self) { m in
                            Text(m.capitalized).tag(m)
                        }
                    }
                    .pickerStyle(.menu)
                }
                ForEach(filteredExercises) { ex in
                    Button {
                        onPick(ex)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(ex.name).font(.headline).foregroundStyle(.primary)
                            Text("\(ex.primaryMuscle.capitalized) · \(ex.equipment.capitalized)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: "Search exercises")
            .navigationTitle("Pick exercise")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

struct ExerciseLibraryView: View {
    @Query(sort: [SortDescriptor(\Exercise.name)]) private var exercises: [Exercise]
    @State private var query = ""

    private var filtered: [Exercise] {
        exercises.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        List(filtered) { ex in
            NavigationLink(destination: ExerciseProgressView(exercise: ex)) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(ex.name).font(.headline)
                    Text("\(ex.primaryMuscle.capitalized) · \(ex.equipment.capitalized)")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .searchable(text: $query, prompt: "Search exercises")
        .navigationTitle("Exercises")
    }
}
