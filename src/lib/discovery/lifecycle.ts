// src/lib/discovery/lifecycle.ts
import { db } from '@/db';
import { entities, entityRelationships, appearances, events } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface UpsertEntityParams {
  name: string;
  entityType: string;
  subtype?: string;
  cuisines?: string[];
  cityName?: string;
  stateName?: string;
  countryCode?: string;
  websiteUrl?: string;
  imageUrl?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  socialLinks?: Record<string, string>;
  verificationStatus?: 'discovered' | 'needs_review' | 'verified' | 'published';
}

/**
 * Normalizes entity name for deduplication (lowercased, punctuation removed).
 */
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Upserts an entity into the universal entity graph with deduplication.
 * If the entity already exists, merges cuisine tags and contact details without duplicating.
 */
export async function upsertEntity(params: UpsertEntityParams) {
  const normName = normalizeEntityName(params.name);
  const country = (params.countryCode || 'US').toUpperCase();

  // Search existing entity by normalized name and city/country
  const existing = await db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.normalizedName, normName),
        eq(entities.countryCode, country)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    const existingCuisines = (current.cuisines as string[]) || [];
    const mergedCuisines = Array.from(new Set([...existingCuisines, ...(params.cuisines || [])]));

    await db
      .update(entities)
      .set({
        subtype: params.subtype || current.subtype,
        cuisines: mergedCuisines,
        cityName: params.cityName || current.cityName,
        stateName: params.stateName || current.stateName,
        websiteUrl: params.websiteUrl || current.websiteUrl,
        imageUrl: params.imageUrl || current.imageUrl,
        logoUrl: params.logoUrl || current.logoUrl,
        phone: params.phone || current.phone,
        email: params.email || current.email,
        updatedAt: new Date()
      })
      .where(eq(entities.id, current.id));

    return current.id;
  }

  // Insert new entity
  const [inserted] = await db
    .insert(entities)
    .values({
      name: params.name,
      normalizedName: normName,
      entityType: params.entityType,
      subtype: params.subtype || 'food_truck',
      cuisines: params.cuisines || [],
      cityName: params.cityName,
      stateName: params.stateName,
      countryCode: country,
      websiteUrl: params.websiteUrl,
      imageUrl: params.imageUrl,
      logoUrl: params.logoUrl,
      phone: params.phone,
      email: params.email,
      socialLinks: params.socialLinks || {},
      verificationStatus: params.verificationStatus || 'published'
    })
    .returning({ id: entities.id });

  return inserted.id;
}

/**
 * Preserves the relationship graph: Entity A -> Relation -> Entity B.
 */
export async function recordRelationship(
  sourceEntityId: number,
  relationshipType: string,
  targetEntityId: number,
  sourceUrl?: string,
  metadata?: Record<string, any>
) {
  await db.insert(entityRelationships).values({
    sourceEntityId,
    relationshipType,
    targetEntityId,
    sourceUrl: sourceUrl || null,
    metadata: metadata || {}
  });
}

/**
 * Records an appearance: Entity at Venue on Date/Time.
 * Automatically copies the entity's stored graphic/logo into event_flyer_url so
 * it is catalogued once and reused everywhere without redundant searching!
 */
export async function recordAppearance(params: {
  entityId: number;
  entityName: string;
  venueEntityId?: number;
  venueName: string;
  cityName: string;
  stateName?: string;
  countryCode?: string;
  eventDate: Date;
  startTime?: string;
  endTime?: string;
  details?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  sourceUrl?: string;
}) {
  // 1. Create Appearance in entity graph
  const [app] = await db
    .insert(appearances)
    .values({
      entityId: params.entityId,
      venueEntityId: params.venueEntityId || null,
      eventDate: params.eventDate,
      startTime: params.startTime || '11:00 AM',
      endTime: params.endTime || '2:00 PM',
      isRecurring: params.isRecurring || false,
      recurrenceRule: params.recurrenceRule || null,
      sourceUrl: params.sourceUrl || null,
      status: 'published'
    })
    .returning({ id: appearances.id });

  // 2. Automatically retrieve the catalogued logo/photo from the entity record
  const [vendor] = await db
    .select({ imageUrl: entities.imageUrl, logoUrl: entities.logoUrl })
    .from(entities)
    .where(eq(entities.id, params.entityId))
    .limit(1);

  const finalGraphic = vendor?.imageUrl || vendor?.logoUrl || null;

  // 3. Project into the unified Events feed with the catalogued graphic
  await db.insert(events).values({
    title: `${params.entityName} at ${params.venueName}`,
    cityName: params.cityName,
    stateName: params.stateName || '',
    category: 'Food Trucks',
    venue: params.venueName,
    startTime: params.startTime || '11:00 AM',
    eventDate: params.eventDate,
    details: params.details || `${params.entityName} mobile food appearance at ${params.venueName}.`,
    eventFlyerUrl: finalGraphic,
    status: 'live',
    source: params.sourceUrl || 'Discovery Lifecycle'
  });

  return app?.id;
}
