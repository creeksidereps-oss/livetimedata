import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let data: Record<string, any> = {};

    if (contentType.includes("application/json")) {
      data = await request.json();
    } else {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
    }

    const cityName = String(data.cityName || "").trim();
    const stateName = String(data.stateName || "").trim();
    const countryCode = String(data.countryCode || "").trim();
    const latStr = data.lat;
    const lngStr = data.lng;
    const cityPageUrl = String(data.cityPageUrl || "");

    const q1 = String(data.question1 || "").trim();
    const q2 = String(data.question2 || "").trim();
    const q3 = String(data.question3 || "").trim();
    const q4 = String(data.question4 || "").trim();
    const q6 = String(data.question6 || "").trim();
    const q7 = String(data.question7 || "").trim();
    const supportingUrl = String(data.supportingUrl || data.supportingLink || "").trim();
    const additionalNotes = String(data.additionalNotes || "").trim();

    const userName = String(data.userName || "").trim();
    const userEmail = String(data.userEmail || "").trim();
    const organization = String(data.organization || "").trim();
    const promoCode = String(data.referenceCode || data.promoCode || "").trim().toUpperCase();

    const ageRange = String(data.ageRange || "18+");
    const parentName = String(data.parentName || "").trim();
    const parentEmail = String(data.parentEmail || "").trim();
    const content = String(data.content || "");

    const latitude = latStr ? parseFloat(String(latStr)) : 0;
    const longitude = lngStr ? parseFloat(String(lngStr)) : 0;

    const consolidatedContent = content 
      ? `[Direct Content]: ${content}\n[Links]: ${supportingUrl}\n[Notes]: ${additionalNotes}`
      : `[Q1]: ${q1}\n[Q2]: ${q2}\n[Q3]: ${q3}\n[Q4]: ${q4}\n[Q6]: ${q6}\n[Q7]: ${q7}\n[Links]: ${supportingUrl}\n[Notes]: ${additionalNotes}`;

    let ageStatus = "verified_adult";
    let adminNotes = "Standard submission.";

    if (ageRange !== "18+") {
      ageStatus = `minor_${ageRange.replace("-", "_").toLowerCase()}`;
      adminNotes = `Parent: ${parentName} (${parentEmail})`;
    }

    if (promoCode.startsWith("EDU-")) {
      ageStatus = "educational_assignment";
      adminNotes += " | School Group Code detected.";
    }

    // --- AI SECURITY HUB INTERCEPTION ---
    let finalStatus = "pending_review";
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const securityPrompt = `You are a strict security and moderation AI. Analyze the following user submission for a local city guide. 
        Determine if it contains ANY of the following: 
        1. Malware links, phishing, or extremely suspicious URLs.
        2. Explicit, adult, or highly offensive content.
        3. Blatant spam (e.g. "Buy crypto here", nonsensical gibberish meant to spam).
        
        If it violates any of these, reply with EXACTLY the word "REJECT".
        If it seems legally questionable or needs very close human review, reply with EXACTLY the word "FLAG".
        Otherwise, reply with EXACTLY the word "CLEAN".

        Submission Content:
        ${consolidatedContent}
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
            adminNotes += " | [AI SECURITY HUB]: Marked as REJECT (Malware/Spam/Explicit).";
          } else if (aiText.includes("FLAG")) {
            finalStatus = "legal_hold";
            adminNotes += " | [AI SECURITY HUB]: Marked as FLAG (Requires legal/human review).";
          } else {
            adminNotes += " | [AI SECURITY HUB]: Marked as CLEAN.";
          }
        }
      }
    } catch (aiErr) {
      console.error("AI Security Hub Error:", aiErr);
    }
    // --- END AI SECURITY HUB ---

    // DIRECT WRITE TO USER_CONTRIBUTIONS TABLE
    await sql`
      INSERT INTO user_contributions (
        city_name, state_name, country_code, latitude, longitude, city_page_url,
        interesting_insights, local_knowledge, content, points_of_interest, 
        webcam_links, administrative_notes, user_email, organization_group, 
        promo_reference_code, age_compliance_status, status, contribution_type
      ) VALUES (
        ${cityName}, ${stateName}, ${countryCode}, ${latitude}, ${longitude}, ${cityPageUrl},
        ${q1}, ${q2}, ${consolidatedContent}, ${q4}, ${q6}, ${adminNotes}, 
        ${userEmail}, ${organization}, ${promoCode}, ${ageStatus}, ${finalStatus}, ${q7 ? 'correction' : 'insight'}
      )
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("❌ SUBMISSION ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}