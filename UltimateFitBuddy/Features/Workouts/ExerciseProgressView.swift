import SwiftUI
import SwiftData
import Charts

struct ExerciseProgressView: View {
    let exercise: Exercise
    @Query private var allSets: [ExerciseSet]

    init(exercise: Exercise) {
        self.exercise = exercise
        let id = exercise.id
        _allSets = Query(
            filter: #Predicate<ExerciseSet> { $0.exerciseId == id && $0.isCompleted },
            sort: [SortDescriptor(\ExerciseSet.performedAt)]
        )
    }

    private var bestPerSession: [(date: Date, oneRm: Double)] {
        let grouped = Dictionary(grouping: allSets) { set -> Date in
            Calendar.current.startOfDay(for: set.performedAt)
        }
        return grouped
            .map { (day, sets) -> (Date, Double) in
                let best = sets.map { $0.estimatedOneRepMaxKg }.max() ?? 0
                return (day, best)
            }
            .sorted { $0.0 < $1.0 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(exercise.name).font(.title2.bold())
                Text("\(exercise.primaryMuscle.capitalized) · \(exercise.equipment.capitalized)")
                    .font(.subheadline).foregroundStyle(.secondary)

                if bestPerSession.isEmpty {
                    Text("No completed sets yet")
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 32)
                } else {
                    Text("Estimated 1RM").font(.headline)
                    Chart {
                        ForEach(bestPerSession, id: \.date) { p in
                            LineMark(x: .value("Date", p.date), y: .value("1RM kg", p.oneRm))
                                .interpolationMethod(.monotone)
                                .foregroundStyle(AppTheme.accent)
                            PointMark(x: .value("Date", p.date), y: .value("1RM kg", p.oneRm))
                                .foregroundStyle(AppTheme.accent)
                        }
                    }
                    .frame(height: 240)
                    .card()
                }
            }
            .padding()
        }
        .navigationTitle("Progress")
        .navigationBarTitleDisplayMode(.inline)
    }
}
