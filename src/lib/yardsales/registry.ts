// src/lib/yardsales/registry.ts

export interface YardSaleSourceDef {
  id: string;
  name: string;
  domain: string;
  tier: 1 | 2 | 3;
  status: 'active' | 'backlog' | 'manual_only';
  feedType: 'rss' | 'html' | 'json_api' | 'app_feed' | 'walled_garden';
  notes: string;
}

export const YARD_SALE_SOURCES: YardSaleSourceDef[] = [
  // --- TIER 1: ACTIVE (Scraped Wednesday & Friday Nights) ---
  {
    id: 'craigslist_gms',
    name: 'Craigslist Garage Sales',
    domain: 'craigslist.org',
    tier: 1,
    status: 'active',
    feedType: 'rss',
    notes: 'Subregion RSS and search/gms endpoints. Clean, high yield, public.'
  },
  {
    id: 'yardsalesearch',
    name: 'YardSaleSearch.com',
    domain: 'yardsalesearch.com',
    tier: 1,
    status: 'active',
    feedType: 'html',
    notes: 'Organized by zip code and metro. Clean server-rendered HTML.'
  },
  {
    id: 'estatesales_net',
    name: 'EstateSales.net',
    domain: 'estatesales.net',
    tier: 1,
    status: 'active',
    feedType: 'html',
    notes: 'Gold standard for estate liquidations. Schema.org/Event structured data.'
  },
  {
    id: 'gsalr_network',
    name: 'Gsalr Network (gsalr.com / garagesalefinder.com / yardsales.net)',
    domain: 'gsalr.com',
    tier: 1,
    status: 'active',
    feedType: 'json_api',
    notes: 'Shared underlying map and sale API. Single endpoint extracts across 3 sites.'
  },
  {
    id: 'storagetreasures_live',
    name: 'StorageTreasures Live In-Person Auctions',
    domain: 'storagetreasures.com',
    tier: 1,
    status: 'active',
    feedType: 'json_api',
    notes: 'Nationwide live in-person self-storage lien auctions held on-site at physical facilities with exact street addresses.'
  },

  // --- TIER 2: SECONDARY FEEDS (Backlog Cache) ---
  {
    id: 'estatesales_org',
    name: 'EstateSales.org',
    domain: 'estatesales.org',
    tier: 2,
    status: 'backlog',
    feedType: 'html',
    notes: 'Cloudflare-protected directory. Good quality listings.'
  },
  {
    id: 'yardsaletreasuremap',
    name: 'Yard Sale Treasure Map',
    domain: 'yardsaletreasuremap.com',
    tier: 2,
    status: 'backlog',
    feedType: 'app_feed',
    notes: 'Aggregates Craigslist + user app submissions.'
  },
  {
    id: 'garagesaletracker',
    name: 'Garage Sale Tracker',
    domain: 'garagesaletracker.com',
    tier: 2,
    status: 'backlog',
    feedType: 'html',
    notes: 'State and county directory.'
  },

  // --- TIER 3: WALLED GARDENS & HIGH FRICTION (Backlog Cache) ---
  {
    id: 'facebook_marketplace',
    name: 'Facebook Marketplace & Groups',
    domain: 'facebook.com',
    tier: 3,
    status: 'manual_only',
    feedType: 'walled_garden',
    notes: 'Login wall, bot blocking. Handled via user 1-click URL import tool.'
  },
  {
    id: 'nextdoor',
    name: 'Nextdoor Neighborhood Sales',
    domain: 'nextdoor.com',
    tier: 3,
    status: 'manual_only',
    feedType: 'walled_garden',
    notes: 'Hyper-local authentication silo. Handled via resident manual sharing.'
  },
  {
    id: 'yelp_sales',
    name: 'Yelp Garage Sales',
    domain: 'yelp.com',
    tier: 3,
    status: 'backlog',
    feedType: 'walled_garden',
    notes: 'Low garage sale density; mostly commercial liquidators.'
  }
];

export function getActiveTier1Sources(): YardSaleSourceDef[] {
  return YARD_SALE_SOURCES.filter(s => s.tier === 1 && s.status === 'active');
}

export function getBacklogSources(): YardSaleSourceDef[] {
  return YARD_SALE_SOURCES.filter(s => s.tier > 1 || s.status !== 'active');
}
