import SwiftUI
import SwiftData

struct ActiveWorkoutView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    var seed: Routine? = nil

    @State private var session: WorkoutSession?
    @State private var showingExercisePicker = false
    @State private var showingPlateCalc = false
    @State private var showingSaveRoutine = false
    @State private var routineName: String = ""
    @State private var restSeconds: Int? = nil
    @State private var elapsedTimer: Timer?
    @State private var elapsed: TimeInterval = 0

    var body: some View {
        Group {
            if let session {
                workoutBody(session: session)
            } else {
                ProgressView()
                    .onAppear { startSession() }
            }
        }
        .navigationTitle("Active")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    Button("Save routine") { showingSaveRoutine = true }
                        .disabled(session == nil || (session?.sets ?? []).isEmpty)
                    Button("Finish") { finish() }
                        .disabled(session == nil)
                        .bold()
                }
            }
        }
        .alert("Save as routine", isPresented: $showingSaveRoutine) {
            TextField("Name", text: $routineName)
            Button("Save") { saveAsRoutine() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Save the exercise list of this workout for reuse.")
        }
        .onDisappear { elapsedTimer?.invalidate() }
        .sheet(isPresented: $showingExercisePicker) {
            ExercisePickerView { exercise in
                addExercise(exercise)
            }
        }
        .sheet(isPresented: $showingPlateCalc) {
            PlateCalculatorView()
        }
        .overlay(alignment: .bottom) {
            if let s = restSeconds {
                RestTimerOverlay(seconds: s) { restSeconds = nil }
                    .padding()
            }
        }
    }

    @ViewBuilder
    private func workoutBody(session: WorkoutSession) -> some View {
        let groups = session.setsByExercise
        List {
            Section {
                HStack {
                    VStack(alignment: .leading) {
                        TextField("Workout name", text: Binding(
                            get: { session.name },
                            set: { session.name = $0 }
                        ))
                        .font(.headline)
                        Text(formatElapsed(elapsed))
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { showingPlateCalc = true } label: {
                        Image(systemName: "function").imageScale(.large)
                    }
                }
            }
            ForEach(groups, id: \.exerciseId) { group in
                Section(header: Text(group.exerciseName).font(.headline)) {
                    ForEach(group.sets) { set in
                        SetRowView(set: set, onComplete: {
                            set.isCompleted = true
                            try? modelContext.save()
                            restSeconds = 90
                        })
                    }
                    Button {
                        addSet(to: session, exerciseId: group.exerciseId, exerciseName: group.exerciseName)
                    } label: {
                        Label("Add set", systemImage: "plus.circle")
                    }
                }
            }
            Section {
                Button {
                    showingExercisePicker = true
                } label: {
                    Label("Add exercise", systemImage: "plus")
                }
            }
        }
    }

    private func startSession() {
        let s = WorkoutSession(name: seed?.name ?? "", startedAt: .now)
        modelContext.insert(s)
        if let seed {
            // Seed empty sets in routine order
            let descriptor = FetchDescriptor<Exercise>()
            let exercises = (try? modelContext.fetch(descriptor)) ?? []
            for (idx, exId) in seed.exerciseOrder.enumerated() {
                guard let ex = exercises.first(where: { $0.id == exId }) else { continue }
                let set = ExerciseSet(
                    exerciseId: ex.id, exerciseName: ex.name,
                    ordinal: idx, reps: 0, weightKg: 0
                )
                set.session = s
                modelContext.insert(set)
            }
        }
        try? modelContext.save()
        session = s
        routineName = seed?.name ?? ""
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsed = Date.now.timeIntervalSince(s.startedAt)
        }
    }

    private func saveAsRoutine() {
        guard let session, !(session.sets ?? []).isEmpty else { return }
        let groups = session.setsByExercise
        let routine = Routine(
            name: routineName.isEmpty ? (session.name.isEmpty ? "Routine" : session.name) : routineName,
            exerciseOrder: groups.map { $0.exerciseId },
            exerciseNames: groups.map { $0.exerciseName }
        )
        modelContext.insert(routine)
        try? modelContext.save()
    }

    private func addExercise(_ exercise: Exercise) {
        guard let session else { return }
        let nextOrdinal = (session.sets ?? []).filter { $0.exerciseId == exercise.id }.count
        let set = ExerciseSet(
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            ordinal: nextOrdinal,
            reps: 0,
            weightKg: 0
        )
        set.session = session
        modelContext.insert(set)
        try? modelContext.save()
    }

    private func addSet(to session: WorkoutSession, exerciseId: UUID, exerciseName: String) {
        let nextOrdinal = (session.sets ?? []).filter { $0.exerciseId == exerciseId }.count
        let lastSet = (session.sets ?? [])
            .filter { $0.exerciseId == exerciseId }
            .sorted { $0.ordinal < $1.ordinal }
            .last
        let set = ExerciseSet(
            exerciseId: exerciseId,
            exerciseName: exerciseName,
            ordinal: nextOrdinal,
            reps: lastSet?.reps ?? 0,
            weightKg: lastSet?.weightKg ?? 0
        )
        set.session = session
        modelContext.insert(set)
        try? modelContext.save()
    }

    private func finish() {
        guard let session else { return }
        session.endedAt = .now
        try? modelContext.save()
        // Persist a workout sample to HealthKit (best-effort)
        Task {
            await appState.healthKit.saveWorkout(
                start: session.startedAt,
                end: session.endedAt ?? .now,
                totalEnergyKcal: nil
            )
        }
        elapsedTimer?.invalidate()
        dismiss()
    }

    private func formatElapsed(_ t: TimeInterval) -> String {
        let s = Int(t)
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}

struct SetRowView: View {
    @Bindable var set: ExerciseSet
    var isPR: Bool = false
    var onComplete: () -> Void

    private var badgeText: String {
        set.isWarmup ? "W" : "\(set.ordinal + 1)"
    }

    private var badgeColor: Color {
        if set.isWarmup { return AppTheme.warning }
        if set.isCompleted { return AppTheme.accent }
        return Color.gray.opacity(0.2)
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .topTrailing) {
                Text(badgeText)
                    .font(.caption.bold())
                    .frame(width: 24, height: 24)
                    .background(badgeColor)
                    .foregroundStyle((set.isCompleted || set.isWarmup) ? .white : .primary)
                    .clipShape(Circle())
                    .onTapGesture {
                        set.isWarmup.toggle()
                    }
                if isPR && set.isCompleted {
                    Text("★")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.black)
                        .frame(width: 14, height: 14)
                        .background(AppTheme.warning)
                        .clipShape(Circle())
                        .offset(x: 6, y: -6)
                }
            }

            HStack(spacing: 4) {
                TextField("kg", value: $set.weightKg, format: .number)
                    .keyboardType(.decimalPad)
                    .frame(width: 60)
                    .multilineTextAlignment(.trailing)
                Text("kg").font(.caption).foregroundStyle(.secondary)
            }

            HStack(spacing: 4) {
                TextField("reps", value: $set.reps, format: .number)
                    .keyboardType(.numberPad)
                    .frame(width: 50)
                    .multilineTextAlignment(.trailing)
                Text("reps").font(.caption).foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                onComplete()
            } label: {
                Image(systemName: set.isCompleted ? "checkmark.circle.fill" : "circle")
                    .imageScale(.large)
                    .foregroundStyle(set.isCompleted ? AppTheme.accent : .secondary)
            }
            .buttonStyle(.plain)
        }
    }
}
