import SwiftUI
import SwiftData

struct BodyMeasurementsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor(\BodyMeasurement.recordedAt, order: .reverse)])
    private var measurements: [BodyMeasurement]

    @State private var showingLog: BodyMeasurementKind?

    var body: some View {
        List {
            ForEach(BodyMeasurementKind.allCases) { kind in
                Section(kind.displayName) {
                    let entries = entriesFor(kind)
                    if let latest = entries.first {
                        LabeledContent("Latest") {
                            Text(formattedValue(latest, kind: kind))
                                .font(.body.monospacedDigit())
                        }
                        Text(latest.recordedAt, style: .relative)
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Button {
                        showingLog = kind
                    } label: {
                        Label("Log new", systemImage: "plus.circle")
                    }
                    if entries.count > 1 {
                        NavigationLink {
                            BodyMeasurementHistoryView(kind: kind, entries: entries)
                        } label: {
                            Text("History (\(entries.count))")
                        }
                    }
                }
            }
        }
        .navigationTitle("Body measurements")
        .sheet(item: $showingLog) { kind in
            LogBodyMeasurementSheet(kind: kind)
        }
    }

    private func entriesFor(_ kind: BodyMeasurementKind) -> [BodyMeasurement] {
        let raw = kind.rawValue
        return measurements.filter { measurement in
            // Preserve legacy weight entries that pre-date the `kind` field.
            (measurement.kind == raw) ||
            (kind == .weight && measurement.weightKg > 0 && measurement.kind == "weight")
        }
    }

    private func formattedValue(_ m: BodyMeasurement, kind: BodyMeasurementKind) -> String {
        let value: Double = (kind == .weight && m.weightKg > 0) ? m.weightKg : m.value
        return String(format: "%.1f %@", value, kind.unit)
    }
}

struct BodyMeasurementHistoryView: View {
    let kind: BodyMeasurementKind
    let entries: [BodyMeasurement]
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        List {
            ForEach(entries) { e in
                let v: Double = (kind == .weight && e.weightKg > 0) ? e.weightKg : e.value
                LabeledContent {
                    Text(String(format: "%.1f %@", v, kind.unit)).font(.body.monospacedDigit())
                } label: {
                    Text(e.recordedAt.formatted(.dateTime.month(.abbreviated).day().year()))
                }
            }
            .onDelete(perform: delete)
        }
        .navigationTitle(kind.displayName)
    }

    private func delete(_ offsets: IndexSet) {
        for i in offsets {
            modelContext.delete(entries[i])
        }
        try? modelContext.save()
    }
}

struct LogBodyMeasurementSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    let kind: BodyMeasurementKind
    @State private var value: Double = 0

    var body: some View {
        NavigationStack {
            Form {
                Section(kind.displayName) {
                    HStack {
                        Text("Value")
                        Spacer()
                        TextField(kind.unit, value: $value, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                        Text(kind.unit).foregroundStyle(.secondary)
                    }
                }
                Button("Save") { save() }
                    .disabled(value <= 0)
            }
            .navigationTitle("Log " + kind.displayName.lowercased())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func save() {
        if kind == .weight {
            let m = BodyMeasurement(weightKg: value, recordedAt: .now, kind: kind.rawValue, value: value, unit: kind.unit)
            modelContext.insert(m)
        } else {
            let m = BodyMeasurement(weightKg: 0, recordedAt: .now, kind: kind.rawValue, value: value, unit: kind.unit)
            modelContext.insert(m)
        }
        try? modelContext.save()
        dismiss()
    }
}
