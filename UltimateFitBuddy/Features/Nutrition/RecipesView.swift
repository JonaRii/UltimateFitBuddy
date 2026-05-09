import SwiftUI
import SwiftData

struct RecipesListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor(\Recipe.createdAt, order: .reverse)])
    private var recipes: [Recipe]
    @Query private var allFoods: [Food]

    @State private var creating = false

    private func food(for id: UUID) -> Food? {
        allFoods.first { $0.id == id }
    }

    var body: some View {
        List {
            if recipes.isEmpty {
                ContentUnavailableView(
                    "No recipes yet",
                    systemImage: "fork.knife",
                    description: Text("Combine foods into a recipe with servings to log them as one item.")
                )
            } else {
                ForEach(recipes) { r in
                    NavigationLink(destination: RecipeEditorView(recipe: r)) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.name).font(.headline)
                            let m = r.perServing(foodFor: food(for:))
                            Text("\(r.servings) servings · \(Int(m.calories)) kcal/serving")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete(perform: delete)
            }
        }
        .navigationTitle("Recipes")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { creating = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $creating) {
            NavigationStack {
                RecipeEditorView(recipe: nil)
            }
        }
    }

    private func delete(_ offsets: IndexSet) {
        for i in offsets {
            modelContext.delete(recipes[i])
        }
        try? modelContext.save()
    }
}

struct RecipeEditorView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    var recipe: Recipe?

    @State private var name: String = ""
    @State private var servings: Int = 1
    @State private var foodIds: [UUID] = []
    @State private var grams: [Double] = []
    @State private var pickingIngredient = false

    @Query private var allFoods: [Food]

    private func food(for id: UUID) -> Food? {
        allFoods.first { $0.id == id }
    }

    private var perServing: Macros {
        var totals = Macros.zero
        for i in 0..<min(foodIds.count, grams.count) {
            guard let f = food(for: foodIds[i]) else { continue }
            totals = totals + f.macros(forGrams: grams[i])
        }
        let s = Double(max(1, servings))
        return Macros(
            calories: totals.calories / s,
            protein: totals.protein / s,
            carbs: totals.carbs / s,
            fat: totals.fat / s,
            fiber: totals.fiber / s
        )
    }

    private func ingredientLabel(at i: Int) -> String {
        let g = Int(grams[i])
        let cal = Int((food(for: foodIds[i])?.cal ?? 0) * grams[i] / 100)
        return "\(g) g · \(cal) kcal"
    }

    var body: some View {
        Form {
            Section("Recipe") {
                TextField("Name", text: $name)
                Stepper("Servings: \(servings)", value: $servings, in: 1...20)
            }
            Section {
                ForEach(0..<foodIds.count, id: \.self) { i in
                    let foodName = food(for: foodIds[i])?.name ?? "Missing food"
                    VStack(alignment: .leading, spacing: 2) {
                        Text(foodName).font(.subheadline)
                        Text(ingredientLabel(at: i))
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .onDelete { offsets in
                    for i in offsets.sorted(by: >) {
                        foodIds.remove(at: i)
                        grams.remove(at: i)
                    }
                }
                Button {
                    pickingIngredient = true
                } label: {
                    Label("Add ingredient", systemImage: "plus.circle")
                }
            } header: {
                Text("Ingredients")
            }
            Section("Per serving") {
                LabeledContent("Calories", value: "\(Int(perServing.calories)) kcal")
                LabeledContent("Protein",  value: String(format: "%.1f g", perServing.protein))
                LabeledContent("Carbs",    value: String(format: "%.1f g", perServing.carbs))
                LabeledContent("Fat",      value: String(format: "%.1f g", perServing.fat))
            }
        }
        .navigationTitle(recipe == nil ? "New recipe" : "Edit recipe")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") { save() }
                    .disabled(name.isEmpty || foodIds.isEmpty)
                    .bold()
            }
        }
        .onAppear {
            if let r = recipe {
                name = r.name
                servings = max(1, r.servings)
                foodIds = r.foodIds
                grams = r.gramsList
            }
        }
        .sheet(isPresented: $pickingIngredient) {
            IngredientPicker { food, gramsValue in
                foodIds.append(food.id)
                grams.append(gramsValue)
            }
        }
    }

    private func save() {
        if let r = recipe {
            r.name = name
            r.servings = servings
            r.foodIds = foodIds
            r.gramsList = grams
        } else {
            let r = Recipe(name: name, servings: servings)
            r.foodIds = foodIds
            r.gramsList = grams
            modelContext.insert(r)
        }
        try? modelContext.save()
        dismiss()
    }
}

struct IngredientPicker: View {
    @Environment(\.dismiss) private var dismiss
    @Query(sort: [SortDescriptor(\Food.name)]) private var foods: [Food]
    @State private var query = ""
    @State private var pendingFood: Food?
    @State private var grams: Double = 100

    var onPick: (Food, Double) -> Void

    private var filtered: [Food] {
        query.isEmpty ? foods : foods.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let pf = pendingFood {
                    portionForm(food: pf)
                } else {
                    foodList
                }
            }
        }
    }

    private func portionForm(food: Food) -> some View {
        Form {
            Section(food.name) {
                HStack {
                    Text("Grams")
                    Spacer()
                    TextField("g", value: $grams, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                }
            }
            Button("Add") {
                onPick(food, grams)
                dismiss()
            }
        }
        .navigationTitle("Portion")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Back") { pendingFood = nil }
            }
        }
    }

    private var foodList: some View {
        List(filtered) { f in
            Button {
                pendingFood = f
                grams = f.servingSizeG > 0 ? f.servingSizeG : 100
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(f.name).font(.headline).foregroundStyle(.primary)
                    Text("\(Int(f.cal)) kcal/100g")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .searchable(text: $query, prompt: "Search foods")
        .navigationTitle("Pick ingredient")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
            }
        }
    }
}
