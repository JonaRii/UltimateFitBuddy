import SwiftUI
import SwiftData

struct NutritionTabView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var users: [User]

    @State private var date: Date = Calendar.current.startOfDay(for: .now)
    @State private var addingTo: MealType?
    @State private var showingCardio = false

    private var startOfDay: Date { Calendar.current.startOfDay(for: date) }
    private var endOfDay: Date {
        Calendar.current.date(byAdding: .day, value: 1, to: startOfDay) ?? startOfDay
    }

    private var meals: [Meal] {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<Meal>(
            predicate: #Predicate { $0.date >= start && $0.date < end }
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    private var waterEntries: [WaterEntry] {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<WaterEntry>(
            predicate: #Predicate { $0.consumedAt >= start && $0.consumedAt < end },
            sortBy: [SortDescriptor(\WaterEntry.consumedAt)]
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    private var cardioEntries: [CardioEntry] {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<CardioEntry>(
            predicate: #Predicate { $0.performedAt >= start && $0.performedAt < end },
            sortBy: [SortDescriptor(\CardioEntry.performedAt)]
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    private var todayMacros: Macros {
        meals.reduce(.zero) { $0 + $1.totalMacros }
    }

    private var todayWaterMl: Int {
        waterEntries.reduce(0) { $0 + $1.ml }
    }

    private var todayCardioKcal: Int {
        cardioEntries.reduce(0) { $0 + $1.caloriesBurned }
    }

    private var user: User? { users.first }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    dailyTotalsCard
                    waterCard
                    cardioCard
                    ForEach(MealType.allCases) { type in
                        mealSection(for: type)
                    }
                }
                .padding(.horizontal)
            }
            .navigationTitle(navTitle)
            .background(Color(.systemGroupedBackground))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    DatePicker("", selection: $date, displayedComponents: .date)
                        .labelsHidden()
                }
            }
            .sheet(item: $addingTo) { type in
                AddFoodFlow(date: startOfDay, mealType: type) {
                    addingTo = nil
                }
            }
            .sheet(isPresented: $showingCardio) {
                CardioEntrySheet(date: startOfDay)
            }
        }
    }

    private var waterCard: some View {
        let goalMl = user?.waterGoalMl ?? 2500
        let glasses = todayWaterMl / 250
        let goalGlasses = max(1, goalMl / 250)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "drop.fill").foregroundStyle(AppTheme.fatColor)
                Text("Water").font(.headline)
                Spacer()
                Text("\(todayWaterMl) / \(goalMl) ml")
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                Button {
                    addWater(250)
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .imageScale(.large)
                        .foregroundStyle(AppTheme.accent)
                }
            }
            HStack(spacing: 6) {
                ForEach(0..<min(goalGlasses, 12), id: \.self) { i in
                    Image(systemName: i < glasses ? "drop.fill" : "drop")
                        .foregroundStyle(i < glasses ? AppTheme.fatColor : Color.gray.opacity(0.4))
                        .imageScale(.medium)
                        .onTapGesture { setWaterGlasses(i + 1) }
                }
            }
        }
        .card()
    }

    private var cardioCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "flame.fill").foregroundStyle(AppTheme.warning)
                Text("Cardio").font(.headline)
                Spacer()
                if !cardioEntries.isEmpty {
                    Text("+\(todayCardioKcal) kcal")
                        .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                }
                Button {
                    showingCardio = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .imageScale(.large)
                        .foregroundStyle(AppTheme.accent)
                }
            }
            if cardioEntries.isEmpty {
                Text("No cardio logged").font(.caption).foregroundStyle(.secondary)
            } else {
                ForEach(cardioEntries) { entry in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.activity).font(.subheadline)
                            Text("\(entry.minutes) min · +\(entry.caloriesBurned) kcal")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button(role: .destructive) {
                            modelContext.delete(entry)
                            try? modelContext.save()
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .foregroundStyle(AppTheme.danger)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .card()
    }

    private func addWater(_ ml: Int) {
        let entry = WaterEntry(ml: ml, consumedAt: .now)
        modelContext.insert(entry)
        try? modelContext.save()
    }

    private func setWaterGlasses(_ n: Int) {
        for entry in waterEntries {
            modelContext.delete(entry)
        }
        for _ in 0..<n {
            modelContext.insert(WaterEntry(ml: 250, consumedAt: .now))
        }
        try? modelContext.save()
    }

    private var navTitle: String {
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    private var dailyTotalsCard: some View {
        let goalCal = Double(user?.calorieGoal ?? 2200)
        let goalP = Double(user?.proteinGoalG ?? 160)
        let goalC = Double(user?.carbsGoalG ?? 220)
        let goalF = Double(user?.fatGoalG ?? 70)
        let m = todayMacros
        let adjustedGoal = goalCal + Double(todayCardioKcal)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(Int(m.calories))").font(.system(size: 36, weight: .bold))
                Text("/ \(Int(adjustedGoal)) kcal").foregroundStyle(.secondary)
                Spacer()
                Text("\(Int(max(0, adjustedGoal - m.calories))) left")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            }
            if todayCardioKcal > 0 {
                Text("+\(todayCardioKcal) kcal from cardio")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            HStack(spacing: 20) {
                MiniMacro(label: "P", value: m.protein, goal: goalP, color: AppTheme.proteinColor)
                MiniMacro(label: "C", value: m.carbs, goal: goalC, color: AppTheme.carbsColor)
                MiniMacro(label: "F", value: m.fat, goal: goalF, color: AppTheme.fatColor)
            }
        }
        .card()
    }

    private func mealSection(for type: MealType) -> some View {
        let meal = meals.first { $0.mealType == type }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: type.systemIcon)
                Text(type.displayName).font(.headline)
                Spacer()
                if let m = meal {
                    Text("\(Int(m.totalMacros.calories)) kcal")
                        .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                }
                Button {
                    addingTo = type
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .imageScale(.large)
                        .foregroundStyle(AppTheme.accent)
                }
            }
            if let entries = meal?.entries, !entries.isEmpty {
                ForEach(entries) { entry in
                    FoodEntryRowView(entry: entry, onDelete: { delete(entry) })
                }
            } else {
                Text("Empty").font(.caption).foregroundStyle(.secondary)
            }
        }
        .card()
    }

    private func delete(_ entry: FoodEntry) {
        modelContext.delete(entry)
        try? modelContext.save()
    }
}

struct MiniMacro: View {
    let label: String
    let value: Double
    let goal: Double
    let color: Color
    var body: some View {
        VStack(spacing: 4) {
            Text(label).font(.caption.bold()).foregroundStyle(color)
            Text("\(Int(value))/\(Int(goal))")
                .font(.caption.monospacedDigit())
        }
    }
}

struct CardioEntrySheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    let date: Date

    @State private var activity: String = "Running"
    @State private var minutes: Int = 30
    @State private var calories: Int = 300

    private let activities = [
        "Running", "Cycling", "Swimming", "Walking",
        "Hiking", "Rowing", "Elliptical", "HIIT", "Other"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Activity") {
                    Picker("Activity", selection: $activity) {
                        ForEach(activities, id: \.self) { a in
                            Text(a).tag(a)
                        }
                    }
                }
                Section {
                    HStack {
                        Text("Duration")
                        Spacer()
                        TextField("min", value: $minutes, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 80)
                        Text("min").foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("Calories burned")
                        Spacer()
                        TextField("kcal", value: $calories, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 80)
                        Text("kcal").foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Details")
                } footer: {
                    Text("Adds to your daily calorie budget.")
                }
                Button("Save") {
                    let entry = CardioEntry(
                        activity: activity,
                        minutes: minutes,
                        caloriesBurned: calories,
                        performedAt: date.addingTimeInterval(60 * 60 * 12)
                    )
                    modelContext.insert(entry)
                    try? modelContext.save()
                    dismiss()
                }
            }
            .navigationTitle("Log cardio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

struct FoodEntryRowView: View {
    let entry: FoodEntry
    var onDelete: () -> Void
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.foodNameSnapshot).font(.subheadline)
                Text("\(Int(entry.gramsConsumed)) g · \(Int(entry.macros.calories)) kcal")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button(role: .destructive) { onDelete() } label: {
                Image(systemName: "minus.circle.fill")
                    .foregroundStyle(AppTheme.danger)
            }
            .buttonStyle(.plain)
        }
    }
}
