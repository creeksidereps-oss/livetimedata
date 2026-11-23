// src/lib/email/ingestEmails.ts
//
// Master Email Ingestion & Lifecycle Pipeline for LiveTimeData@gmail.com
//
// Strictly enforces the owner's 4-tier processing order:
// 1. Tier 1: Verification & Opt-In Emails -> Immediately auto-accepted/confirmed via HTTP GET, then archived to 'Newsletters'.
// 2. Tier 2: Yard Sale Aggregators -> Parsed, start time is exact or blank (NO DEFAULTS), passed through publishEvent(),
//            saved to sources as 'yardsale_aggregator' for daily cron, archived to 'sale aggregators'.
// 3. Tier 3: Personal Event & Sale Listings -> Sent straight to publishEvent(origin: 'user_submission'), published live,
//            archived to 'personal event emails' (never held for curation/admin).
// 4. Tier 4: Recognized Newsletters & Civic Bulletins -> Extracted via Gemini (flash-latest with fallback),
//            passed through publishEvent(), direct venue/calendar URLs added to spider lifecycle, archived to 'Newsletters'.
// 5. Unmatched / Non-Event Inbound -> Left untouched in INBOX for human review.

import { ImapFlow } from "imapflow";
// @ts-ignore
import { simpleParser } from "mailparser";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import { sql } from "@vercel/postgres";
import { publishEvent } from "@/lib/events/intake/publishEvent";

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

function parseAddress(raw?: string | null): { street: string; city: string; state: string; zip: string } | null {
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  
  const m = clean.match(/^(?:Tba\s+)?([0-9]+[^,]+|[A-Za-z0-9#\s.]+),\s*([A-Za-z\s.]+),\s*([A-Z]{2})\s*([0-9]{5})?$/i);
  if (m) {
    return {
      street: m[1].trim(),
      city: m[2].trim(),
      state: m[3].trim().toUpperCase(),
      zip: m[4] || ""
    };
  }
  
  const m2 = clean.match(/^([0-9]+\s+[A-Za-z0-9#\s.]+)\s+([A-Za-z\s]+),\s*([A-Z]{2})\s*([0-9]{5})?$/i);
  if (m2) {
    return {
      street: m2[1].trim(),
      city: m2[2].trim(),
      state: m2[3].trim().toUpperCase(),
      zip: m2[4] || ""
    };
  }

  return null;
}

function parseDateAndStartTime(raw?: string | null): { eventDate: string | null; startTime: string | null } {
  if (!raw) return { eventDate: null, startTime: null };
  const clean = raw.replace(/\./g, "").trim();
  
  const m = clean.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+([0-9]{1,2})(?:[,\s]+([0-9]{4}))?/i);
  let yr = new Date().getFullYear().toString();
  let mon = "11";
  let day = "22";
  if (m) {
    mon = MONTHS[m[1].toLowerCase().slice(0, 3)] || "11";
    day = m[2].padStart(2, "0");
    yr = m[3] || yr;
  } else {
    return { eventDate: null, startTime: null };
  }

  // Exact start time only; NO DEFAULTS for sales!
  const tm = clean.match(/([0-9]{1,2}):([0-9]{2})\s*(AM|PM)?/i);
  let startTime: string | null = null;
  let timeStr = "00:00:00";
  if (tm) {
    let hr = parseInt(tm[1], 10);
    const min = tm[2];
    const ampm = (tm[3] || "AM").toUpperCase();
    startTime = `${hr}:${min} ${ampm}`;
    if (ampm === "PM" && hr < 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    timeStr = `${String(hr).padStart(2, "0")}:${min}:00`;
  }

  return {
    eventDate: `${yr}-${mon}-${day} ${timeStr}`,
    startTime
  };
}

async function extractWithGeminiFallback(prompt: string): Promise<{
  events: any[];
  sources: any[];
  entities: any[];
  facts: any[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { events: [], sources: [], entities: [], facts: [] };
  const ai = new GoogleGenAI({ apiKey });
  const models = ["gemini-flash-latest", "gemini-2.5-flash"];

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(res.text?.trim() || "{}");
      return {
        events: Array.isArray(parsed.events) ? parsed.events : [],
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        facts: Array.isArray(parsed.facts) ? parsed.facts : []
      };
    } catch (err: any) {
      console.warn(`[GEMINI_EXTRACT_WARN] Model ${model} failed (${err.message?.slice(0, 80)}). Retrying fallback...`);
    }
  }
  return { events: [], sources: [], entities: [], facts: [] };
}

export interface IngestionRunResult {
  success: boolean;
  totalFound: number;
  verificationsAutoAccepted: number;
  salesPublishedLive: number;
  salesDuplicates: number;
  salesRejected: number;
  personalPublishedLive: number;
  newslettersPublishedLive: number;
  newslettersPendingReview: number;
  newslettersDuplicates: number;
  saleAggregatorsQueued: number;
  spiderSourcesQueued: number;
  entitiesRegistered: number;
  factsRegistered: number;
  emailsArchivedSales: number;
  emailsArchivedNewsletters: number;
  emailsArchivedPersonal: number;
  unmatchedPreservedInInbox: number;
  details: string[];
}

export async function runEmailIngestion(): Promise<IngestionRunResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD in environment.");
  }

  const result: IngestionRunResult = {
    success: true,
    totalFound: 0,
    verificationsAutoAccepted: 0,
    salesPublishedLive: 0,
    salesDuplicates: 0,
    salesRejected: 0,
    personalPublishedLive: 0,
    newslettersPublishedLive: 0,
    newslettersPendingReview: 0,
    newslettersDuplicates: 0,
    saleAggregatorsQueued: 0,
    spiderSourcesQueued: 0,
    entitiesRegistered: 0,
    factsRegistered: 0,
    emailsArchivedSales: 0,
    emailsArchivedNewsletters: 0,
    emailsArchivedPersonal: 0,
    unmatchedPreservedInInbox: 0,
    details: []
  };

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();

  try {
    // 1. Ensure required mailboxes exist
    const mailboxes = await client.list();
    const existingFolders = new Set(mailboxes.map(m => m.path));
    if (!existingFolders.has("sale aggregators")) await client.mailboxCreate("sale aggregators");
    if (!existingFolders.has("Newsletters")) await client.mailboxCreate("Newsletters");
    if (!existingFolders.has("personal event emails")) await client.mailboxCreate("personal event emails");

    // 2. Fetch all messages in INBOX
    const inboxLock = await client.getMailboxLock("INBOX");
    const messages: Array<{ uid: number; subject: string; fromAddr: string; fromName: string; internalDate: Date }> = [];
    try {
      for await (const m of client.fetch("1:*", { envelope: true, internalDate: true, uid: true })) {
        messages.push({
          uid: m.uid,
          subject: (m.envelope?.subject || "").trim(),
          fromAddr: (m.envelope?.from?.[0]?.address || "").toLowerCase(),
          fromName: (m.envelope?.from?.[0]?.name || "").trim(),
          internalDate: m.internalDate ? new Date(m.internalDate) : new Date()
        });
      }
    } finally {
      inboxLock.release();
    }

    result.totalFound = messages.length;
    console.log(`[EMAIL_INGEST] Total messages in INBOX: ${messages.length}`);

    const todayStr = new Date().toISOString().slice(0, 10);

    // 3. Process each message according to owner's strict tier sequence
    for (const item of messages) {
      const sLower = item.subject.toLowerCase();
      const fLower = item.fromAddr.toLowerCase();

      // ----------------------------------------------------------------------
      // TIER 1: VERIFICATION & ACCOUNT CONFIRMATION (AUTO-ACCEPT IMMEDIATELY)
      // ----------------------------------------------------------------------
      const isVerification = (
        sLower.includes("confirm email") ||
        sLower.includes("confirm subscription") ||
        sLower.includes("verify your email") ||
        sLower.includes("not yet confirmed") ||
        (fLower.includes("transactional.estatesales.net") && (sLower.includes("confirm") || sLower.includes("not yet confirmed"))) ||
        (fLower.includes("spothopperapp") && sLower.includes("confirm"))
      );

      if (isVerification) {
        console.log(`[TIER 1 - VERIFY] Auto-accepting UID ${item.uid}: "${item.subject}"...`);
        const readLock = await client.getMailboxLock("INBOX");
        let links: string[] = [];
        try {
          const msg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
          if (msg && msg.source) {
            const parsed = await simpleParser(msg.source);
            const searchStr = (parsed.text || "") + " " + (parsed.html || "");
            const regex = /https?:\/\/[^\s"'<>]+/g;
            let match;
            while ((match = regex.exec(searchStr)) !== null) {
              const url = match[0];
              if (url.includes("confirm") || url.includes("subscribe") || url.includes("token") || url.includes("transactional")) {
                if (!links.includes(url)) links.push(url);
              }
            }
          }
        } finally {
          readLock.release();
        }

        // Trigger GET request to auto-activate the subscription
        for (const link of links) {
          try {
            const res = await fetch(link, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
              redirect: "follow",
              signal: AbortSignal.timeout(8000)
            });
            console.log(`  ✓ Auto-confirmed (${res.status}): ${link.slice(0, 70)}...`);
            result.verificationsAutoAccepted++;
          } catch (err: any) {
            console.warn(`  ! Could not trigger confirm link: ${err.message}`);
          }
        }

        // Archive to 'Newsletters' now that it is confirmed
        const moveLock = await client.getMailboxLock("INBOX");
        try {
          await client.messageMove(item.uid.toString(), "Newsletters", { uid: true });
          result.emailsArchivedNewsletters++;
        } finally {
          moveLock.release();
        }
        continue;
      }

      // ----------------------------------------------------------------------
      // TIER 2: YARD SALE & AUCTION AGGREGATORS -> publishEvent() & sale aggregators
      // ----------------------------------------------------------------------
      const isSalesAggregator = (
        fLower.includes("estatesales.org") ||
        fLower.includes("yardsalesearch.com") ||
        fLower.includes("garagesalefinder.com") ||
        fLower.includes("snaplist.com")
      );

      if (isSalesAggregator) {
        console.log(`[TIER 2 - SALE AGGREGATOR] UID ${item.uid}: "${item.subject.slice(0, 50)}"...`);
        const readLock = await client.getMailboxLock("INBOX");
        let rawHtml = "";
        let rawText = "";
        try {
          const msg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
          if (msg && msg.source) {
            const parsed = await simpleParser(msg.source);
            rawHtml = parsed.html || "";
            rawText = parsed.text || "";
          }
        } finally {
          readLock.release();
        }

        const sourceName = fLower.includes("estatesales") ? "EstateSales.org Alert" :
                           (fLower.includes("yardsalesearch") ? "YardSaleSearch.com" :
                           (fLower.includes("garagesalefinder") ? "GarageSaleFinder.com" : "Snaplist"));

        const salesFound: Array<{ title: string; street: string; city: string; state: string; zip: string; eventDate: string; startTime: string | null; details: string; officialUrl: string }> = [];

        if (rawHtml) {
          const $ = cheerio.load(rawHtml);
          $("script, style").remove();

          // Pattern A: GarageSaleFinder / YardSaleSearch
          $("h3").each((_, el) => {
            const titleLink = $(el).find("a");
            const title = titleLink.text().replace(/\s+/g, " ").trim();
            const link = titleLink.attr("href") || "";
            if (!title || title.length < 3 || title.includes("TIAS.com") || title.includes("Change location")) return;

            const parentTable = $(el).closest("table");
            const cardText = parentTable.length > 0 ? parentTable.text().replace(/\s+/g, " ").trim() : $(el).parent().text().replace(/\s+/g, " ").trim();
            const postTitle = cardText.replace(title, "");

            const addrMatch = postTitle.match(/([0-9]+[^,\n]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*[0-9]{5}|[A-Za-z\s]+,\s*[A-Z]{2}\s*[0-9]{5})/i);
            const dateMatch = postTitle.match(/(?:Starts\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{1,2}(?:\s*(?:to|-)\s*(?:[A-Za-z]+\s+)?[0-9]{1,2})?(?:[,\s]+[0-9]{4})?/i);

            if (addrMatch) {
              const parsedAddr = parseAddress(addrMatch[1]);
              if (parsedAddr && parsedAddr.city && parsedAddr.street && /^\d+\s+/.test(parsedAddr.street)) {
                const { eventDate, startTime } = parseDateAndStartTime(dateMatch ? dateMatch[0] : null);
                if (eventDate) {
                  salesFound.push({
                    title,
                    street: parsedAddr.street,
                    city: parsedAddr.city,
                    state: parsedAddr.state,
                    zip: parsedAddr.zip,
                    eventDate,
                    startTime, // EXACT or null! NO DEFAULTS.
                    details: postTitle.slice(0, 300).trim(),
                    officialUrl: link
                  });
                }
              }
            }
          });

          // Pattern B: EstateSales.org TD card pattern
          $("td").each((_, el) => {
            const text = $(el).text().replace(/\s+/g, " ").trim();
            if ((text.includes("Sale starts") || text.includes("Bidding starts") || text.includes("starts to close")) && text.length > 50 && text.length < 500) {
              const link = $(el).find("a").attr("href") || "";
              const addrMatch = text.match(/([0-9]+\s+[A-Za-z0-9#\s.]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*[0-9]{5}|[0-9]+\s+[A-Za-z0-9#\s.]+\s+[A-Za-z\s]+,\s*[A-Z]{2}\s*[0-9]{5})/i);
              const dateMatch = text.match(/(?:Sale starts|Bidding starts to close|Bidding starts|Starts)\s*([A-Za-z]+[.,]?\s+[A-Za-z]+\s+[0-9]{1,2}(?:\s*at\s*[0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)?)/i);

              let title = text.split(/(?:starts|[0-9]+\s+[A-Za-z0-9#\s.]+,\s*[A-Za-z\s]+,\s*[A-Z]{2})/i)[0].trim();
              if (title.length > 80) title = title.slice(0, 80).trim();

              if (addrMatch) {
                const parsedAddr = parseAddress(addrMatch[1]);
                if (parsedAddr && parsedAddr.city && parsedAddr.street && /^\d+\s+/.test(parsedAddr.street)) {
                  const { eventDate, startTime } = parseDateAndStartTime(dateMatch ? dateMatch[1] : null);
                  if (eventDate) {
                    salesFound.push({
                      title: title || `Estate Sale in ${parsedAddr.city}`,
                      street: parsedAddr.street,
                      city: parsedAddr.city,
                      state: parsedAddr.state,
                      zip: parsedAddr.zip,
                      eventDate,
                      startTime, // EXACT or null! NO DEFAULTS.
                      details: text.slice(0, 300).trim(),
                      officialUrl: link
                    });
                  }
                }
              }
            }
          });
        }

        // Ingest each sale via publishEvent()
        for (const s of salesFound) {
          const fullAddress = `${s.street}, ${s.city}, ${s.state}${s.zip ? ` ${s.zip}` : ""}`;
          const outcome = await publishEvent({
            origin: "yardsale",
            kind: "sale",
            title: s.title,
            venue: s.street,
            venueAddress: fullAddress,
            startTime: s.startTime || null, // null if unstated!
            eventDate: s.eventDate,
            details: s.details,
            officialInfoUrl: s.officialUrl || null,
            source: sourceName,
            sourceUrl: s.officialUrl || "https://www.estatesales.org",
            location: {
              city: s.city,
              region: s.state,
              country: "US",
              address: fullAddress
            }
          });

          if (outcome.outcome === "published") {
            result.salesPublishedLive++;
            console.log(`    + [Live Sale ${outcome.id}] ${s.title} (${s.city}, ${s.state})`);
          } else if (outcome.outcome === "duplicate") {
            result.salesDuplicates++;
          } else {
            result.salesRejected++;
          }

          // Register in sources as yardsale_aggregator (owner policy)
          if (s.officialUrl && s.officialUrl.startsWith("http")) {
            try {
              await sql`
                INSERT INTO sources (
                  name, url, city_name, state_name, source_type, status, phase, next_scrape_due, scrape_interval_days, created_at, updated_at
                ) VALUES (
                  ${sourceName}, ${s.officialUrl}, ${s.city}, ${s.state}, 'yardsale_aggregator', 'active', 'discovery', NOW(), 1, NOW(), NOW()
                )
                ON CONFLICT (url) DO UPDATE SET
                  status = 'active',
                  next_scrape_due = LEAST(sources.next_scrape_due, NOW()),
                  updated_at = NOW();
              `;
              result.saleAggregatorsQueued++;
            } catch {}
          }
        }

        // Archive to 'sale aggregators'
        const moveLock = await client.getMailboxLock("INBOX");
        try {
          await client.messageMove(item.uid.toString(), "sale aggregators", { uid: true });
          result.emailsArchivedSales++;
        } finally {
          moveLock.release();
        }
        continue;
      }

      // ----------------------------------------------------------------------
      // TIER 3: PERSONAL EVENT & SALE LISTINGS (FROM INDIVIDUALS & COMPANIES)
      // ----------------------------------------------------------------------
      // Detect single-event or personal sale submissions from non-media domains
      const isPersonalSubmission = (
        !fLower.includes(".ccsend.com") &&
        !fLower.includes("mail.") &&
        !fLower.includes("newsletter") &&
        !fLower.includes("editor.") &&
        (sLower.includes("yard sale") || sLower.includes("garage sale") || sLower.includes("estate sale") ||
         sLower.includes("event") || sLower.includes("concert") || sLower.includes("workshop") || sLower.includes("festival"))
      );

      if (isPersonalSubmission) {
        console.log(`[TIER 3 - PERSONAL EVENT] Processing UID ${item.uid}: "${item.subject}"...`);
        const readLock = await client.getMailboxLock("INBOX");
        let bodyText = "";
        try {
          const msg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
          if (msg && msg.source) {
            const parsed = await simpleParser(msg.source);
            bodyText = parsed.text || parsed.html?.replace(/<[^>]+>/g, " ") || "";
          }
        } finally {
          readLock.release();
        }

        if (bodyText.length >= 40) {
          const prompt = `Extract event/sale details from this personal submission email.
Subject: ${item.subject}
From: ${item.fromName} <${item.fromAddr}>
Body:
${bodyText.slice(0, 10000)}

Respond in valid JSON:
{
  "events": [
    {
      "title": "", "city_name": "", "state_name": "", "country_code": "US", "venue": "", "venue_address": "",
      "start_time": "", "event_date": "YYYY-MM-DD HH:mm:ss", "details": "", "category": "Yard & Estate Sales | Community | Music & Concerts",
      "kind": "sale or event"
    }
  ]
}`;
          const extracted = await extractWithGeminiFallback(prompt);
          for (const ev of extracted.events) {
            if (!ev.title || !ev.city_name) continue;
            const outcome = await publishEvent({
              origin: "user_submission", // Human origin -> publishes straight to live without admin curation!
              kind: ev.kind === "sale" ? "sale" : "event",
              title: ev.title,
              venue: ev.venue || ev.city_name,
              venueAddress: ev.venue_address || `${ev.venue || ev.city_name}, ${ev.city_name}, ${ev.state_name || ""}`,
              startTime: ev.start_time || null,
              eventDate: ev.event_date || `${todayStr} 10:00:00`,
              details: ev.details || null,
              userEmail: item.fromAddr,
              userName: item.fromName || null,
              source: `Direct Email from ${item.fromAddr}`,
              location: {
                city: ev.city_name,
                region: ev.state_name,
                country: ev.country_code || "US",
                address: ev.venue_address || undefined
              }
            });

            if (outcome.outcome === "published") {
              result.personalPublishedLive++;
              console.log(`    + [Live Personal Event ${outcome.id}] ${ev.title} (${ev.city_name})`);
            }
          }
        }

        // Archive to 'personal event emails'
        const moveLock = await client.getMailboxLock("INBOX");
        try {
          await client.messageMove(item.uid.toString(), "personal event emails", { uid: true });
          result.emailsArchivedPersonal++;
        } finally {
          moveLock.release();
        }
        continue;
      }

      // ----------------------------------------------------------------------
      // TIER 4: RECOGNIZED RECURRING NEWSLETTERS & CIVIC BULLETINS
      // ----------------------------------------------------------------------
      const isKnownNewsletter = (
        fLower.includes("hickoryrecord.com") ||
        fLower.includes("postandcourier.com") ||
        fLower.includes("jointheflyover.com") ||
        fLower.includes("flyovernorthcarolina.com") ||
        fLower.includes("feedblitz.com") ||
        fLower.includes("mytheatreland.com") ||
        fLower.includes("frostbankcenter.com") ||
        fLower.includes("govdelivery.com") ||
        fLower.includes("mshpa.org") ||
        fLower.includes("greaterstatesvillechamber") ||
        fLower.includes("lknscoop.com") ||
        fLower.includes("richmondregiontourism") ||
        fLower.includes("johnstoncountync.org") ||
        fLower.includes("wixemails.com") ||
        fLower.includes("tate.org.uk") ||
        fLower.includes("biermanautism.com") ||
        fLower.includes("basspro.com")
      );

      if (isKnownNewsletter) {
        console.log(`[TIER 4 - NEWSLETTER] Processing UID ${item.uid}: "${item.subject.slice(0, 50)}"...`);
        const readLock = await client.getMailboxLock("INBOX");
        let emailText = "";
        try {
          const msg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
          if (msg && msg.source) {
            const parsed = await simpleParser(msg.source);
            emailText = parsed.text || parsed.html?.replace(/<[^>]+>/g, " ") || "";
          }
        } finally {
          readLock.release();
        }

        if (emailText.length >= 80) {
          const prompt = `Extract physical upcoming events and calendar sources from this newsletter. Reference date is ${todayStr}.
Rules:
1. ONLY current/future physical in-person events (${todayStr} or later). No webinars.
2. Verified start times or "All Day". If unconfirmed, specify "TBD".
3. Direct venue/festival calendar URLs for spider lifecycle.

Subject: ${item.subject}
Content:
${emailText.slice(0, 32000)}

Respond in valid JSON:
{
  "events": [
    {
      "title": "", "city_name": "", "state_name": "", "country_code": "US",
      "category": "Community | Music & Concerts | Festivals & Fairs | Theatre & Performing Arts | Sports & Recreation",
      "venue": "", "venue_address": "", "start_time": "", "event_date": "YYYY-MM-DD HH:mm:ss", "details": "", "official_info_url": ""
    }
  ],
  "sources": [{"name": "", "url": "", "city": "", "state": ""}],
  "entities": [{"name": "", "entity_type": "venue | business | organization", "city_name": "", "state_name": "", "website_url": ""}],
  "facts": [{"city_name": "", "state_name": "", "title": "", "description": "", "category": "history"}]
}`;

          const extracted = await extractWithGeminiFallback(prompt);

          // 1. Submit Events via publishEvent()
          for (const ev of extracted.events) {
            if (!ev.title || !ev.city_name) continue;
            const outcome = await publishEvent({
              origin: "crawler",
              kind: "event",
              title: ev.title,
              venue: ev.venue || ev.city_name,
              venueAddress: ev.venue_address || `${ev.venue || ev.city_name}, ${ev.city_name}, ${ev.state_name || ""}`,
              startTime: ev.start_time || null,
              eventDate: ev.event_date || `${todayStr} 10:00:00`,
              details: ev.details || null,
              category: ev.category || "Community",
              officialInfoUrl: ev.official_info_url || null,
              source: item.subject,
              sourceUrl: ev.official_info_url || "https://www.livetimedata.com",
              location: {
                city: ev.city_name,
                region: ev.state_name,
                country: ev.country_code || "US",
                address: ev.venue_address || undefined
              }
            });

            if (outcome.outcome === "published") {
              result.newslettersPublishedLive++;
              console.log(`    + [Live Event ${outcome.id}] ${ev.title} (${ev.city_name})`);
            } else if (outcome.outcome === "pending_review") {
              result.newslettersPendingReview++;
            } else if (outcome.outcome === "duplicate") {
              result.newslettersDuplicates++;
            }
          }

          // 2. Queue Root Calendar URLs into Spider Lifecycle (filtering out ticket aggregators)
          for (const src of extracted.sources) {
            if (!src.url || !src.url.startsWith("http")) continue;
            if (/bandsintown\.com|seated\.com|eventbrite\.com|ticketmaster\.com/i.test(src.url)) continue;

            try {
              await sql`
                INSERT INTO sources (
                  name, url, city_name, state_name, source_type, status, phase, next_scrape_due, scrape_interval_days, created_at, updated_at
                ) VALUES (
                  ${src.name || "Discovered Calendar"}, ${src.url}, ${src.city || null}, ${src.state || null}, 'html_calendar', 'active', 'discovery', NOW(), 30, NOW(), NOW()
                )
                ON CONFLICT (url) DO UPDATE SET
                  status = 'active',
                  next_scrape_due = LEAST(sources.next_scrape_due, NOW()),
                  updated_at = NOW();
              `;
              result.spiderSourcesQueued++;
            } catch {}
          }

          // 3. Register Entities
          for (const ent of extracted.entities) {
            if (!ent.name || !ent.city_name) continue;
            try {
              const norm = ent.name.toLowerCase().replace(/[^a-z0-9]/g, "");
              const check = await sql`
                SELECT id FROM entities 
                WHERE (normalized_name = ${norm} OR LOWER(name) = LOWER(${ent.name}))
                  AND LOWER(city_name) = LOWER(${ent.city_name})
                LIMIT 1;
              `;
              if (check.rows.length === 0) {
                await sql`
                  INSERT INTO entities (
                    name, normalized_name, entity_type, subtype, city_name, state_name,
                    country_code, website_url, verification_status
                  ) VALUES (
                    ${ent.name}, ${norm}, ${ent.entity_type || "venue"}, 'general',
                    ${ent.city_name}, ${ent.state_name || ""}, 'US',
                    ${ent.website_url || null}, 'verified'
                  );
                `;
                result.entitiesRegistered++;
              }
            } catch {}
          }

          // 4. Insert Fun Facts
          for (const f of extracted.facts) {
            if (!f.title || !f.city_name) continue;
            try {
              const check = await sql`
                SELECT id FROM city_fun_facts 
                WHERE LOWER(city_name) = LOWER(${f.city_name}) 
                  AND LOWER(title) = LOWER(${f.title})
                LIMIT 1;
              `;
              if (check.rows.length === 0) {
                await sql`
                  INSERT INTO city_fun_facts (
                    city_name, state_name, country_name, title, description, category, scope,
                    source_attribution, contributed_by, is_approved, status
                  ) VALUES (
                    ${f.city_name}, ${f.state_name || ""}, 'United States',
                    ${f.title}, ${f.description}, ${f.category || "history"}, 'city',
                    ${item.subject}, 'LiveTimeData Newsletter Miner', true, 'approved'
                  );
                `;
                result.factsRegistered++;
              }
            } catch {}
          }
        }

        // Archive to 'Newsletters'
        const moveLock = await client.getMailboxLock("INBOX");
        try {
          await client.messageMove(item.uid.toString(), "Newsletters", { uid: true });
          result.emailsArchivedNewsletters++;
        } finally {
          moveLock.release();
        }
        continue;
      }

      // ----------------------------------------------------------------------
      // TIER 5: UNMATCHED / NEW DIRECT INBOUND -> PRESERVE UNTOUCHED IN INBOX
      // ----------------------------------------------------------------------
      console.log(`[SAFE ZONE - INBOX] Preserving unmatched UID ${item.uid}: ${item.fromName} <${item.fromAddr}> | "${item.subject}"`);
      result.unmatchedPreservedInInbox++;
    }

  } finally {
    await client.logout();
  }

  return result;
}
