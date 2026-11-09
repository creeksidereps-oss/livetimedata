// src/app/api/events/yardsales/submit/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { emailLogs } from '@/db/schema';
import { validateYardSaleSubmission } from '@/lib/yardsales/validator';
import { publishEvent } from '@/lib/events/intake/publishEvent';

export const dynamic = 'force-dynamic';

/**
 * Community yard-sale submission.
 * Moderation (validateYardSaleSubmission) decides approve/reject; approved listings are written by
 * publishEvent() (origin "user_submission", kind "sale") with exactly the location the submitter typed.
 * No defaults: no "Local Area", "Local Address", "Weekend Yard Sale", "8:00 AM", filler description,
 * today's date or "US".
 *
 * resubmitToken (legacy): rejected listings are no longer stored, so a resubmission is simply a new
 * submission that goes through the same checks. Old rejected rows are left untouched.
 */
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
    } = body;

    // Run 24/7/365 AI fast validation (<500ms)
    const validation = await validateYardSaleSubmission({
      title: title || '',
      address: address || '',
      city: city || '',
      state: state || '',
      countryCode: countryCode || undefined,
      eventDate: eventDate,
      startTime: startTime || '',
      endTime: endTime || '',
      details: details || '',
      userEmail: userEmail || '',
      userName: userName || ''
    });

    if (!validation.approved) {
      // If rejected, record automated rejection feedback email in email_logs
      if (validation.rejectionEmailBody && userEmail) {
        await db.insert(emailLogs).values({
          contactId: 0,
          email: userEmail,
          status: 'sent',
          errorMessage: `AI Rejection Notice: ${validation.reason}`,
        });
      }
      return NextResponse.json({
        success: true,
        status: 'rejected',
        reason: validation.reason,
        message: 'Your listing needs a quick fix: ' + (validation.reason || 'please check the details and submit again.'),
      });
    }

    const result = await publishEvent({
      origin: 'user_submission',
      kind: 'sale',
      title: String(title || '').trim(),
      details: String(details || '').trim(),
      category: 'Yard / Garage Sales',
      venue: String(address || '').trim(),
      venueAddress: String(address || '').trim() || null,
      startTime: String(startTime || '').trim(),
      eventDate: eventDate,
      location: {
        city: String(city || '').trim() || null,
        region: String(state || '').trim() || null,
        country: String(countryCode || '').trim() || null,
        address: String(address || '').trim() || null,
      },
      source: 'Direct Community Submission',
      userName: userName || null,
      userEmail: userEmail || null,
    });

    if (result.outcome === 'rejected' || result.outcome === 'retry') {
      return NextResponse.json({
        success: true,
        status: result.outcome,
        reason: [result.reasons.join(', '), result.detail].filter(Boolean).join(' - '),
        message: result.outcome === 'retry'
          ? "We couldn't verify the sale's city right now. Please try again in a few minutes."
          : `Your listing could not be accepted: ${result.reasons.join(', ')}${result.detail ? ` (${result.detail})` : ''}`,
      });
    }

    const status = result.outcome === 'published' ? 'approved' : result.outcome; // 'pending_review' | 'duplicate'
    return NextResponse.json({
      success: true,
      status,
      eventId: result.id,
      reason: result.reasons.length ? result.reasons.join(', ') : undefined,
      message:
        result.outcome === 'published' ? 'Your yard sale has been verified and is LIVE on LiveTimeData!'
        : result.outcome === 'duplicate' ? 'Yard sale details updated and enriched into existing listing!'
        : `Your yard sale was received and is held for a quick review (${result.reasons.join(', ')}).`,
    });

  } catch (error: any) {
    console.error('Error submitting yard sale:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
