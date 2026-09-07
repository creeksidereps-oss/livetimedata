import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
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

    // Revenue & Asset Links
    const officialInfoUrl = String(body.officialInfoUrl || "").trim();
    const socialUrls = String(body.socialUrls || "").trim();
    const affiliateUrl = String(body.affiliateUrl || "").trim(); 
    const registrationUrl = String(body.registrationUrl || "").trim(); 
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
    if (!title || !cityName || !venueName || eventDates.length === 0 || !userEmail || !userName) {
      return NextResponse.json(
        { ok: false, error: "Required fields missing from placement application matrix parameters" },
        { status: 400 }
      );
    }

    // Auto-Geocode and Register City (Nearby Engine Fix)
    try {
      const cityCheck = await sql`SELECT id FROM cities WHERE LOWER(name) = LOWER(${cityName}) LIMIT 1`;
      if (cityCheck.rows.length === 0) {
        console.log(`[GEOCODER] City '${cityName}' not found in database. Geocoding via Nominatim...`);
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(stateName)}&country=USA&format=json&limit=1`, {
          headers: { "User-Agent": "LiveTimeData-Auto-Geocoder/1.0" }
        });
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          const lat = parseFloat(geoData[0].lat);
          const lon = parseFloat(geoData[0].lon);
          await sql`INSERT INTO cities (name, admin1, latitude, longitude) VALUES (${cityName}, ${stateName}, ${lat}, ${lon})`;
          console.log(`[GEOCODER] Successfully registered ${cityName} at Lat: ${lat}, Lon: ${lon}`);
        }
      }
    } catch (geoErr) {
      console.error("[GEOCODER] Failed to geocode city:", geoErr);
    }

    // Trusted Users Bypass (Auto-Approve)
    const trustedEmails = ["employee@livetimedata.com", "admin@livetimedata.com", "trusted@venue.com"];
    const isTrusted = trustedEmails.includes(userEmail.toLowerCase());
    
    // AI Pre-Screening Pipeline & Franchise Matching
    let finalStatus = 'pending_review';
    let matchedFranchiseId = null;

    const franchiseCheck = await sql`
      SELECT id, corporate_email FROM franchises 
      WHERE ${venueName} ILIKE ('%' || name || '%')
      LIMIT 1
    `;

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

    // Direct write execution sequence into your Neon PostgreSQL database engine
    for (const eventDateStr of eventDates) {
      // Duplicate Detection Pipeline per date
      const existingCheck = await sql`
        SELECT id FROM events 
        WHERE title = ${title} 
        AND city_name = ${cityName} 
        AND state_name = ${stateName} 
        AND event_date = ${eventDateStr}::timestamp
        LIMIT 1
      `;
      if (existingCheck.rows.length > 0) {
        // Increment duplicate counter and silently continue
        await sql`UPDATE events SET duplicate_count = duplicate_count + 1 WHERE id = ${existingCheck.rows[0].id}`;
        continue;
      }

      await sql`
        INSERT INTO events (
          title, city_name, state_name, franchise_id, category, venue, venue_address,
          hosting_entity, source, start_time, event_date, details, affiliate_url,
          registration_url, user_name, user_email, user_phone, contact_email,
          contact_phone, official_info_url, social_urls, event_flyer_url, view_count, status
        ) VALUES (
          ${title}, ${cityName}, ${stateName}, ${matchedFranchiseId}, ${category},
          ${venueName}, ${venueAddress}, ${hostingEntity}, 'Public Event Submission',
          ${startTime}, ${eventDateStr}::timestamp, ${details}, ${affiliateUrl || null},
          ${registrationUrl || null}, ${userName}, ${userEmail}, ${userPhone || null},
          ${contactEmail || null}, ${contactPhone || null}, ${officialInfoUrl || null},
          ${socialUrls || null}, ${finalEventFlyerUrl || null}, 0, ${finalStatus}
        )
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("❌ EVENT PLACEMENT API ENGINE REJECTION ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Internal registry application pipeline transaction failed" },
      { status: 500 }
    );
  }
}