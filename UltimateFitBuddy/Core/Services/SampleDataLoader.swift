import Foundation
import SwiftData

/// Generates a few weeks of realistic demo data for screenshots / first-feel.
/// Insert via Profile → Test tools → "Load sample data". Idempotent guard:
/// only seeds if there are zero workouts.
enum SampleDataLoader {

    @MainActor
    static func load(into context: ModelContext) {
        // Guard: don't double-load
        let workoutCount = (try? context.fetch(FetchDescriptor<WorkoutSession>()))?.count ?? 0
        if workoutCount > 0 { return }

        let exercises = (try? context.fetch(FetchDescriptor<Exercise>())) ?? []
        let foods = (try? context.fetch(FetchDescriptor<Food>())) ?? []

        let now = Date()
        let cal = Calendar.current
        let today = cal.startOfDay(for: now)

        func day(_ daysAgo: Int) -> Date {
            cal.date(byAdding: .day, value: -daysAgo, to: today) ?? today
        }

        // ---- Workouts: 4 weeks of progressing strength ----
        let prog: [(daysAgo: Int, name: String, items: [(String, Double, Int, Int)])] = [
            (24, "Push A",  [("Bench Press", 80, 5, 5), ("Overhead Press", 50, 5, 5), ("Triceps Pushdown", 30, 12, 3)]),
            (22, "Pull A",  [("Conventional Deadlift", 120, 5, 5), ("Pull-up", 0, 8, 3), ("Barbell Curl", 30, 10, 3)]),
            (20, "Legs A",  [("Back Squat", 100, 5, 5), ("Romanian Deadlift", 80, 8, 3), ("Standing Calf Raise", 60, 15, 3)]),
            (17, "Push A",  [("Bench Press", 82.5, 5, 5), ("Overhead Press", 51.25, 5, 5), ("Triceps Pushdown", 32.5, 12, 3)]),
            (15, "Pull A",  [("Conventional Deadlift", 122.5, 5, 5), ("Pull-up", 0, 9, 3), ("Barbell Curl", 32.5, 10, 3)]),
            (13, "Legs A",  [("Back Squat", 102.5, 5, 5), ("Romanian Deadlift", 82.5, 8, 3)]),
            (10, "Push A",  [("Bench Press", 85, 5, 5), ("Incline Dumbbell Press", 24, 8, 3), ("Lateral Raise", 10, 12, 3)]),
            (8,  "Pull A",  [("Conventional Deadlift", 125, 5, 5), ("Pull-up", 0, 10, 3), ("Hammer Curl", 14, 12, 3)]),
            (6,  "Legs A",  [("Back Squat", 105, 5, 5), ("Bulgarian Split Squat", 16, 10, 3)]),
            (3,  "Push A",  [("Bench Press", 87.5, 5, 5), ("Overhead Press", 53.75, 5, 5)]),
            (1,  "Pull A",  [("Conventional Deadlift", 127.5, 5, 5), ("Pull-up", 0, 10, 3)])
        ]
        for entry in prog {
            let start = cal.date(bySettingHour: 17, minute: 0, second: 0, of: day(entry.daysAgo)) ?? day(entry.daysAgo)
            let end   = start.addingTimeInterval(60 * 60)
            let session = WorkoutSession(name: entry.name, startedAt: start)
            session.endedAt = end
            context.insert(session)
            var ordinal = 0
            for (exName, weight, reps, sets) in entry.items {
                guard let ex = exercises.first(where: { $0.name == exName }) else { continue }
                for _ in 0..<sets {
                    let s = ExerciseSet(
                        exerciseId: ex.id, exerciseName: ex.name,
                        ordinal: ordinal, reps: reps, weightKg: weight
                    )
                    s.session = session
                    s.isCompleted = true
                    s.performedAt = start
                    context.insert(s)
                    ordinal += 1
                }
            }
        }

        // ---- Meals: 14 days of breakfast/lunch/dinner ----
        func ensureMeal(_ d: Date, _ type: MealType) -> Meal {
            let descriptor = FetchDescriptor<Meal>(
                predicate: #Predicate { $0.date == d && $0.type == type.rawValue }
            )
            if let existing = (try? context.fetch(descriptor))?.first { return existing }
            let m = Meal(date: d, type: type)
            context.insert(m)
            return m
        }
        func logFood(_ name: String, grams: Double, on dayDate: Date, slot: MealType) {
            guard let food = foods.first(where: { $0.name == name }) else { return }
            let entry = FoodEntry(food: food, gramsConsumed: grams)
            entry.consumedAt = dayDate
            entry.meal = ensureMeal(dayDate, slot)
            context.insert(entry)
        }
        for d in 0..<14 {
            if d == 7 { continue }   // intentional gap to demo streak break
            let dayDate = day(d)
            let heavy = (d % 3 == 0)
            logFood("Oats, rolled, dry", grams: 50, on: dayDate, slot: .breakfast)
            logFood("Banana", grams: heavy ? 130 : 100, on: dayDate, slot: .breakfast)
            logFood("Whey protein isolate", grams: 30, on: dayDate, slot: .breakfast)
            logFood("Chicken breast, cooked", grams: heavy ? 200 : 150, on: dayDate, slot: .lunch)
            logFood("White rice, cooked", grams: heavy ? 250 : 180, on: dayDate, slot: .lunch)
            logFood("Broccoli, cooked", grams: 150, on: dayDate, slot: .lunch)
            logFood(d % 2 == 0 ? "Salmon, Atlantic, cooked" : "Ground beef 90/10, cooked", grams: 180, on: dayDate, slot: .dinner)
            logFood("Sweet potato, baked", grams: 200, on: dayDate, slot: .dinner)
            logFood("Spinach, raw", grams: 60, on: dayDate, slot: .dinner)
            if d % 2 == 0 { logFood("Greek yogurt, plain non-fat", grams: 170, on: dayDate, slot: .snack) }
            if d % 4 == 0 { logFood("Almonds", grams: 28, on: dayDate, slot: .snack) }
        }

        // ---- 30 days of body weight ----
        var baseKg = 82.4
        for d in stride(from: 30, through: 0, by: -1) {
            let kg = (baseKg + sin(Double(d) / 4) * 0.6 - Double(d) * 0.025)
            let m = BodyMeasurement(weightKg: kg, recordedAt: day(d), kind: "weight", value: kg, unit: "kg")
            context.insert(m)
            baseKg = baseKg - 0.001
        }

        // ---- Today: water + 1 cardio ----
        for _ in 0..<5 { context.insert(WaterEntry(ml: 250, consumedAt: now)) }
        let cardio = CardioEntry(activity: "Running", minutes: 35, caloriesBurned: 380, performedAt: now)
        context.insert(cardio)

        try? context.save()
    }
}
