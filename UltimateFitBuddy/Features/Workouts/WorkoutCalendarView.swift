import SwiftUI
import SwiftData

struct WorkoutCalendarView: View {
    @Environment(\.modelContext) private var modelContext

    @Query(sort: [SortDescriptor(\WorkoutSession.startedAt, order: .reverse)])
    private var workouts: [WorkoutSession]

    @State private var month: Date = Calendar.current.startOfMonth(for: .now)
    @State private var selectedDay: Date?

    private let cal = Calendar.current

    private var monthLabel: String {
        month.formatted(.dateTime.month(.wide).year())
    }

    private var firstWeekdayOffset: Int {
        // Make Monday the first column, like Strong's weekly planner
        let weekday = cal.component(.weekday, from: month) // Sunday = 1
        return (weekday + 5) % 7
    }

    private var daysInMonth: Int {
        cal.range(of: .day, in: .month, for: month)?.count ?? 30
    }

    private var workoutsByDay: [Date: Int] {
        var byDay: [Date: Int] = [:]
        for w in workouts {
            let key = cal.startOfDay(for: w.startedAt)
            byDay[key, default: 0] += 1
        }
        return byDay
    }

    private var mealsByDay: [Date: Int] {
        let descriptor = FetchDescriptor<Meal>()
        let allMeals = (try? modelContext.fetch(descriptor)) ?? []
        var byDay: [Date: Int] = [:]
        for m in allMeals {
            if (m.entries ?? []).isEmpty { continue }
            let key = cal.startOfDay(for: m.date)
            byDay[key, default: 0] += 1
        }
        return byDay
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                monthHeader
                dayGrid
                legend
            }
            .padding()
        }
        .navigationTitle("Calendar")
        .background(Color(.systemGroupedBackground))
        .sheet(item: $selectedDay) { day in
            DayDetailView(day: day)
        }
    }

    private var monthHeader: some View {
        HStack {
            Button {
                month = cal.date(byAdding: .month, value: -1, to: month) ?? month
            } label: {
                Image(systemName: "chevron.left")
            }
            Spacer()
            Text(monthLabel).font(.headline)
            Spacer()
            Button {
                month = cal.date(byAdding: .month, value: 1, to: month) ?? month
            } label: {
                Image(systemName: "chevron.right")
            }
        }
        .padding(.horizontal, 4)
    }

    private var dayGrid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)
        return VStack(spacing: 6) {
            HStack(spacing: 6) {
                ForEach(["M","T","W","T","F","S","S"], id: \.self) { d in
                    Text(d)
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(0..<firstWeekdayOffset, id: \.self) { _ in
                    Color.clear.frame(height: 44)
                }
                ForEach(1...daysInMonth, id: \.self) { d in
                    let date = cal.date(byAdding: .day, value: d - 1, to: month)!
                    DayCell(
                        date: date,
                        isToday: cal.isDateInToday(date),
                        workouts: workoutsByDay[cal.startOfDay(for: date)] ?? 0,
                        mealsLogged: (mealsByDay[cal.startOfDay(for: date)] ?? 0) > 0
                    )
                    .onTapGesture { selectedDay = date }
                }
            }
        }
        .card()
    }

    private var legend: some View {
        HStack(spacing: 24) {
            HStack(spacing: 6) {
                Circle().fill(AppTheme.warning).frame(width: 6, height: 6)
                Text("Workout").font(.caption).foregroundStyle(.secondary)
            }
            HStack(spacing: 6) {
                Circle().fill(AppTheme.accent).frame(width: 6, height: 6)
                Text("Meals").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }
}

private struct DayCell: View {
    let date: Date
    let isToday: Bool
    let workouts: Int
    let mealsLogged: Bool

    var body: some View {
        VStack(spacing: 2) {
            Text("\(Calendar.current.component(.day, from: date))")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(isToday ? Color.white : Color.primary)
            HStack(spacing: 3) {
                if workouts > 0 {
                    Circle().fill(isToday ? Color.white : AppTheme.warning).frame(width: 5, height: 5)
                }
                if mealsLogged {
                    Circle().fill(isToday ? Color.white : AppTheme.accent).frame(width: 5, height: 5)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(
            isToday ? AppTheme.accent : Color(.tertiarySystemFill),
            in: RoundedRectangle(cornerRadius: 8, style: .continuous)
        )
    }
}

private struct DayDetailView: View {
    let day: Date
    @Environment(\.modelContext) private var modelContext

    private var startOfDay: Date { Calendar.current.startOfDay(for: day) }
    private var endOfDay: Date {
        Calendar.current.date(byAdding: .day, value: 1, to: startOfDay) ?? startOfDay
    }

    private var workouts: [WorkoutSession] {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<WorkoutSession>(
            predicate: #Predicate { $0.startedAt >= start && $0.startedAt < end }
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    private var meals: [Meal] {
        let start = startOfDay
        let end = endOfDay
        let descriptor = FetchDescriptor<Meal>(
            predicate: #Predicate { $0.date >= start && $0.date < end }
        )
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    private var totals: Macros {
        meals.reduce(.zero) { $0 + $1.totalMacros }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Nutrition") {
                    LabeledContent("Calories", value: "\(Int(totals.calories)) kcal")
                    LabeledContent("Protein", value: String(format: "%.1f g", totals.protein))
                    LabeledContent("Carbs", value: String(format: "%.1f g", totals.carbs))
                    LabeledContent("Fat", value: String(format: "%.1f g", totals.fat))
                }
                Section("Workouts") {
                    if workouts.isEmpty {
                        Text("No workouts").foregroundStyle(.secondary)
                    } else {
                        ForEach(workouts) { w in
                            NavigationLink {
                                WorkoutDetailView(session: w)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(w.name.isEmpty ? "Workout" : w.name).font(.headline)
                                    Text("\(w.sets?.count ?? 0) sets · \(Int(w.totalVolumeKg)) kg")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle(day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

extension Calendar {
    fileprivate func startOfMonth(for date: Date) -> Date {
        let comps = dateComponents([.year, .month], from: date)
        return self.date(from: comps) ?? date
    }
}

extension Date: @retroactive Identifiable {
    public var id: TimeInterval { timeIntervalSince1970 }
}
