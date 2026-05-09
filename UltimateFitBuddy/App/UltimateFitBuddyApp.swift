import SwiftUI
import SwiftData

@main
struct UltimateFitBuddyApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(appState)
                .task {
                    await appState.bootstrap()
                }
        }
        .modelContainer(AppModelContainer.shared.container)
    }
}

@Observable
final class AppState {
    var didBootstrap = false
    var lastError: String?
    let healthKit = HealthKitService()

    @MainActor
    func bootstrap() async {
        guard !didBootstrap else { return }
        let context = AppModelContainer.shared.container.mainContext
        SeedDataService.bootstrap(context: context)
        await healthKit.requestAuthorizationIfNeeded()
        didBootstrap = true
    }
}
