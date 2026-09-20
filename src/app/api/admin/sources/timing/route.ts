// src/app/api/admin/sources/timing/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sources, entities } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET: View timing information for a source or entity
 * Query params: ?sourceId=... or ?url=... or ?entityId=...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const url = searchParams.get('url');
    const entityId = searchParams.get('entityId');

    let targetSource = null;

    if (sourceId) {
      const rows = await db
        .select()
        .from(sources)
        .where(eq(sources.id, parseInt(sourceId, 10)))
        .limit(1);
      targetSource = rows[0] || null;
    } else if (url) {
      const rows = await db
        .select()
        .from(sources)
        .where(eq(sources.url, url))
        .limit(1);
      targetSource = rows[0] || null;
    } else if (entityId) {
      const entRows = await db
        .select()
        .from(entities)
        .where(eq(entities.id, parseInt(entityId, 10)))
        .limit(1);
      const entity = entRows[0];
      if (entity?.websiteUrl) {
        const rows = await db
          .select()
          .from(sources)
          .where(eq(sources.url, entity.websiteUrl))
          .limit(1);
        targetSource = rows[0] || null;
      }
    }

    if (!targetSource) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json({
      source: targetSource,
      isDue: targetSource.nextScrapeDue ? new Date(targetSource.nextScrapeDue) <= new Date() : false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST: Update timing or trigger instant scrape for a source or entity
 * Body: {
 *   sourceId?: number,
 *   url?: string,
 *   entityId?: number,
 *   scrapeIntervalDays?: number,
 *   forceNow?: boolean,
 *   status?: 'active' | 'paused' | 'disabled'
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, url, entityId, scrapeIntervalDays, forceNow, status } = body;

    let targetSourceId = sourceId;

    if (!targetSourceId && url) {
      const rows = await db
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.url, url))
        .limit(1);
      if (rows[0]) targetSourceId = rows[0].id;
    } else if (!targetSourceId && entityId) {
      const entRows = await db
        .select({ websiteUrl: entities.websiteUrl })
        .from(entities)
        .where(eq(entities.id, parseInt(entityId, 10)))
        .limit(1);
      if (entRows[0]?.websiteUrl) {
        const rows = await db
          .select({ id: sources.id })
          .from(sources)
          .where(eq(sources.url, entRows[0].websiteUrl))
          .limit(1);
        if (rows[0]) targetSourceId = rows[0].id;
      }
    }

    if (!targetSourceId) {
      return NextResponse.json(
        { error: 'Source not found for the given identifier' },
        { status: 404 }
      );
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (scrapeIntervalDays !== undefined && scrapeIntervalDays > 0) {
      updates.scrapeIntervalDays = scrapeIntervalDays;
    }

    if (status) {
      updates.status = status;
    }

    if (forceNow) {
      updates.nextScrapeDue = new Date();
    } else if (scrapeIntervalDays !== undefined && !forceNow) {
      updates.nextScrapeDue = sql`NOW() + (${scrapeIntervalDays} || ' days')::interval`;
    }

    const updated = await db
      .update(sources)
      .set(updates)
      .where(eq(sources.id, targetSourceId))
      .returning();

    return NextResponse.json({
      success: true,
      message: forceNow
        ? `Source ${targetSourceId} queued for IMMEDIATE scrape.`
        : `Source ${targetSourceId} timing updated.`,
      source: updated[0],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
