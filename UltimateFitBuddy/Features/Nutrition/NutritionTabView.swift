import SwiftUI
import SwiftData

struct NutritionTabView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var users: [User]

    @State private var date: Date = Calendar.current.startOfDay(for: .now)
    @State private var addingTo: MealType?

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

    private var todayMacros: Macros {
        meals.reduce(.zero) { $0 + $1.totalMacros }
    }

    private var user: User? { users.first }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    dailyTotalsCard
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
        }
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
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(Int(m.calories))").font(.system(size: 36, weight: .bold))
                Text("/ \(Int(goalCal)) kcal").foregroundStyle(.secondary)
                Spacer()
                Text("\(Int(max(0, goalCal - m.calories))) left")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
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
