import SwiftUI

struct RootTabView: View {
    @Environment(AppState.self) private var appState
    @State private var selection: Tab = .dashboard

    enum Tab: Hashable {
        case dashboard, workouts, nutrition, profile
    }

    var body: some View {
        TabView(selection: $selection) {
            DashboardView()
                .tabItem { Label("Today", systemImage: "house.fill") }
                .tag(Tab.dashboard)

            WorkoutsTabView()
                .tabItem { Label("Workouts", systemImage: "dumbbell.fill") }
                .tag(Tab.workouts)

            NutritionTabView()
                .tabItem { Label("Nutrition", systemImage: "fork.knife") }
                .tag(Tab.nutrition)

            ProfileView()
                .tabItem { Label("You", systemImage: "person.circle.fill") }
                .tag(Tab.profile)
        }
        .tint(AppTheme.accent)
    }
}

#Preview {
    RootTabView()
        .environment(AppState())
        .modelContainer(AppModelContainer.previewContainer)
}
