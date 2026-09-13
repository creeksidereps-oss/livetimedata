// src/lib/discovery/seed-sources.ts

export interface DiscoverySeedHub {
  id: string;
  name: string;
  url: string;
  scope: 'local' | 'regional' | 'national' | 'global';
  category: 'directory' | 'appearances' | 'festivals' | 'association' | 'market_vendor';
  yieldType: 'vendors' | 'schedules' | 'festivals' | 'multi_vendor_hubs';
  notes: string;
}

export const MASTER_DISCOVERY_HUBS: DiscoverySeedHub[] = [
  {
    id: 'iredell_county_directory',
    name: 'Iredell County Food Truck Directory',
    url: 'https://www.iredellnc.com/food-trucks',
    scope: 'local',
    category: 'directory',
    yieldType: 'vendors',
    notes: 'Primary anchor seed for Statesville & Iredell County test laboratory.'
  },
  {
    id: 'foodtrucksin',
    name: 'FoodTrucksIn National Directory',
    url: 'https://www.foodtrucksin.com/food-truck-directory',
    scope: 'national',
    category: 'directory',
    yieldType: 'vendors',
    notes: 'Large U.S. directory organized geographically with cuisines and social profiles.'
  },
  {
    id: 'roaming_hunger',
    name: 'Roaming Hunger',
    url: 'https://roaminghunger.com/food-trucks/',
    scope: 'national',
    category: 'directory',
    yieldType: 'vendors',
    notes: 'Large metro markets, truck profiles, and booking hubs across the USA.'
  },
  {
    id: 'streetfoodfinder',
    name: 'StreetFoodFinder Real-Time Schedules',
    url: 'https://streetfoodfinder.com/food-trucks-near-me',
    scope: 'national',
    category: 'appearances',
    yieldType: 'schedules',
    notes: 'Scheduled truck appearances connecting Truck -> Venue -> Date/Time.'
  },
  {
    id: 'street_eats_finder',
    name: 'Street Eats Finder',
    url: 'https://streeteatsfinder.org/',
    scope: 'national',
    category: 'directory',
    yieldType: 'vendors',
    notes: 'Cross-country mobile food discovery database.'
  },
  {
    id: 'food_truck_festival_directory',
    name: 'Food Truck Festival Directory',
    url: 'https://foodtruckfestivaldirectory.com/',
    scope: 'national',
    category: 'festivals',
    yieldType: 'multi_vendor_hubs',
    notes: 'Multi-vendor festival hub revealing dozens of trucks per event.'
  },
  {
    id: 'ftfa',
    name: 'Food Truck Festivals of America',
    url: 'https://www.foodtruckfestivalsofamerica.com/',
    scope: 'national',
    category: 'festivals',
    yieldType: 'multi_vendor_hubs',
    notes: 'Major regional festival circuits, participating trucks, and dates.'
  },
  {
    id: 'nfta_associations',
    name: 'National Food Truck Association',
    url: 'https://nationalfoodtrucks.org/associations',
    scope: 'national',
    category: 'association',
    yieldType: 'multi_vendor_hubs',
    notes: 'Regional associations leading to member rosters and truck schedules.'
  },
  {
    id: 'vendors_map',
    name: 'VendorsMap',
    url: 'https://vendorsmap.com/food-trucks',
    scope: 'national',
    category: 'market_vendor',
    yieldType: 'multi_vendor_hubs',
    notes: 'Fairs, farmers markets, and community events seeking food trucks.'
  }
];
