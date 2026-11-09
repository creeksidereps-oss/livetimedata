// src/lib/discovery/lifecycle.ts
import { db } from '@/db';
import { entities, entityRelationships } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

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
 * Location: only what the caller verified for this entity. No country default â€” an entity with no
 * known country is stored with country_code NULL and deduplicated among other country-less entities.
 */
export async function upsertEntity(params: UpsertEntityParams) {
  const normName = normalizeEntityName(params.name);
  const country = params.countryCode ? params.countryCode.toUpperCase() : null;

  // Search existing entity by normalized name and country
  const existing = await db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.normalizedName, normName),
        country ? eq(entities.countryCode, country) : isNull(entities.countryCode)
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


// recordAppearance() was removed: it inserted rows into `events` directly with templated titles/descriptions
// and default times. Event rows are written only by publishEvent() (src/lib/events/intake/publishEvent.ts).
