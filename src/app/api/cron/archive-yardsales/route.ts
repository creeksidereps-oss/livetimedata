// src/app/api/cron/archive-yardsales/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { and, eq, lte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Sunday Midnight Auto-Expiry Worker:
 * Automatically transitions past weekend yard and estate sales to 'archived'
 * so expired sales never clutter live city maps and feeds.
 */
export async function GET(request: Request) {
  try {
    // Expire yard sales whose scheduled date was prior to today's start
    const result = await db
      .update(events)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(events.category, 'Yard & Estate Sales'),
          eq(events.status, 'live'),
          sql`event_date < DATE_TRUNC('day', NOW())`
        )
      );

    return NextResponse.json({
      success: true,
      message: 'Archived expired weekend yard sales.',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error archiving yard sales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
