import Foundation
import SwiftData

@Model
final class Exercise: Identifiable {
    var id: UUID = UUID()
    var name: String = ""
    var primaryMuscle: String = ""
    var secondaryMuscles: [String] = []
    var equipment: String = ""
    var mechanic: String = ""
    var category: String = "strength"
    var instructions: String = ""
    var isCustom: Bool = false
    var createdAt: Date = Date.now

    init(
        name: String = "",
        primaryMuscle: String = "",
        secondaryMuscles: [String] = [],
        equipment: String = "",
        mechanic: String = "",
        category: String = "strength",
        instructions: String = "",
        isCustom: Bool = false
    ) {
        self.name = name
        self.primaryMuscle = primaryMuscle
        self.secondaryMuscles = secondaryMuscles
        self.equipment = equipment
        self.mechanic = mechanic
        self.category = category
        self.instructions = instructions
        self.isCustom = isCustom
    }
}

enum ExerciseCategory: String, CaseIterable {
    case strength, cardio, mobility, plyometric
}

enum ExerciseEquipment: String, CaseIterable, Identifiable {
    case barbell, dumbbell, kettlebell, machine, cable, bodyweight, band, other
    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}

enum MuscleGroup: String, CaseIterable, Identifiable {
    case chest, back, shoulders, biceps, triceps, forearms
    case quads, hamstrings, glutes, calves
    case core, obliques, traps, lats, fullBody
    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}
