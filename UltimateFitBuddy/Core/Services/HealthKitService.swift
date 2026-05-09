import Foundation
import HealthKit
import os

@Observable
@MainActor
final class HealthKitService {
    private let store = HKHealthStore()
    private let logger = Logger(subsystem: "com.jonatanriise.fitbuddy", category: "healthkit")

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }
    var isAuthorized: Bool = false
    var lastError: String?

    var todaySteps: Int = 0
    var todayActiveEnergyKcal: Double = 0
    var latestWeightKg: Double?

    private var readTypes: Set<HKObjectType> {
        var set: Set<HKObjectType> = []
        if let v = HKObjectType.quantityType(forIdentifier: .stepCount) { set.insert(v) }
        if let v = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { set.insert(v) }
        if let v = HKObjectType.quantityType(forIdentifier: .bodyMass) { set.insert(v) }
        if let v = HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed) { set.insert(v) }
        return set
    }

    private var writeTypes: Set<HKSampleType> {
        var set: Set<HKSampleType> = [HKObjectType.workoutType()]
        let writeIds: [HKQuantityTypeIdentifier] = [
            .dietaryEnergyConsumed,
            .dietaryProtein,
            .dietaryCarbohydrates,
            .dietaryFatTotal,
            .bodyMass
        ]
        for id in writeIds {
            if let t = HKObjectType.quantityType(forIdentifier: id) { set.insert(t) }
        }
        return set
    }

    func requestAuthorizationIfNeeded() async {
        guard isAvailable else { return }
        do {
            try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
            isAuthorized = true
            await refreshTodayMetrics()
        } catch {
            logger.error("HealthKit auth failed: \(error.localizedDescription, privacy: .public)")
            lastError = error.localizedDescription
        }
    }

    func refreshTodayMetrics() async {
        async let steps = sumQuantityToday(.stepCount, unit: .count())
        async let kcal = sumQuantityToday(.activeEnergyBurned, unit: .kilocalorie())
        async let weight = mostRecentQuantity(.bodyMass, unit: .gramUnit(with: .kilo))
        todaySteps = Int((try? await steps) ?? 0)
        todayActiveEnergyKcal = (try? await kcal) ?? 0
        latestWeightKg = (try? await weight)
    }

    // MARK: - Reads

    private func sumQuantityToday(_ id: HKQuantityTypeIdentifier, unit: HKUnit) async throws -> Double {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return 0 }
        let start = Calendar.current.startOfDay(for: .now)
        let end = Date.now
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let value = stats?.sumQuantity()?.doubleValue(for: unit) ?? 0
                continuation.resume(returning: value)
            }
            store.execute(q)
        }
    }

    private func mostRecentQuantity(_ id: HKQuantityTypeIdentifier, unit: HKUnit) async throws -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return nil }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return try await withCheckedThrowingContinuation { continuation in
            let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
                continuation.resume(returning: value)
            }
            store.execute(q)
        }
    }

    // MARK: - Writes

    func saveWorkout(start: Date, end: Date, totalEnergyKcal: Double?) async {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .functionalStrengthTraining
        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
        do {
            try await builder.beginCollection(at: start)
            if let kcal = totalEnergyKcal,
               let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
                let quantity = HKQuantity(unit: .kilocalorie(), doubleValue: kcal)
                let sample = HKCumulativeQuantitySample(type: energyType, quantity: quantity, start: start, end: end)
                try await builder.addSamples([sample])
            }
            try await builder.endCollection(at: end)
            _ = try await builder.finishWorkout()
        } catch {
            logger.error("Workout save failed: \(error.localizedDescription, privacy: .public)")
            lastError = error.localizedDescription
        }
    }

    func saveFoodEntry(macros: Macros, at date: Date) async {
        let pairs: [(HKQuantityTypeIdentifier, HKUnit, Double)] = [
            (.dietaryEnergyConsumed, .kilocalorie(), macros.calories),
            (.dietaryProtein, .gram(), macros.protein),
            (.dietaryCarbohydrates, .gram(), macros.carbs),
            (.dietaryFatTotal, .gram(), macros.fat)
        ]
        var samples: [HKQuantitySample] = []
        for (id, unit, value) in pairs where value > 0 {
            guard let type = HKQuantityType.quantityType(forIdentifier: id) else { continue }
            let sample = HKQuantitySample(
                type: type,
                quantity: HKQuantity(unit: unit, doubleValue: value),
                start: date,
                end: date
            )
            samples.append(sample)
        }
        guard !samples.isEmpty else { return }
        do {
            try await store.save(samples)
        } catch {
            logger.error("Food entry save failed: \(error.localizedDescription, privacy: .public)")
            lastError = error.localizedDescription
        }
    }

    func saveBodyWeight(_ kg: Double, at date: Date = .now) async {
        guard let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else { return }
        let sample = HKQuantitySample(
            type: type,
            quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg),
            start: date,
            end: date
        )
        do {
            try await store.save(sample)
        } catch {
            logger.error("Body weight save failed: \(error.localizedDescription, privacy: .public)")
            lastError = error.localizedDescription
        }
    }
}
