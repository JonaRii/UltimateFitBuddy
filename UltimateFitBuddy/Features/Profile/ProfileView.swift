import SwiftUI
import SwiftData

struct ProfileView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(AppState.self) private var appState
    @Query private var users: [User]

    private var user: User? { users.first }

    var body: some View {
        NavigationStack {
            List {
                if let user {
                    Section("You") {
                        TextField("Display name", text: Binding(
                            get: { user.displayName },
                            set: { user.displayName = $0; try? modelContext.save() }
                        ))
                    }
                    Section("Daily goals") {
                        intRow("Calories", value: Binding(
                            get: { user.calorieGoal },
                            set: { user.calorieGoal = $0; try? modelContext.save() }
                        ), unit: "kcal")
                        intRow("Protein", value: Binding(
                            get: { user.proteinGoalG },
                            set: { user.proteinGoalG = $0; try? modelContext.save() }
                        ), unit: "g")
                        intRow("Carbs", value: Binding(
                            get: { user.carbsGoalG },
                            set: { user.carbsGoalG = $0; try? modelContext.save() }
                        ), unit: "g")
                        intRow("Fat", value: Binding(
                            get: { user.fatGoalG },
                            set: { user.fatGoalG = $0; try? modelContext.save() }
                        ), unit: "g")
                        intRow("Water", value: Binding(
                            get: { user.waterGoalMl },
                            set: { user.waterGoalMl = $0; try? modelContext.save() }
                        ), unit: "ml")
                    }
                    Section("Body") {
                        doubleRow("Height", value: Binding(
                            get: { user.heightCm },
                            set: { user.heightCm = $0; try? modelContext.save() }
                        ), unit: "cm")
                        doubleRow("Weight goal", value: Binding(
                            get: { user.weightKgGoal },
                            set: { user.weightKgGoal = $0; try? modelContext.save() }
                        ), unit: "kg")
                    }
                }
                Section("Library") {
                    NavigationLink {
                        RecipesListView()
                    } label: {
                        Label("Recipes", systemImage: "fork.knife")
                    }
                    NavigationLink {
                        RoutinesListView()
                    } label: {
                        Label("Routines", systemImage: "list.bullet.rectangle")
                    }
                    NavigationLink {
                        BodyMeasurementsView()
                    } label: {
                        Label("Body measurements", systemImage: "ruler")
                    }
                }
                Section("Apple Health") {
                    HStack {
                        Image(systemName: appState.healthKit.isAuthorized ? "checkmark.circle.fill" : "questionmark.circle")
                            .foregroundStyle(appState.healthKit.isAuthorized ? AppTheme.accent : .secondary)
                        Text(appState.healthKit.isAuthorized ? "Connected" : "Not connected")
                    }
                    Button("Re-request access") {
                        Task { await appState.healthKit.requestAuthorizationIfNeeded() }
                    }
                }
                Section("iCloud sync") {
                    HStack {
                        Image(systemName: AppModelContainer.shared.usesCloudKit ? "icloud.fill" : "icloud.slash")
                            .foregroundStyle(AppModelContainer.shared.usesCloudKit ? AppTheme.accent : .secondary)
                        Text(AppModelContainer.shared.usesCloudKit ? "Syncing via CloudKit" : "Local only")
                    }
                    if !AppModelContainer.shared.usesCloudKit {
                        Text("CloudKit isn't available — usually means a free Apple ID without iCloud capability. Data still saves locally.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                Section("About") {
                    LabeledContent("Version", value: appVersion)
                    Link("Open Food Facts", destination: URL(string: "https://world.openfoodfacts.org")!)
                    Link("USDA FoodData Central", destination: URL(string: "https://fdc.nal.usda.gov")!)
                }
            }
            .navigationTitle("You")
        }
    }

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }

    private func intRow(_ label: String, value: Binding<Int>, unit: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField(unit, value: value, format: .number)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
            Text(unit).foregroundStyle(.secondary)
        }
    }

    private func doubleRow(_ label: String, value: Binding<Double>, unit: String) -> some View {
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
}
