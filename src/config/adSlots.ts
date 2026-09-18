// src/config/adSlots.ts

/**
 * Master Advertising Slots Configuration for LiveTimeData.
 *
 * NOTE FOR ADSENSE REVIEW:
 * Set ADS_ENABLED to false while awaiting Google AdSense approval.
 * Google's policy strictly prohibits displaying empty ad boxes, wireframes,
 * or "Advertisement Space" banners on a site undergoing review.
 *
 * Once AdSense is approved, flipping ADS_ENABLED to true activates all
 * designated ad placements automatically.
 */
export const ADS_ENABLED = false;

export const AD_SLOTS = {
  // Homepage
  HOME_CITY_GRID_INTERVAL: 9, // Every 9th city card in popular grid
  HOME_LEADERBOARD: "home-leaderboard",

  // City Dashboard Main Column
  DASHBOARD_UNDER_WEATHER: "adsense-under-weather",
  DASHBOARD_UNDER_WEBCAMS: "adsense-under-webcams",
  DASHBOARD_UNDER_EVENTS: "adsense-under-events",
  DASHBOARD_UNDER_PHOTO_REEL: "adsense-under-photo-reel",

  // City Dashboard Right Rail
  RAIL_AD_LEFT: "rail-ad-left",
  RAIL_AD_LEFT_BOTTOM: "rail-ad-left-bottom",
  RAIL_AD_RIGHT: "rail-ad-right",
  RAIL_AD_RIGHT_BOTTOM: "rail-ad-right-bottom",

  // Modals & Inline Placements
  MODAL_INSIGHTS_SUBMIT: "modal-insights-submit",
  MODAL_PHOTO_SUBMIT: "modal-photo-submit",
  MODAL_INFO_BOTTOM: "modal-info-bottom",
  PHOTO_REEL_INLINE: "photo-reel-inline",
  WEBCAMS_INLINE: "webcams-inline",
  EVENTS_INLINE: "events-inline",

  // Compliance / Footer Pages
  FOOTER_PAGE_TOP: "footer-page-top",
  FOOTER_PAGE_BOTTOM: "footer-page-bottom",
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;
