export type PopularCity = {
  name: string;
  admin1: string;
  country: string;
  slug: string;
};

export const popularCities: PopularCity[] = [
  { name: "New York", admin1: "New York", country: "United States", slug: "new-york-new-york-united-states" },
  { name: "Los Angeles", admin1: "California", country: "United States", slug: "los-angeles-california-united-states" },
  { name: "Chicago", admin1: "Illinois", country: "United States", slug: "chicago-illinois-united-states" },
  { name: "Houston", admin1: "Texas", country: "United States", slug: "houston-texas-united-states" },
  { name: "Miami", admin1: "Florida", country: "United States", slug: "miami-florida-united-states" },

  { name: "London", admin1: "England", country: "United Kingdom", slug: "london-england-united-kingdom" },
  { name: "Paris", admin1: "Île-de-France", country: "France", slug: "paris-ile-de-france-france" },
  { name: "Berlin", admin1: "Berlin", country: "Germany", slug: "berlin-berlin-germany" },
  { name: "Rome", admin1: "Lazio", country: "Italy", slug: "rome-lazio-italy" },
  { name: "Madrid", admin1: "Madrid", country: "Spain", slug: "madrid-madrid-spain" },

  { name: "Tokyo", admin1: "Tokyo", country: "Japan", slug: "tokyo-tokyo-japan" },
  { name: "Seoul", admin1: "Seoul", country: "South Korea", slug: "seoul-seoul-south-korea" },
  { name: "Singapore", admin1: "Singapore", country: "Singapore", slug: "singapore-singapore-singapore" },
  { name: "Sydney", admin1: "New South Wales", country: "Australia", slug: "sydney-new-south-wales-australia" },
  { name: "Toronto", admin1: "Ontario", country: "Canada", slug: "toronto-ontario-canada" },
];