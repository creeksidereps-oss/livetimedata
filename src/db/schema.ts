// src/db/schema.ts
import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision, bigint, jsonb } from "drizzle-orm/pg-core";

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  geonameId: bigint("geoname_id", { mode: "number" }).unique(),
  name: text("name").notNull(),
  asciiName: text("ascii_name"),
  alternateNames: text("alternate_names"),
  admin1: text("admin1"),
  admin2: text("admin2"),
  countryCode: text("country_code"),
  countryName: text("country_name"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  population: bigint("population", { mode: "number" }),
  elevation: integer("elevation"),
  timezone: text("timezone"),
  slug: text("slug").notNull().unique(),
  isCrawlable: boolean("is_crawlable").default(false),
  isIndexed: boolean("is_indexed").default(false),
  searchCount: integer("search_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cityReports = pgTable("city_reports", {
  id: serial("id").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  cityName: text("city_name"),
  stateName: text("state_name"),
  reportType: text("report_type").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userContributions = pgTable("user_contributions", {
  id: serial("id").primaryKey(),
  cityName: text("city_name").notNull(),
  stateName: text("state_name"),
  countryCode: text("country_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  cityPageUrl: text("city_page_url"),
  interestingInsights: text("interesting_insights"),
  localKnowledge: text("local_knowledge"),
  content: text("content"),
  pointsOfInterests: text("points_of_interest"),
  webcamLinks: text("webcam_links"),
  suggestionsCorrections: text("suggestions_corrections"),
  additionalNotes: text("additional_notes"),
  userName: text("user_name"),
  userEmail: text("user_email").notNull(),
  organizationGroup: text("organization_group"),
  promoReferenceCode: text("promo_reference_code"),
  ageComplianceStatus: text("age_compliance_status").default("verified_adult"),
  status: text("status").default("pending_review"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webcams = pgTable("webcams", {
  id: serial("id").primaryKey(),
  cityName: text("city_name").notNull(),
  stateName: text("state_name"),
  country: text("country"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  source: text("source").default("Unknown Source"),
  status: text("status").default("live"),
  embedUrl: text("embed_url"),
  imageUrl: text("image_url"),
  viewCount: integer("view_count").default(0),
  reportCount: integer("report_count").default(0),
  displayOrder: integer("display_order").default(0),
  isOperational: boolean("is_operational").default(true),
  isPremium: boolean("is_premium").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const venueProfiles = pgTable("venue_profiles", {
  id: serial("id").primaryKey(),
  venueName: text("venue_name").notNull().unique(),
  cityName: text("city_name").notNull(),
  stateName: text("state_name"),
  contactEmail: text("contact_email"),
  websiteUrl: text("website_url"),
  isTrustedSource: boolean("is_trusted_source").default(false), // Whitelist flag bypass option
  lastOutreachDate: timestamp("last_outreach_date"), // B2B anti-spam cooldown protection parameter
  createdAt: timestamp("created_at").defaultNow(),
});

export const franchises = pgTable("franchises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  corporateEmail: text("corporate_email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const franchiseLocations = pgTable("franchise_locations", {
  id: serial("id").primaryKey(),
  franchiseId: integer("franchise_id").notNull(),
  cityName: text("city_name").notNull(),
  stateName: text("state_name"),
  localAddress: text("local_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  cityName: text("city_name").notNull(),
  stateName: text("state_name"),
  franchiseId: integer("franchise_id"),
  category: text("category").notNull(), 
  venue: text("venue").notNull(),
  hostingEntity: text("hosting_entity"), // Sponsor, presenter, or organizer details profile
  source: text("source").default("Internal Submission"), // Ingestion track ledger identifier
  startTime: text("start_time").notNull(), 
  eventDate: timestamp("event_date").notNull(), 
  details: text("details").notNull(),
  affiliateUrl: text("affiliate_url"), 
  registrationUrl: text("registration_url"), // Vendor applications or signups loaded in modal layers
  viewCount: integer("view_count").default(0), // Monetization upsell impression validation metric
  status: text("status").default("pending_review"), // live, pending_review, needs_info, legal_hold
  
  // Premium Registry Form Data Fields
  userName: text("user_name"),
  userEmail: text("user_email"),
  userPhone: text("user_phone"),
  officialInfoUrl: text("official_info_url"),
  eventFlyerUrl: text("event_flyer_url"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailContacts = pgTable("email_contacts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  category: text("category").notNull(), // e.g., 'High School AD', 'Photographer', 'Business'
  cityName: text("city_name"),
  stateName: text("state_name"),
  countryCode: text("country_code"),
  status: text("status").default("active"), // active, bounced, complained, unsubscribed
  source: text("source").default("Manual Import"),
  metadata: jsonb("metadata"), // flexible field for demographics, tags, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const outreachTargets = pgTable("outreach_targets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // e.g. "Sports Teams", "Museums"
  website: text("website"),
  city: text("city"),
  state: text("state"),
  country: text("country").default("US"),
  metadata: jsonb("metadata"), // stores specific details like Sport, League
  isEmailVerified: boolean("is_email_verified").default(false), // Flips to true when the Agent moves them to email_contacts
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  targetCategory: text("target_category"),
  targetState: text("target_state"),
  status: text("status").default("draft"), // draft, scheduled, sending, completed, paused
  scheduledFor: timestamp("scheduled_for"),
  sentCount: integer("sent_count").default(0),
  bounceCount: integer("bounce_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  contactId: integer("contact_id").notNull(),
  email: text("email").notNull(),
  status: text("status").default("sent"), // sent, bounced, complained
  awsMessageId: text("aws_message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  cityName: text("city_name").notNull(),
  stateName: text("state_name"),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  source: text("source").default("User Submission"), // Print On Demand source, user upload, etc.
  photographerName: text("photographer_name"),
  rightsReleased: boolean("rights_released").default(false), // For POD
  status: text("status").default("pending_review"), // live, pending_review, rejected
  viewCount: integer("view_count").default(0),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  sourceType: text("source_type").default("venue").notNull(), // venue, organizer, artist_tour, ticket_platform, public_calendar
  name: text("name"),
  cityName: text("city_name"),
  stateName: text("state_name"),
  scrapeIntervalDays: integer("scrape_interval_days").default(30), // Monthly rescrape interval during build phase (30-day review window)
  scrapeHorizonMonths: integer("scrape_horizon_months").default(12), // Up to 12 months forward-looking scrape depth
  lastScrapedAt: timestamp("last_scraped_at"),
  nextScrapeDue: timestamp("next_scrape_due").defaultNow(),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const performers = pgTable("performers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").default("band"), // band, solo_artist, sports_team, theater_troupe, other
  tourPageUrl: text("tour_page_url"),
  officialSite: text("official_site"),
  contactEmail: text("contact_email"),
  tourScrapedAt: timestamp("tour_scraped_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});