import Foundation
import SwiftData
import os

/// Searches the bundled USDA seed (read-only SQLite) and the Open Food Facts
/// public REST API for barcode lookups. Hits are materialised as `Food` rows in
/// the SwiftData store and re-used on subsequent searches.
@MainActor
final class FoodSearchService {
    static let shared = FoodSearchService()
    private let logger = Logger(subsystem: "com.jonatanriise.fitbuddy", category: "foodsearch")
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        // Open Food Facts requires a meaningful User-Agent or it throttles.
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1"
        config.httpAdditionalHeaders = [
            "User-Agent": "UltimateFitBuddy/\(appVersion) (alpha; jonatan.riise@gmail.com)"
        ]
        self.session = URLSession(configuration: config)
    }

    // MARK: - Local search

    func search(query: String, in context: ModelContext, limit: Int = 30) -> [Food] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return [] }
        let descriptor = FetchDescriptor<Food>(
            predicate: #Predicate { food in
                food.name.localizedStandardContains(trimmed)
            },
            sortBy: [SortDescriptor(\Food.name)]
        )
        var d = descriptor
        d.fetchLimit = limit
        return (try? context.fetch(d)) ?? []
    }

    // MARK: - Barcode lookup (Open Food Facts)

    struct BarcodeLookupResult {
        var food: Food
        var fromCache: Bool
    }

    func lookupBarcode(_ barcode: String, in context: ModelContext) async -> BarcodeLookupResult? {
        let cleaned = barcode.trimmingCharacters(in: .whitespaces)
        guard !cleaned.isEmpty else { return nil }

        // Cache hit?
        let cacheDescriptor = FetchDescriptor<Food>(
            predicate: #Predicate { food in food.barcode == cleaned }
        )
        if let cached = try? context.fetch(cacheDescriptor).first {
            return BarcodeLookupResult(food: cached, fromCache: true)
        }

        // Hit OFF API
        guard let url = URL(string: "https://world.openfoodfacts.org/api/v2/product/\(cleaned).json?fields=product_name,brands,nutriments,serving_size,serving_quantity") else {
            return nil
        }

        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                logger.warning("OFF lookup status \((response as? HTTPURLResponse)?.statusCode ?? -1)")
                return nil
            }
            let decoded = try JSONDecoder().decode(OFFResponse.self, from: data)
            guard decoded.status == 1, let product = decoded.product else {
                return nil
            }
            let food = Food(name: product.productName ?? "Unknown product", source: "off")
            food.brand = product.brands
            food.barcode = cleaned
            food.externalId = cleaned
            food.caloriesPer100g = product.nutriments?.energyKcal100g ?? 0
            food.proteinPer100g = product.nutriments?.proteins100g ?? 0
            food.carbsPer100g = product.nutriments?.carbohydrates100g ?? 0
            food.fatPer100g = product.nutriments?.fat100g ?? 0
            food.fiberPer100g = product.nutriments?.fiber100g ?? 0
            food.sugarPer100g = product.nutriments?.sugars100g ?? 0
            food.sodiumMgPer100g = (product.nutriments?.sodium100g ?? 0) * 1000
            food.servingSizeG = product.servingQuantity ?? 100
            food.servingDescription = product.servingSize ?? "100 g"
            context.insert(food)
            try? context.save()
            return BarcodeLookupResult(food: food, fromCache: false)
        } catch {
            logger.error("OFF lookup failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}

// MARK: - OFF API response

private struct OFFResponse: Decodable {
    let status: Int
    let product: Product?

    struct Product: Decodable {
        let productName: String?
        let brands: String?
        let nutriments: Nutriments?
        let servingSize: String?
        let servingQuantity: Double?

        enum CodingKeys: String, CodingKey {
            case productName = "product_name"
            case brands
            case nutriments
            case servingSize = "serving_size"
            case servingQuantity = "serving_quantity"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            productName = try c.decodeIfPresent(String.self, forKey: .productName)
            brands = try c.decodeIfPresent(String.self, forKey: .brands)
            nutriments = try c.decodeIfPresent(Nutriments.self, forKey: .nutriments)
            servingSize = try c.decodeIfPresent(String.self, forKey: .servingSize)
            // OFF sometimes returns serving_quantity as a string
            if let s = try? c.decodeIfPresent(String.self, forKey: .servingQuantity) {
                servingQuantity = Double(s)
            } else {
                servingQuantity = try c.decodeIfPresent(Double.self, forKey: .servingQuantity)
            }
        }
    }

    struct Nutriments: Decodable {
        let energyKcal100g: Double?
        let proteins100g: Double?
        let carbohydrates100g: Double?
        let fat100g: Double?
        let fiber100g: Double?
        let sugars100g: Double?
        let sodium100g: Double?

        enum CodingKeys: String, CodingKey {
            case energyKcal100g = "energy-kcal_100g"
            case proteins100g = "proteins_100g"
            case carbohydrates100g = "carbohydrates_100g"
            case fat100g = "fat_100g"
            case fiber100g = "fiber_100g"
            case sugars100g = "sugars_100g"
            case sodium100g = "sodium_100g"
        }
    }
}
