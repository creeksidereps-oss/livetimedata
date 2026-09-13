// src/app/api/events/yardsales/submit/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, emailLogs } from '@/db/schema';
import { validateYardSaleSubmission } from '@/lib/yardsales/validator';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      address,
      city,
      state,
      countryCode,
      eventDate,
      startTime,
      endTime,
      details,
      userEmail,
      userName,
      resubmitToken
    } = body;

    // Run 24/7/365 AI fast validation (<500ms)
    const validation = await validateYardSaleSubmission({
      title: title || 'Yard Sale',
      address: address || '',
      city: city || '',
      state: state || '',
      countryCode: countryCode || 'US',
      eventDate: eventDate,
      startTime: startTime || '',
      endTime: endTime || '',
      details: details || '',
      userEmail: userEmail || '',
      userName: userName || ''
    });

    const parsedDate = new Date(eventDate);
    const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    // Check if updating an existing submission via resubmitToken
    if (resubmitToken) {
      const existing = await db
        .select()
        .from(events)
        .where(eq(events.resubmitToken, resubmitToken))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(events)
          .set({
            title: title || existing[0].title,
            venue: address || existing[0].venue,
            cityName: city || existing[0].cityName,
            stateName: state || existing[0].stateName,
            eventDate: validDate,
            startTime: startTime || existing[0].startTime,
            details: details || existing[0].details,
            status: validation.approved ? 'live' : 'rejected',
            rejectionReason: validation.approved ? null : validation.reason,
            autoApprovedAt: validation.approved ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(events.id, existing[0].id));

        return NextResponse.json({
          success: true,
          status: validation.approved ? 'approved' : 'rejected',
          message: validation.approved 
            ? 'Resubmission approved and published live!' 
            : 'Resubmission still requires corrections.',
          reason: validation.reason,
          eventId: existing[0].id
        });
      }
    }

    // Insert new yard sale listing
    const [inserted] = await db
      .insert(events)
      .values({
        title: title || 'Weekend Yard Sale',
        cityName: city || 'Local Area',
        stateName: state || '',
        category: 'Yard & Estate Sales',
        venue: address || 'Local Address',
        startTime: startTime || '8:00 AM',
        eventDate: validDate,
        details: details || 'Local household goods, furniture, tools, and collectibles.',
        userName: userName || null,
        userEmail: userEmail || null,
        status: validation.approved ? 'live' : 'rejected',
        rejectionReason: validation.approved ? null : (validation.reason || null),
        resubmitToken: validation.approved ? null : (validation.resubmitToken || null),
        autoApprovedAt: validation.approved ? new Date() : null,
        source: 'Direct Community Submission',
      })
      .returning({ id: events.id });

    // If rejected, record automated rejection feedback email in email_logs
    if (!validation.approved && validation.rejectionEmailBody && userEmail) {
      await db.insert(emailLogs).values({
        contactId: 0,
        email: userEmail,
        status: 'sent',
        errorMessage: `AI Rejection Notice: ${validation.reason}`,
      });
    }

    return NextResponse.json({
      success: true,
      status: validation.approved ? 'approved' : 'rejected',
      eventId: inserted?.id,
      reason: validation.reason,
      resubmitToken: validation.resubmitToken,
      message: validation.approved 
        ? 'Your yard sale has been verified and is LIVE on LiveTimeData!'
        : 'Your listing needs a quick fix. We have sent an email with an instant resubmit link.'
    });

  } catch (error: any) {
    console.error('Error submitting yard sale:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
