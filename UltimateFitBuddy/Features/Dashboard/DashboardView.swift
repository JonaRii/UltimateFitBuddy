import SwiftUI
import SwiftData
import Charts

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

    private var todayWaterMl: Int {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<WaterEntry>(
            predicate: #Predicate { $0.consumedAt >= start && $0.consumedAt < end }
        )
        return (try? modelContext.fetch(descriptor))?.reduce(0) { $0 + $1.ml } ?? 0
    }

    private var todayCardioKcal: Int {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<CardioEntry>(
            predicate: #Predicate { $0.performedAt >= start && $0.performedAt < end }
        )
        return (try? modelContext.fetch(descriptor))?.reduce(0) { $0 + $1.caloriesBurned } ?? 0
    }

    private var streakDays: Int {
        // Consecutive days back from today with at least one meal entry.
        var count = 0
        let cal = Calendar.current
        var probe = cal.startOfDay(for: .now)
        while count < 365 {
            let next = cal.date(byAdding: .day, value: 1, to: probe) ?? probe
            let descriptor = FetchDescriptor<Meal>(
                predicate: #Predicate { $0.date >= probe && $0.date < next }
            )
            let meals = (try? modelContext.fetch(descriptor)) ?? []
            let hasFood = meals.contains { ($0.entries ?? []).isEmpty == false }
            if !hasFood { break }
            count += 1
            probe = cal.date(byAdding: .day, value: -1, to: probe) ?? probe
        }
        return count
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    headerCard
                    calorieMacroCard
                    quickStatsRow
                    workoutCard
                    healthKitCard
                    weightCard
                    calorieTrendCard
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .navigationTitle("Today")
            .background(Color(.systemGroupedBackground))
            .refreshable { await appState.healthKit.refreshTodayMetrics() }
        }
    }

    private var calorieTrendCard: some View {
        let goal = Double(user?.calorieGoal ?? 2200)
        let cal = Calendar.current
        let points: [(Date, Double)] = (0...6).reversed().compactMap { offset in
            let day = cal.date(byAdding: .day, value: -offset, to: cal.startOfDay(for: .now))!
            let next = cal.date(byAdding: .day, value: 1, to: day)!
            let descriptor = FetchDescriptor<Meal>(
                predicate: #Predicate { $0.date >= day && $0.date < next }
            )
            let meals = (try? modelContext.fetch(descriptor)) ?? []
            let total = meals.reduce(0.0) { $0 + $1.totalMacros.calories }
            return (day, total)
        }
        let hasData = points.contains { $0.1 > 0 }
        return Group {
            if hasData {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Calories — last 7 days").font(.headline)
                        Spacer()
                        let avg = points.filter { $0.1 > 0 }.reduce(0.0) { $0 + $1.1 } / Double(max(1, points.filter { $0.1 > 0 }.count))
                        Text("\(Int(avg)) avg")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    Chart {
                        ForEach(points, id: \.0) { day, value in
                            BarMark(
                                x: .value("Day", day, unit: .day),
                                y: .value("kcal", value)
                            )
                            .foregroundStyle(value > goal ? AppTheme.danger : AppTheme.accent)
                            .cornerRadius(4)
                        }
                        RuleMark(y: .value("Goal", goal))
                            .foregroundStyle(.secondary.opacity(0.5))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                            .annotation(position: .top, alignment: .trailing) {
                                Text("goal").font(.caption2).foregroundStyle(.secondary)
                            }
                    }
                    .frame(height: 160)
                    .chartXAxis {
                        AxisMarks(values: .stride(by: .day)) { value in
                            AxisValueLabel(format: .dateTime.weekday(.narrow))
                        }
                    }
                }
                .card()
            }
        }
    }

    private var quickStatsRow: some View {
        let goalWater = user?.waterGoalMl ?? 2500
        let streak = streakDays
        return HStack(spacing: 12) {
            statTile(
                icon: "drop.fill", color: AppTheme.fatColor,
                value: "\(todayWaterMl) ml", label: "of \(goalWater)"
            )
            statTile(
                icon: "flame.fill", color: AppTheme.warning,
                value: todayCardioKcal > 0 ? "+\(todayCardioKcal)" : "—",
                label: "cardio kcal"
            )
            statTile(
                icon: "calendar", color: AppTheme.accent,
                value: streak > 0 ? "\(streak)d" : "—",
                label: "streak"
            )
        }
    }

    private func statTile(icon: String, color: Color, value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon).foregroundStyle(color)
            Text(value).font(.title3.bold().monospacedDigit())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
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
