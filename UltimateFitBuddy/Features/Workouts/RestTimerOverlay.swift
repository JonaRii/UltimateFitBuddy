import SwiftUI

struct RestTimerOverlay: View {
    let seconds: Int
    var onDismiss: () -> Void

    @State private var remaining: Int
    @State private var timer: Timer?

    init(seconds: Int, onDismiss: @escaping () -> Void) {
        self.seconds = seconds
        self.onDismiss = onDismiss
        self._remaining = State(initialValue: seconds)
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "timer")
            Text("Rest")
                .font(.headline)
            Text(timeString)
                .font(.title3.monospacedDigit().bold())
            Spacer()
            Button("Skip") { stop() }
                .buttonStyle(.bordered)
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(.regularMaterial, in: Capsule())
        .onAppear { start() }
        .onDisappear { timer?.invalidate() }
    }

    private var timeString: String {
        String(format: "%01d:%02d", remaining / 60, remaining % 60)
    }

    private func start() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
            remaining -= 1
            if remaining <= 0 {
                t.invalidate()
                stop()
            }
        }
    }

    private func stop() {
        timer?.invalidate()
        onDismiss()
    }
}
