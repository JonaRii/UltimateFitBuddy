import SwiftUI
import SwiftData

struct AddFoodFlow: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    let date: Date
    let mealType: MealType
    var onClose: () -> Void

    @State private var query = ""
    @State private var showingScanner = false
    @State private var pendingFood: Food?
    @State private var statusMessage: String?

    @Query(sort: [SortDescriptor(\Food.createdAt, order: .reverse)]) private var allFoods: [Food]

    private var filteredFoods: [Food] {
        guard !query.isEmpty else {
            return Array(allFoods.prefix(50))
        }
        return allFoods.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        showingScanner = true
                    } label: {
                        Label("Scan barcode", systemImage: "barcode.viewfinder")
                    }
                    NavigationLink(destination: ManualFoodEditor(onSave: { food in
                        addEntry(food: food, grams: food.servingSizeG)
                    })) {
                        Label("Add custom food", systemImage: "square.and.pencil")
                    }
                }
                if let m = statusMessage {
                    Section { Text(m).foregroundStyle(.secondary) }
                }
                Section("Recent / saved") {
                    if filteredFoods.isEmpty {
                        Text("Nothing here yet — scan a barcode or add a custom food.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    ForEach(filteredFoods) { food in
                        Button { pendingFood = food } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(food.name).font(.headline).foregroundStyle(.primary)
                                Text(subtitle(for: food))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: "Search foods")
            .navigationTitle("Add to \(mealType.displayName)")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { onClose(); dismiss() }
                }
            }
            .sheet(isPresented: $showingScanner) {
                NavigationStack {
                    BarcodeScannerView(onScan: handleBarcode, onError: { msg in
                        statusMessage = msg
                        showingScanner = false
                    })
                    .ignoresSafeArea()
                    .navigationTitle("Scan")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Cancel") { showingScanner = false }
                        }
                    }
                }
            }
            .sheet(item: $pendingFood) { food in
                FoodPortionSheet(food: food) { grams in
                    addEntry(food: food, grams: grams)
                }
            }
        }
    }

    private func subtitle(for food: Food) -> String {
        let brand = food.brand.map { "\($0) · " } ?? ""
        return "\(brand)\(Int(food.caloriesPer100g)) kcal / 100 g"
    }

    private func handleBarcode(_ code: String) {
        showingScanner = false
        statusMessage = "Looking up \(code)…"
        Task {
            if let result = await FoodSearchService.shared.lookupBarcode(code, in: modelContext) {
                statusMessage = result.fromCache ? "Loaded from cache" : "Loaded from Open Food Facts"
                pendingFood = result.food
            } else {
                statusMessage = "Couldn't find \(code) in Open Food Facts. Add manually?"
            }
        }
    }

    private func addEntry(food: Food, grams: Double) {
        let meal = ensureMeal()
        let entry = FoodEntry(food: food, gramsConsumed: grams)
        entry.consumedAt = .now
        entry.meal = meal
        modelContext.insert(entry)
        try? modelContext.save()
        Task {
            await appState.healthKit.saveFoodEntry(macros: entry.macros, at: entry.consumedAt)
        }
        pendingFood = nil
        onClose()
        dismiss()
    }

    private func ensureMeal() -> Meal {
        let start = Calendar.current.startOfDay(for: date)
        let end = Calendar.current.date(byAdding: .day, value: 1, to: start) ?? start
        let raw = mealType.rawValue
        let descriptor = FetchDescriptor<Meal>(
            predicate: #Predicate { $0.date >= start && $0.date < end && $0.type == raw }
        )
        if let existing = (try? modelContext.fetch(descriptor))?.first {
            return existing
        }
        let m = Meal(date: start, type: mealType)
        modelContext.insert(m)
        return m
    }
}

struct FoodPortionSheet: View {
    @Environment(\.dismiss) private var dismiss
    let food: Food
    var onConfirm: (Double) -> Void
    @State private var grams: Double

    init(food: Food, onConfirm: @escaping (Double) -> Void) {
        self.food = food
        self.onConfirm = onConfirm
        self._grams = State(initialValue: food.servingSizeG > 0 ? food.servingSizeG : 100)
    }

    private var macros: Macros { food.macros(forGrams: grams) }

    var body: some View {
        NavigationStack {
            Form {
                Section(food.name) {
                    if let brand = food.brand, !brand.isEmpty {
                        Text(brand).foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("Grams")
                        Spacer()
                        TextField("g", value: $grams, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                    if !food.servingDescription.isEmpty {
                        Text("Serving: \(food.servingDescription)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                Section("This portion") {
                    LabeledContent("Calories", value: "\(Int(macros.calories)) kcal")
                    LabeledContent("Protein", value: "\(Int(macros.protein)) g")
                    LabeledContent("Carbs", value: "\(Int(macros.carbs)) g")
                    LabeledContent("Fat", value: "\(Int(macros.fat)) g")
                }
                Button("Add") {
                    onConfirm(grams)
                    dismiss()
                }
            }
            .navigationTitle("Portion")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

struct ManualFoodEditor: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    var onSave: (Food) -> Void

    @State private var name = ""
    @State private var brand = ""
    @State private var calories: Double = 0
    @State private var protein: Double = 0
    @State private var carbs: Double = 0
    @State private var fat: Double = 0
    @State private var serving: Double = 100
    @State private var servingDescription = "100 g"

    var body: some View {
        Form {
            Section("Food") {
                TextField("Name", text: $name)
                TextField("Brand (optional)", text: $brand)
            }
            Section("Per 100 g") {
                numField("Calories", value: $calories, unit: "kcal")
                numField("Protein", value: $protein, unit: "g")
                numField("Carbs", value: $carbs, unit: "g")
                numField("Fat", value: $fat, unit: "g")
            }
            Section("Serving") {
                numField("Serving size", value: $serving, unit: "g")
                TextField("Description (e.g., 1 cup)", text: $servingDescription)
            }
            Button("Save") { save() }
                .disabled(name.isEmpty)
        }
        .navigationTitle("Custom food")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func numField(_ label: String, value: Binding<Double>, unit: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField(unit, value: value, format: .number)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
            Text(unit).foregroundStyle(.secondary)
        }
    }

    private func save() {
        let food = Food(name: name, source: "custom")
        food.brand = brand.isEmpty ? nil : brand
        food.caloriesPer100g = calories
        food.proteinPer100g = protein
        food.carbsPer100g = carbs
        food.fatPer100g = fat
        food.servingSizeG = serving
        food.servingDescription = servingDescription
        modelContext.insert(food)
        try? modelContext.save()
        onSave(food)
        dismiss()
    }
}
