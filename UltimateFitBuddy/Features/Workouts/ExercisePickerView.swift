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
                    NavigationLink {
                        CustomExerciseEditor()
                    } label: {
                        Label("Create custom exercise", systemImage: "plus.circle")
                    }
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
                            HStack {
                                Text(ex.name).font(.headline).foregroundStyle(.primary)
                                if ex.isCustom {
                                    Text("CUSTOM")
                                        .font(.caption2.bold())
                                        .foregroundStyle(AppTheme.accent)
                                }
                            }
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

struct CustomExerciseEditor: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var primaryMuscle = MuscleGroup.chest.rawValue
    @State private var equipment = ExerciseEquipment.barbell.rawValue
    @State private var mechanic = "compound"

    var body: some View {
        Form {
            Section("Exercise") {
                TextField("Name", text: $name)
            }
            Section("Primary muscle") {
                Picker("Muscle", selection: $primaryMuscle) {
                    ForEach(MuscleGroup.allCases) { m in
                        Text(m.displayName).tag(m.rawValue)
                    }
                }
                .pickerStyle(.wheel)
                .frame(height: 120)
            }
            Section("Equipment") {
                Picker("Equipment", selection: $equipment) {
                    ForEach(ExerciseEquipment.allCases) { e in
                        Text(e.displayName).tag(e.rawValue)
                    }
                }
            }
            Section("Mechanic") {
                Picker("Mechanic", selection: $mechanic) {
                    Text("Compound").tag("compound")
                    Text("Isolation").tag("isolation")
                }
                .pickerStyle(.segmented)
            }
            Button("Save") { save() }
                .disabled(name.isEmpty)
        }
        .navigationTitle("Custom exercise")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func save() {
        let ex = Exercise(
            name: name,
            primaryMuscle: primaryMuscle,
            equipment: equipment,
            mechanic: mechanic,
            category: "strength",
            isCustom: true
        )
        modelContext.insert(ex)
        try? modelContext.save()
        dismiss()
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
