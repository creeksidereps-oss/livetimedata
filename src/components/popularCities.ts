export type PopularCity = {
  name: string;
  admin1?: string;
  country: string;
  slug: string;
  lat: number;
  lon: number;
};

export const popularCities: PopularCity[] = [
  { name: "New York", admin1: "New York", country: "United States", slug: "new-york-new-york-united-states", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", admin1: "California", country: "United States", slug: "los-angeles-california-united-states", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago", admin1: "Illinois", country: "United States", slug: "chicago-illinois-united-states", lat: 41.8781, lon: -87.6298 },
  { name: "Dallas", admin1: "Texas", country: "United States", slug: "dallas-texas-united-states", lat: 32.7767, lon: -96.797 },
  { name: "Miami", admin1: "Florida", country: "United States", slug: "miami-florida-united-states", lat: 25.7617, lon: -80.1918 },
  { name: "London", country: "United Kingdom", slug: "london-united-kingdom", lat: 51.5072, lon: -0.1276 },
  { name: "Paris", country: "France", slug: "paris-france", lat: 48.8566, lon: 2.3522 },
  { name: "Tokyo", country: "Japan", slug: "tokyo-japan", lat: 35.6895, lon: 139.6917 },
  { name: "Sydney", admin1: "New South Wales", country: "Australia", slug: "sydney-new-south-wales-australia", lat: -33.8688, lon: 151.2093 },
  { name: "Dubai", country: "United Arab Emirates", slug: "dubai-united-arab-emirates", lat: 25.2048, lon: 55.2708 },
];