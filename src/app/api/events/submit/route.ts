import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { scheduleCityContentProvisioning } from "@/lib/cityContentWorkflow";
import { publishEvent, type IntakeResult } from "@/lib/events/intake/publishEvent";
import type { VerifiedLocation } from "@/lib/events/location/resolveLocation";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Parse out our newly optimized premium form criteria variables
    const title = String(body.title || "").trim();
    const cityName = String(body.cityName || "").trim();
    const stateName = String(body.stateName || "").trim();
    const countryHint = String(body.countryCode || body.countryName || "").trim();
    const category = String(body.category || "Other").trim();
    const venueName = String(body.venueName || "").trim();
    const venueAddress = String(body.venueAddress || "").trim();
    const hostingEntity = String(body.hostingEntity || "").trim();
    const startTime = String(body.startTime || "").trim();
    const eventDates: string[] = body.eventDates || [];
    const details = String(body.details || "").trim();
    
    // Contact Information (Private Submitter)
    const userName = String(body.userName || "").trim();
    const userEmail = String(body.userEmail || "").trim();
    const userPhone = String(body.userPhone || "").trim();

    // Official Event Contact (Public)
    const contactEmail = String(body.contactEmail || "").trim();
    const contactPhone = String(body.contactPhone || "").trim();

    // Revenue & Asset Links (the submission forms send ticketUrl / vendorUrl)
    const officialInfoUrl = String(body.officialInfoUrl || "").trim();
    const socialUrls = String(body.socialUrls || "").trim();
    const affiliateUrl = String(body.affiliateUrl || body.ticketUrl || "").trim(); 
    const registrationUrl = String(body.registrationUrl || body.vendorUrl || "").trim(); 
    const flyerBase64 = body.flyerBase64 || null; 
    let finalEventFlyerUrl = String(body.eventFlyerUrl || "").trim(); 

    // Handle Base64 Image Upload
    if (flyerBase64) {
      try {
        const matches = flyerBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1];
          const data = matches[2];
          const buffer = Buffer.from(data, "base64");
          const filename = `flyer_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
          
          const uploadDir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(uploadDir, { recursive: true });
          
          await fs.writeFile(path.join(uploadDir, filename), buffer);
          finalEventFlyerUrl = `/uploads/${filename}`;
        }
      } catch (err) {
        console.error("Failed to save base64 flyer:", err);
      }
    } 

    // Mandatory structural parameters baseline check
    if (!title || !cityName || eventDates.length === 0 || !userEmail || !userName) {
      return NextResponse.json(
        { ok: false, error: "Required fields missing from placement application matrix parameters" },
        { status: 400 }
      );
    }

    // City registration/geocoding is done by publishEvent() -> resolveLocation() (verified, no defaults).

    // Trusted Users Bypass (Auto-Approve)
    const trustedEmails = ["employee@livetimedata.com", "admin@livetimedata.com", "trusted@venue.com"];
    const isTrusted = trustedEmails.includes(userEmail.toLowerCase());
    
    // AI Pre-Screening Pipeline & Franchise Matching
    // Moderation decision only: 'rejected' = not stored, 'legal_hold' / 'franchise_pending' / 'pending_review' = held,
    // 'approved' = allowed to go live IF publishEvent()'s rules also pass.
    let finalStatus = 'pending_review';
    let matchedFranchiseId: number | null = null;

    const franchiseCheck = venueName ? await sql`
      SELECT id, corporate_email FROM franchises 
      WHERE ${venueName} ILIKE ('%' || name || '%')
      LIMIT 1
    ` : { rows: [] as any[] };

    if (franchiseCheck.rows.length > 0) {
      matchedFranchiseId = franchiseCheck.rows[0].id;
      if (!isTrusted) {
        finalStatus = 'franchise_pending';
        // Send real email to franchise corporate
        const corporateEmail = franchiseCheck.rows[0].corporate_email;
        console.log(`\n[EMAIL DISPATCH] To: ${corporateEmail}`);
        await sendEmail({
          to: corporateEmail,
          subject: `A user submitted an event for your store in ${cityName}!`,
          html: `<p>Hello!</p><p>Someone submitted '<b>${title}</b>' at ${venueName}. Does this apply to all your locations?</p><p>Log into LiveTimeData to verify and Mass-Publish to all locations!</p>`
        });
      }
    } else {
      const socialLower = socialUrls.toLowerCase();
      const hasBadSocials = socialLower.includes("facebook") || socialLower.includes("instagram") || socialLower.includes("fb.me");
      if (hasBadSocials) {
        finalStatus = 'pending_review';
      }
    }

    // --- AI SECURITY HUB INTERCEPTION ---
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && !isTrusted) {
        const securityPrompt = `You are a strict security and moderation AI. Analyze the following event submission. 
        Determine if it contains ANY of the following: 
        1. Malware links, phishing, or extremely suspicious URLs.
        2. Explicit, adult, or highly offensive content.
        3. Blatant spam (e.g. "Buy crypto here", nonsensical gibberish meant to spam).
        
        If it violates any of these, reply with EXACTLY the word "REJECT".
        If it seems legally questionable or needs very close human review, reply with EXACTLY the word "FLAG".
        Otherwise, reply with EXACTLY the word "CLEAN".

        Event Title: ${title}
        Event Details: ${details}
        Event Links: ${affiliateUrl} ${registrationUrl} ${officialInfoUrl} ${socialUrls}
        `;

        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: securityPrompt }] }] })
          }
        );

        if (aiRes.ok) {
          const data = await aiRes.json();
          const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase() || "";
          
          if (aiText.includes("REJECT")) {
            finalStatus = "rejected";
            console.log(`[AI SECURITY HUB] Event REJECTED: ${title}`);
          } else if (aiText.includes("FLAG")) {
            finalStatus = "legal_hold";
            console.log(`[AI SECURITY HUB] Event FLAGGED: ${title}`);
          } else if (aiText.includes("CLEAN") && finalStatus === 'pending_review') {
            // Auto-publish clean yard sales, garage sales, estate sales, auctions, auditions, community sales
            const catLower = (category + " " + title).toLowerCase();
            const isAutoApprovedCategory = 
              catLower.includes("yard") || 
              catLower.includes("garage") || 
              catLower.includes("estate") || 
              catLower.includes("auction") || 
              catLower.includes("audition") || 
              catLower.includes("casting") || 
              catLower.includes("tryout") || 
              catLower.includes("market") || 
              catLower.includes("community") || 
              catLower.includes("civic");

            if (isAutoApprovedCategory) {
              finalStatus = "approved";
              console.log(`[AI AUTO-PUBLISH] Clean event auto-approved: ${title}`);
            }
          }
        }
      }
    } catch (aiErr) {
      console.error("AI Security Hub Error:", aiErr);
    }
    // --- END AI SECURITY HUB ---

    if (isTrusted) {
      finalStatus = 'approved';
    }

    if (finalStatus === 'rejected') {
      return NextResponse.json(
        { ok: false, status: 'rejected', error: "This submission was blocked by our safety review (spam, unsafe links or adult content)." },
        { status: 422 }
      );
    }

    // Every date goes through publishEvent(): verified location (exactly as the submitter typed it, no defaults),
    // date/time rules, description rules and duplicate merging.
    const results: Array<{ eventDate: string; outcome: IntakeResult["outcome"]; id?: number; reasons: string[]; detail?: string }> = [];
    let verified: VerifiedLocation | undefined;
    for (const eventDateStr of eventDates) {
      const result = await publishEvent({
        origin: "user_submission",
        title,
        details,
        category,
        venue: venueName,
        venueAddress: venueAddress || null,
        hostingEntity: hostingEntity || null,
        startTime,
        eventDate: eventDateStr,
        location: {
          city: cityName,
          region: stateName || null,
          country: countryHint || null,
          address: venueAddress || null,
          sourceUrl: officialInfoUrl || null,
        },
        source: "Public Event Submission",
        franchiseId: matchedFranchiseId,
        affiliateUrl: affiliateUrl || null,
        registrationUrl: registrationUrl || null,
        officialInfoUrl: officialInfoUrl || null,
        socialUrls: socialUrls || null,
        eventFlyerUrl: finalEventFlyerUrl || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        userName,
        userEmail,
        userPhone: userPhone || null,
        // Only moderation-approved submissions may go live; everything else is held for a human.
        forcePending: finalStatus !== 'approved',
      });
      if (result.location) verified = result.location;

      // Moderation queues that the curation UI understands (franchise mass-publish, legal hold) on the row we just created.
      if (result.id && result.outcome === 'pending_review' && (finalStatus === 'franchise_pending' || finalStatus === 'legal_hold')) {
        await sql`UPDATE events SET status = ${finalStatus}, updated_at = NOW() WHERE id = ${result.id} AND status = 'pending_review'`;
      }
      results.push({ eventDate: eventDateStr, outcome: result.outcome, id: result.id, reasons: result.reasons, detail: result.detail });
    }

    if (verified) {
      scheduleCityContentProvisioning({
        cityName: verified.cityName,
        admin1: verified.admin1,
        country: verified.countryName,
        countryCode: verified.countryCode,
        lat: verified.lat,
        lon: verified.lon,
        timezone: verified.timezone,
      });
    }

    const saved = results.filter((r) => r.outcome === 'published' || r.outcome === 'pending_review' || r.outcome === 'duplicate');
    const failed = results.filter((r) => r.outcome === 'rejected' || r.outcome === 'retry');
    const describe = (r: (typeof results)[number]) => `${r.eventDate}: ${r.reasons.join(", ") || r.outcome}${r.detail ? ` (${r.detail})` : ""}`;

    if (saved.length === 0) {
      const retry = failed.some((r) => r.outcome === 'retry');
      return NextResponse.json(
        {
          ok: false,
          status: retry ? 'retry' : 'rejected',
          results,
          error: retry
            ? "We couldn't verify the event's city right now. Please try again in a few minutes."
            : `Your event could not be accepted: ${failed.map(describe).join("; ")}`,
        },
        { status: retry ? 503 : 422 }
      );
    }

    const anyLive = saved.some((r) => r.outcome === 'published');
    const held = saved.filter((r) => r.outcome === 'pending_review');
    return NextResponse.json({
      ok: true,
      status: anyLive ? 'live' : held.length ? 'pending_review' : 'duplicate',
      results,
      message: held.length
        ? `Received. Held for review: ${held.map(describe).join("; ")}`
        : anyLive ? "Your event is live." : "This event is already listed; we merged your details into it.",
    });
  } catch (error: any) {
    console.error("❌ EVENT PLACEMENT API ENGINE REJECTION ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Internal registry application pipeline transaction failed" },
      { status: 500 }
    );
  }
}
