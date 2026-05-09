import SwiftUI

struct PlateCalculatorView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var targetKg: Double = 100
    @State private var barKg: Double = 20
    @State private var unit: WeightUnit = .kg

    enum WeightUnit: String, CaseIterable, Identifiable {
        case kg, lb
        var id: String { rawValue }
    }

    private let kgPlates: [Double] = [25, 20, 15, 10, 5, 2.5, 1.25]
    private let lbPlates: [Double] = [45, 35, 25, 10, 5, 2.5]

    private var perSidePlates: [(Double, Int)] {
        let plates = unit == .kg ? kgPlates : lbPlates
        var remaining = max(0, (targetKg - barKg)) / 2.0
        var out: [(Double, Int)] = []
        for plate in plates {
            let count = Int(remaining / plate)
            if count > 0 {
                out.append((plate, count))
                remaining -= Double(count) * plate
            }
        }
        return out
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Unit", selection: $unit) {
                        ForEach(WeightUnit.allCases) { u in Text(u.rawValue.uppercased()).tag(u) }
                    }.pickerStyle(.segmented)
                    HStack {
                        Text("Target")
                        Spacer()
                        TextField("target", value: $targetKg, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                    HStack {
                        Text("Bar")
                        Spacer()
                        TextField("bar", value: $barKg, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                }
                Section("Per side") {
                    if perSidePlates.isEmpty {
                        Text("No plates needed").foregroundStyle(.secondary)
                    } else {
                        ForEach(perSidePlates, id: \.0) { plate, count in
                            HStack {
                                Text("\(plate, specifier: "%.2g") \(unit.rawValue)")
                                Spacer()
                                Text("× \(count)").font(.headline)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Plate calculator")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
