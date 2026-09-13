// src/app/api/events/takedown/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Quick AI & Manual Takedown Endpoint:
 * Allows immediate unpublishing of reported or flagged listings.
 */
export async function POST(request: Request) {
  try {
    const { eventId, reason, adminKey } = await request.json();

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'Event ID required' }, { status: 400 });
    }

    await db
      .update(events)
      .set({
        status: 'takedown',
        rejectionReason: reason || 'Flagged for content violation',
        updatedAt: new Date()
      })
      .where(eq(events.id, Number(eventId)));

    return NextResponse.json({
      success: true,
      message: `Event #${eventId} unpublished immediately.`
    });
  } catch (error: any) {
    console.error('Error processing takedown:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
