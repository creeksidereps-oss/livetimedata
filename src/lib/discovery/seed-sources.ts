// src/lib/discovery/seed-sources.ts

export interface DiscoverySeedHub {
  id: string;
  name: string;
  url: string;
  scope: 'local' | 'regional' | 'national' | 'global';
  category: 'directory' | 'appearances' | 'festivals' | 'association' | 'market_vendor' | 'public_calendar';
  yieldType: 'vendors' | 'schedules' | 'festivals' | 'multi_vendor_hubs' | 'events';
  notes: string;
}

export const MASTER_DISCOVERY_HUBS: DiscoverySeedHub[] = [
  // --- Regional & State Cultural / Event Calendars ---
  {
    id: 'nc_dncr_events',
    name: 'North Carolina DNCR Master Event Calendar',
    url: 'https://events.dncr.nc.gov/',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Statewide museums, historic sites, parks, festivals, and cultural events across North Carolina.'
  },
  {
    id: 'visit_nc_events',
    name: 'Visit North Carolina Events Portal',
    url: 'https://www.visitnc.com/events',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Official state tourism event index.'
  },
  {
    id: 'downtown_statesville',
    name: 'Downtown Statesville Development Corporation',
    url: 'https://www.downtownstatesville.com/events/',
    scope: 'local',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Historic downtown Statesville concerts, art crawls, festivals, and community gatherings.'
  },
  {
    id: 'downtown_mooresville',
    name: 'Downtown Mooresville Events',
    url: 'https://www.downtownmooresville.com/events',
    scope: 'local',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Live music, festivals, vendor markets, and town events in Mooresville.'
  },
  {
    id: 'visit_lake_norman',
    name: 'Visit Lake Norman Calendar',
    url: 'https://www.visitlakenorman.org/events/',
    scope: 'local',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Lake Norman region events across Cornelius, Davidson, Huntersville, and Mooresville.'
  },
  {
    id: 'johnston_county_events',
    name: 'Johnston County Visitors Bureau Events',
    url: 'https://www.johnstoncountync.org/events/',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Festivals, concerts, and family events across Johnston County.'
  },
  {
    id: 'visit_alexander_nc',
    name: 'Visit Alexander County Calendar',
    url: 'https://visitalexandernc.com/calendar/',
    scope: 'local',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Hiddenite Arts, Taylorsville farmers markets, and community events.'
  },

  // --- High-Density Eventbrite Discovery Hubs ---
  {
    id: 'eventbrite_statesville',
    name: 'Eventbrite Statesville Community Feed',
    url: 'https://www.eventbrite.com/d/nc--statesville/events/',
    scope: 'local',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Real-time live listings for Statesville, Troutman, and Iredell County.'
  },
  {
    id: 'eventbrite_mooresville',
    name: 'Eventbrite Mooresville Feed',
    url: 'https://www.eventbrite.com/d/nc--mooresville/events/',
    scope: 'local',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Live listings for Mooresville and Lake Norman.'
  },
  {
    id: 'eventbrite_hickory',
    name: 'Eventbrite Hickory Feed',
    url: 'https://www.eventbrite.com/d/nc--hickory/events/',
    scope: 'local',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Hickory, Catawba, and Newton live events.'
  },
  {
    id: 'eventbrite_charlotte',
    name: 'Eventbrite Charlotte Metro Hub',
    url: 'https://www.eventbrite.com/d/nc--charlotte/events/',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Charlotte metropolitan region concert, culinary, and festival index.'
  },
  {
    id: 'eventbrite_raleigh',
    name: 'Eventbrite Raleigh Metro Hub',
    url: 'https://www.eventbrite.com/d/nc--raleigh/events/',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Raleigh and Triangle area events.'
  },
  {
    id: 'eventbrite_winston_salem',
    name: 'Eventbrite Winston-Salem Hub',
    url: 'https://www.eventbrite.com/d/nc--winston-salem/events/',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Piedmont Triad arts, music, and social events.'
  },
  {
    id: 'eventbrite_greensboro',
    name: 'Eventbrite Greensboro Hub',
    url: 'https://www.eventbrite.com/d/nc--greensboro/events/',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Greensboro and Guilford County community events.'
  },
  {
    id: 'eventbrite_asheville',
    name: 'Eventbrite Asheville Hub',
    url: 'https://www.eventbrite.com/d/nc--asheville/events/',
    scope: 'regional',
    category: 'public_calendar',
    yieldType: 'events',
    notes: 'Western NC live music, breweries, and outdoor events.'
  },

  // --- Mobile Food & Vendor Seed Hubs ---
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
