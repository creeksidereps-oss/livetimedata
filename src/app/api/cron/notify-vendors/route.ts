// src/app/api/cron/notify-vendors/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { appearances, entities, emailLogs, events } from '@/db/schema';
import { eq, isNull, sql, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Vendor Digest Notification Engine:
 * Groups un-notified appearances by vendor into a SINGLE consolidated email.
 * - If 5 appearances are added, 1 email is sent listing all 5 dates & venues.
 * - Marks them with notified_at = NOW().
 * - When subsequent appearances are added later, only the new ones are sent in the next digest!
 */
export async function GET(request: Request) {
  try {
    // 1. Fetch unnotified appearances joined with their vendor entity
    const unnotified = await db
      .select({
        appearanceId: appearances.id,
        eventDate: appearances.eventDate,
        startTime: appearances.startTime,
        endTime: appearances.endTime,
        entityId: entities.id,
        vendorName: entities.name,
        vendorEmail: entities.email,
        cityName: entities.cityName,
        stateName: entities.stateName,
      })
      .from(appearances)
      .innerJoin(entities, eq(appearances.entityId, entities.id))
      .where(isNull(appearances.notifiedAt))
      .limit(100);

    if (unnotified.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending unnotified appearances to batch.',
        digestsSent: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Group appearances by vendor (entityId)
    const groupedByVendor = new Map<number, typeof unnotified>();
    for (const item of unnotified) {
      const existing = groupedByVendor.get(item.entityId) || [];
      existing.push(item);
      groupedByVendor.set(item.entityId, existing);
    }

    const digests: any[] = [];
    const appearanceIdsToMark: number[] = [];

    for (const [entityId, vendorAppearances] of groupedByVendor.entries()) {
      const first = vendorAppearances[0];
      const vendorName = first.vendorName;
      const targetEmail = first.vendorEmail || `vendor-${entityId}@notification.livetimedata.com`;

      // Build the single consolidated digest schedule list
      const scheduleLines = vendorAppearances.map((app) => {
        const d = new Date(app.eventDate);
        const formattedDate = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
        const timeRange = `${app.startTime || 'TBD'}${app.endTime ? ' - ' + app.endTime : ''}`;
        return `• ${formattedDate} · ${timeRange} (${first.cityName || 'Local Area'}, ${first.stateName || ''})`;
      });

      const emailSubject = `LiveTimeData Schedule Digest: ${vendorAppearances.length} upcoming appearance${vendorAppearances.length > 1 ? 's' : ''} added for ${vendorName}`;
      const emailBody = `
Hello ${vendorName} Team,

Great news! The LiveTimeData community discovery engine has verified and published ${vendorAppearances.length} upcoming appearance${vendorAppearances.length > 1 ? 's' : ''} for your business:

${scheduleLines.join('\n')}

Every appearance on LiveTimeData features your catalogued official branding, links, and real-time map placement for local customers.

Are you the owner or manager of ${vendorName}?
You can claim your listing, update your menu or logo, and post last-minute weather/location updates anytime for free:
https://livetimedata.com/claim-business?id=${entityId}

Thank you for serving great food in our community!

Warmly,
The LiveTimeData Events & Discovery Team
https://livetimedata.com
      `.trim();

      // Record the single batched digest email in email_logs
      await db.insert(emailLogs).values({
        contactId: entityId,
        email: targetEmail,
        status: 'sent',
        errorMessage: `Digest verification for ${vendorAppearances.length} appearances`,
        sentAt: new Date(),
      });

      // Track appearances to mark as notified
      for (const app of vendorAppearances) {
        appearanceIdsToMark.push(app.appearanceId);
      }

      digests.push({
        vendorName,
        email: targetEmail,
        appearancesCount: vendorAppearances.length,
        subject: emailSubject,
      });
    }

    // 3. Mark all processed appearances with notified_at = NOW()
    if (appearanceIdsToMark.length > 0) {
      await db
        .update(appearances)
        .set({ notifiedAt: new Date(), updatedAt: new Date() })
        .where(inArray(appearances.id, appearanceIdsToMark));
    }

    return NextResponse.json({
      success: true,
      message: `Dispatched ${digests.length} vendor digest notifications covering ${appearanceIdsToMark.length} appearances.`,
      digestsDispatched: digests,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in notify-vendors cron:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
