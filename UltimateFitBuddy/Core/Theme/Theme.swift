import SwiftUI

enum AppTheme {
    static let accent = Color(red: 0.20, green: 0.78, blue: 0.55)
    static let warning = Color(red: 0.95, green: 0.65, blue: 0.20)
    static let danger = Color(red: 0.92, green: 0.30, blue: 0.30)

    static let proteinColor = Color(red: 0.95, green: 0.40, blue: 0.45)
    static let carbsColor = Color(red: 0.95, green: 0.75, blue: 0.30)
    static let fatColor = Color(red: 0.40, green: 0.65, blue: 0.95)
    static let caloriesColor = Color(red: 0.20, green: 0.78, blue: 0.55)

    static let cardCornerRadius: CGFloat = 16
    static let cardPadding: CGFloat = 16
}

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(AppTheme.cardPadding)
            .background(
                RoundedRectangle(cornerRadius: AppTheme.cardCornerRadius, style: .continuous)
                    .fill(.regularMaterial)
            )
    }
}

extension View {
    func card() -> some View {
        modifier(CardModifier())
    }
}
