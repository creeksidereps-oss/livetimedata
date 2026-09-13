// src/lib/locale-categories.ts

export interface CategoryLocaleConfig {
  label: string;
  searchKeywords: string[];
  subtypes: string[];
}

export const CATEGORY_LOCALIZATION: Record<string, Record<string, CategoryLocaleConfig>> = {
  mobile_street_food: {
    US: {
      label: "Food Trucks",
      searchKeywords: [
        "food truck",
        "food trailer",
        "food truck rodeo",
        "food truck rally",
        "food truck festival",
        "mobile kitchen"
      ],
      subtypes: ["food_truck", "food_trailer", "food_cart", "pop_up", "mobile_kitchen"]
    },
    CA: {
      label: "Food Trucks",
      searchKeywords: [
        "food truck",
        "street food",
        "food cart",
        "mobile food vendor"
      ],
      subtypes: ["food_truck", "food_trailer", "food_cart", "pop_up"]
    },
    GB: {
      label: "Street Food & Food Vans",
      searchKeywords: [
        "street food",
        "food van",
        "catering van",
        "market stall",
        "night market",
        "street food festival"
      ],
      subtypes: ["food_van", "catering_van", "market_stall", "street_food_vendor", "pop_up"]
    },
    AU: {
      label: "Food Trucks & Vans",
      searchKeywords: [
        "food truck",
        "food van",
        "street food",
        "pop-up food",
        "night noodle market"
      ],
      subtypes: ["food_truck", "food_van", "market_stall", "pop_up"]
    },
    DEFAULT: {
      label: "Food Trucks",
      searchKeywords: [
        "food truck",
        "street food",
        "mobile food",
        "food van",
        "market stall",
        "night market",
        "hawker"
      ],
      subtypes: ["food_truck", "food_van", "food_cart", "street_food_vendor", "market_stall", "hawker"]
    }
  },
  yard_estate_sales: {
    US: {
      label: "Yard / Garage Sales",
      searchKeywords: [
        "yard sale",
        "garage sale",
        "estate sale",
        "moving sale",
        "rummage sale",
        "neighborhood yard sale"
      ],
      subtypes: ["yard_sale", "garage_sale", "estate_sale", "moving_sale", "community_sale"]
    },
    CA: {
      label: "Yard / Garage Sales",
      searchKeywords: [
        "yard sale",
        "garage sale",
        "estate sale",
        "moving sale"
      ],
      subtypes: ["yard_sale", "garage_sale", "estate_sale"]
    },
    GB: {
      label: "Car Boot & Garage Sales",
      searchKeywords: [
        "car boot sale",
        "garage sale",
        "jumble sale",
        "estate clearance",
        "flea market"
      ],
      subtypes: ["car_boot_sale", "garage_sale", "jumble_sale", "estate_clearance"]
    },
    AU: {
      label: "Garage & Estate Sales",
      searchKeywords: [
        "garage sale",
        "estate sale",
        "moving sale",
        "car boot sale"
      ],
      subtypes: ["garage_sale", "estate_sale", "car_boot_sale"]
    },
    DEFAULT: {
      label: "Yard / Garage Sales",
      searchKeywords: [
        "yard sale",
        "garage sale",
        "estate sale",
        "flea market",
        "car boot sale"
      ],
      subtypes: ["yard_sale", "garage_sale", "estate_sale"]
    }
  }
};

/**
 * Resolves the public category label dynamically based on country code and locale.
 * Never hard-codes labels into frontend components.
 */
export function getLocalizedCategoryLabel(categoryKey: string, countryCode?: string | null): string {
  const normKey = categoryKey.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const country = (countryCode || "US").toUpperCase();

  if (normKey.includes("food") || normKey.includes("truck") || normKey === "mobile_street_food") {
    const config = CATEGORY_LOCALIZATION.mobile_street_food[country] || CATEGORY_LOCALIZATION.mobile_street_food.DEFAULT;
    return config.label;
  }

  if (normKey.includes("yard") || normKey.includes("garage") || normKey.includes("estate") || normKey === "yard_estate_sales") {
    const config = CATEGORY_LOCALIZATION.yard_estate_sales[country] || CATEGORY_LOCALIZATION.yard_estate_sales.DEFAULT;
    return config.label;
  }

  // Fallback / standard passthrough
  return categoryKey;
}

/**
 * Returns discovery keywords for automated crawlers and AI workers based on target country.
 */
export function getDiscoveryKeywords(categoryKey: 'mobile_street_food' | 'yard_estate_sales', countryCode?: string | null): string[] {
  const country = (countryCode || 'US').toUpperCase();
  const catConfigs = CATEGORY_LOCALIZATION[categoryKey];
  if (!catConfigs) return [];
  const config = catConfigs[country] || catConfigs.DEFAULT;
  return config.searchKeywords;
}
