import SwiftUI
import SwiftData

struct SavedMealsListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor(\SavedMeal.createdAt, order: .reverse)]) private var meals: [SavedMeal]
    @Query private var allFoods: [Food]

    var body: some View {
        List {
            if meals.isEmpty {
                ContentUnavailableView(
                    "No saved meals",
                    systemImage: "list.bullet.rectangle",
                    description: Text("Save a meal you eat often (breakfast, post-workout, etc.) and log it again with one tap.")
                )
            } else {
                ForEach(meals) { m in
                    NavigationLink {
                        SavedMealDetailView(meal: m)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m.name).font(.headline)
                            Text("\(m.foodIds.count) items")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete(perform: delete)
            }
        }
        .navigationTitle("Saved meals")
    }

    private func delete(_ offsets: IndexSet) {
        for i in offsets {
            modelContext.delete(meals[i])
        }
        try? modelContext.save()
    }
}

struct SavedMealDetailView: View {
    @Bindable var meal: SavedMeal
    @Query private var allFoods: [Food]

    private func food(for id: UUID) -> Food? {
        allFoods.first { $0.id == id }
    }

    var body: some View {
        List {
            Section("Items") {
                ForEach(0..<meal.foodIds.count, id: \.self) { i in
                    let f = food(for: meal.foodIds[i])
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(f?.name ?? "Missing food").font(.subheadline)
                            Text("\(Int(meal.gramsList[i])) g")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let f = f {
                            Text("\(Int(f.caloriesPer100g * meal.gramsList[i] / 100)) kcal")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(meal.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
