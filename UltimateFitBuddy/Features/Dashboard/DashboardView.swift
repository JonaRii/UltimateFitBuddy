import SwiftUI
import SwiftData

struct DashboardView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(AppState.self) private var appState
    @Query private var users: [User]

    private var startOfDay: Date { Calendar.current.startOfDay(for: .now) }
    private var endOfDay: Date {
        Calendar.current.date(byAdding: .day, value: 1, to: startOfDay) ?? .now
    }

    @Query(sort: [SortDescriptor(\WorkoutSession.startedAt, order: .reverse)])
    private var allWorkouts: [WorkoutSession]

    @Query(sort: [SortDescriptor(\BodyMeasurement.recordedAt, order: .reverse)])
    private var bodyMeasurements: [BodyMeasurement]

    private var user: User? { users.first }

    private var todayMeals: [Meal] {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<Meal>(
            predicate: #Predicate { meal in
                meal.date >= start && meal.date < end
            }
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    private var todayMacros: Macros {
        todayMeals.reduce(.zero) { $0 + $1.totalMacros }
    }

    private var todayWorkout: WorkoutSession? {
        let start = startOfDay
        return allWorkouts.first { $0.startedAt >= start }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    headerCard
                    calorieMacroCard
                    workoutCard
                    healthKitCard
                    weightCard
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .navigationTitle("Today")
            .background(Color(.systemGroupedBackground))
            .refreshable { await appState.healthKit.refreshTodayMetrics() }
        }
    }

    private var headerCard: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(Date.now, format: .dateTime.weekday(.wide))
                    .font(.title2.bold())
                Text(Date.now, format: .dateTime.month(.wide).day())
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .card()
    }

    private var calorieMacroCard: some View {
        let goalCal = Double(user?.calorieGoal ?? 2200)
        let goalP = Double(user?.proteinGoalG ?? 160)
        let goalC = Double(user?.carbsGoalG ?? 220)
        let goalF = Double(user?.fatGoalG ?? 70)
        let m = todayMacros
        return VStack(alignment: .leading, spacing: 12) {
            Text("Calories & macros")
                .font(.headline)
            HStack(spacing: 24) {
                MacroRingView(
                    title: "kcal",
                    value: m.calories,
                    goal: goalCal,
                    color: AppTheme.caloriesColor,
                    size: 92
                )
                VStack(alignment: .leading, spacing: 8) {
                    macroBar(label: "Protein", value: m.protein, goal: goalP, color: AppTheme.proteinColor, unit: "g")
                    macroBar(label: "Carbs", value: m.carbs, goal: goalC, color: AppTheme.carbsColor, unit: "g")
                    macroBar(label: "Fat", value: m.fat, goal: goalF, color: AppTheme.fatColor, unit: "g")
                }
            }
        }
        .card()
    }

    private func macroBar(label: String, value: Double, goal: Double, color: Color, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label).font(.caption.bold())
                Spacer()
                Text("\(Int(value))/\(Int(goal)) \(unit)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            ProgressView(value: min(value / max(goal, 1), 1))
                .tint(color)
        }
    }

    private var workoutCard: some View {
        Group {
            if let w = todayWorkout {
                NavigationLink(destination: WorkoutDetailView(session: w)) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Today's workout").font(.headline)
                        Text(w.name.isEmpty ? "Workout" : w.name)
                            .font(.title3.bold())
                        Text("\((w.sets ?? []).count) sets · \(Int(w.totalVolumeKg)) kg total volume")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                }
                .buttonStyle(.plain)
            } else {
                NavigationLink(destination: ActiveWorkoutView()) {
                    HStack {
                        Image(systemName: "dumbbell.fill")
                        Text("Start a workout")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(AppTheme.accent)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.cardCornerRadius))
                }
            }
        }
    }

    private var healthKitCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("From Apple Health").font(.headline)
            HStack(spacing: 24) {
                metric(value: "\(appState.healthKit.todaySteps)", label: "steps", icon: "figure.walk")
                metric(value: "\(Int(appState.healthKit.todayActiveEnergyKcal)) kcal", label: "active", icon: "flame.fill")
            }
        }
        .card()
    }

    private func metric(value: String, label: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Image(systemName: icon); Text(value).font(.headline) }
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }

    private var weightCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Body weight").font(.headline)
                Spacer()
                NavigationLink("Log", destination: BodyWeightLogView())
                    .font(.caption.bold())
            }
            if let latest = bodyMeasurements.first?.weightKg, latest > 0 {
                Text("\(latest, specifier: "%.1f") kg")
                    .font(.title2.bold())
                Text("Last logged \((bodyMeasurements.first?.recordedAt ?? .now).formatted(.relative(presentation: .named)))")
                    .font(.caption).foregroundStyle(.secondary)
            } else if let hk = appState.healthKit.latestWeightKg {
                Text("\(hk, specifier: "%.1f") kg")
                    .font(.title2.bold())
                Text("From Apple Health")
                    .font(.caption).foregroundStyle(.secondary)
            } else {
                Text("No weight logged yet").foregroundStyle(.secondary)
            }
        }
        .card()
    }
}

struct MacroRingView: View {
    let title: String
    let value: Double
    let goal: Double
    let color: Color
    let size: CGFloat

    var fraction: Double { min(value / max(goal, 1), 1) }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.2), lineWidth: 10)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(color, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(Int(value))").font(.headline.monospacedDigit())
                Text(title).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
    }
}

struct BodyWeightLogView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var weight: Double = 80

    var body: some View {
        Form {
            Section("Weight (kg)") {
                TextField("kg", value: $weight, format: .number)
                    .keyboardType(.decimalPad)
            }
            Button("Save") {
                let m = BodyMeasurement(weightKg: weight, recordedAt: .now)
                modelContext.insert(m)
                try? modelContext.save()
                Task { await appState.healthKit.saveBodyWeight(weight) }
                dismiss()
            }
        }
        .navigationTitle("Log weight")
    }
}
