import SwiftUI
import SwiftData

@main
struct UltimateFitBuddyApp: App {
    @State private var appState = AppState()
    @AppStorage("ufb.onboarded") private var onboarded: Bool = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootTabView()
                    .environment(appState)
                    .task {
                        await appState.bootstrap()
                    }
                if !onboarded {
                    OnboardingView()
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: onboarded)
        }
        .modelContainer(AppModelContainer.shared.container)
    }
}

@Observable
@MainActor
final class AppState {
    var didBootstrap = false
    var lastError: String?
    let healthKit = HealthKitService()

    func bootstrap() async {
        guard !didBootstrap else { return }
        let context = AppModelContainer.shared.container.mainContext
        SeedDataService.bootstrap(context: context)
        await healthKit.requestAuthorizationIfNeeded()
        didBootstrap = true
    }
}
