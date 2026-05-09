import SwiftUI

private struct OnboardingPage: Identifiable {
    let id = UUID()
    let emoji: String
    let title: String
    let body: String
    let tint: Color
}

struct OnboardingView: View {
    @AppStorage("ufb.onboarded") private var onboarded: Bool = false
    @State private var page: Int = 0

    private let pages: [OnboardingPage] = [
        .init(emoji: "👋", title: "Welcome to Fit Buddy",
              body: "One app for your workouts and your nutrition. No subscription, no account, no nonsense.",
              tint: AppTheme.fatColor),
        .init(emoji: "🎯", title: "Track what matters",
              body: "Calories, macros, water, weight, every set you lift. Personal records auto-detected, demo data on tap.",
              tint: AppTheme.warning),
        .init(emoji: "🚀", title: "Ready to lift",
              body: "Tap “Load demo data” in You to fill the app with sample data, or jump in and log your first workout.",
              tint: AppTheme.accent)
    ]

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 64)

            let p = pages[page]
            ZStack {
                RoundedRectangle(cornerRadius: 32, style: .continuous)
                    .fill(p.tint)
                Text(p.emoji)
                    .font(.system(size: 72))
            }
            .frame(width: 140, height: 140)
            .padding(.bottom, 32)

            Text(p.title)
                .font(.title.bold())
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .padding(.bottom, 12)

            Text(p.body)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)
                .padding(.bottom, 32)

            HStack(spacing: 6) {
                ForEach(0..<pages.count, id: \.self) { i in
                    Capsule()
                        .fill(i == page ? AppTheme.accent : Color.gray.opacity(0.3))
                        .frame(width: i == page ? 22 : 6, height: 6)
                        .animation(.easeInOut(duration: 0.2), value: page)
                }
            }

            Spacer()

            HStack(spacing: 12) {
                if page > 0 {
                    Button("Back") {
                        withAnimation { page -= 1 }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                } else {
                    Button("Skip") {
                        onboarded = true
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                }

                Button(page < pages.count - 1 ? "Next" : "Get started") {
                    if page < pages.count - 1 {
                        withAnimation { page += 1 }
                    } else {
                        onboarded = true
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }
}

#Preview {
    OnboardingView()
}
