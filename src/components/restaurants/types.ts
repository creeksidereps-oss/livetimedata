export type EstablishmentTier = "local" | "franchise" | "chain";

export type RestaurantItem = {
  id: string;
  name: string;
  cityName: string;
  stateName?: string;
  countryCode?: string;
  address: string;
  distanceMiles?: number; // e.g., 0 for in-city, 4.2, 18.5 for nearby
  
  // Classification
  tier: EstablishmentTier; // "local" = Local Gems / Diners / Delis, "franchise" = Regional / Franchise, "chain" = Fast-Food Chains
  primaryCuisine: string;  // e.g. "Diner & Deli", "BBQ", "Mexican", "Italian", "Bakery & Sweets", "Coffee", "American", "Asian"
  cuisines: string[];      // e.g. ["Deli", "Pastrami", "Breakfast", "Sandwiches"]
  priceRange?: "$" | "$$" | "$$$" | "$$$$";
  
  // Highlights & Description
  tagline?: string;
  description?: string;
  hours?: string;
  rating?: number;
  reviewCount?: number;
  
  // Media & Engagement
  photos: string[];        // Array of photo URLs (0 to 25 items). If empty, photo reel is hidden!
  viewCount: number;
  isSponsored?: boolean;   // Top tier sponsored placement
  
  // Action Links & Monetization
  menuUrl?: string;
  orderUrl?: string;       // Direct POS or affiliate delivery link (DoorDash, Toast, UberEats, etc.)
  reservationUrl?: string; // OpenTable, Resy, or direct booking
  googleReviewsUrl?: string; // Direct link to Google Reviews
  websiteUrl?: string;
  phone?: string;
  directionsUrl?: string;
};

export type RadiusOption = "0" | "15" | "30";
