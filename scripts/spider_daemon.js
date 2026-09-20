// scripts/spider_daemon.js
/**
 * Autonomous Ever-Going Spider Daemon
 *
 * Runs a continuous, self-perpetuating lifecycle loop:
 * 1. Polls database for sources WHERE status = 'active' AND next_scrape_due <= NOW()
 * 2. Crawls each source using the universal event crawler (JSON-LD, HTML Tables, Accordions, Cards)
 * 3. Ingests events, venues, performers, and contact emails into the knowledge graph
 * 4. Birthed child sources (promoters, external calendars, sub-events) are queued at NOW() for immediate processing
 * 5. Parent sources have their nextScrapeDue rescheduled according to their scrapeIntervalDays
 * 6. If the queue momentarily empties, sleeps for 30 seconds and checks again — spiders NEVER die.
 *
 * Usage:
 *   node scripts/spider_daemon.js                 (Continuous daemon mode)
 *   node scripts/spider_daemon.js --single-run    (Runs one batch and exits)
 *   node scripts/spider_daemon.js --limit=5       (Custom batch size)
 */

const fs = require('fs');
const path = require('path');

// 1. Load environment variables
const envFile = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      }
    }
  });
}

const { sql } = require('@vercel/postgres');
const cheerio = require('cheerio');
const { GoogleGenAI } = require('@google/genai');

/**
 * Autonomous Web Search: Resolve official calendar URL for entity using Google Search grounding
 */
async function resolveEntityWebsiteAndCalendar(name, entityType, city, state) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const locationStr = [city, state].filter(Boolean).join(', ');
    const prompt = `
      Search Google to find the official website and official tour/events calendar page for this ${entityType}:
      Name: ${name}
      ${locationStr ? `Location: ${locationStr}` : ''}

      Return ONLY a JSON object:
      {
        "officialWebsite": "https://...",
        "calendarUrl": "https://..."
      }
      Do not use markdown formatting or backticks.
    `;

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    if (!res.text) return null;
    const clean = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(clean);
    return {
      officialWebsite: data.officialWebsite?.startsWith('http') ? data.officialWebsite : undefined,
      calendarUrl: data.calendarUrl?.startsWith('http') ? data.calendarUrl : undefined,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Pre-Check Deduplication Guard: Check if entity already exists in our system before wasting crawl resources
 */
async function checkEntityInSystem(name) {
  const normName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  // 1. Check sources by name
  const existingSource = await sql`
    SELECT id, name, url, last_scraped_at, next_scrape_due, scrape_interval_days
    FROM sources
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(${name}))
    LIMIT 1;
  `;
  if (existingSource.rowCount > 0) {
    const s = existingSource.rows[0];
    return {
      exists: true,
      hasActiveSource: true,
      url: s.url,
      reason: 'Already queued or present in sources'
    };
  }

  // 2. Check entities table
  const existingEntity = await sql`
    SELECT id, name, city_name, state_name, website_url
    FROM entities
    WHERE normalized_name = ${normName} OR LOWER(TRIM(name)) = LOWER(TRIM(${name}))
    LIMIT 1;
  `;
  if (existingEntity.rowCount > 0) {
    const e = existingEntity.rows[0];
    if (e.website_url) {
      return {
        exists: true,
        hasActiveSource: false,
        hasWebsite: true,
        url: e.website_url,
        reason: 'Entity exists with calendar website'
      };
    }
    return {
      exists: true,
      hasActiveSource: false,
      hasWebsite: false,
      reason: 'Entity exists in graph but lacks website'
    };
  }

  return { exists: false };
}

const args = process.argv.slice(2);
const isSingleRun = args.includes('--single-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const BATCH_SIZE = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;
const sourceIdArg = args.find(a => a.startsWith('--sourceId='));
const TARGET_SOURCE_ID = sourceIdArg ? parseInt(sourceIdArg.split('=')[1], 10) : null;
const SLEEP_MS = 30000; // 30 seconds

let isRunning = true;
process.on('SIGINT', () => {
  console.log('\n[SPIDER_DAEMON] Graceful shutdown requested (SIGINT)...');
  isRunning = false;
});
process.on('SIGTERM', () => {
  console.log('\n[SPIDER_DAEMON] Graceful shutdown requested (SIGTERM)...');
  isRunning = false;
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidEmail(email) {
  if (!email || email.length < 6 || email.length > 100) return false;
  const clean = email.toLowerCase().trim();
  const junk = ['sentry', 'wixpress', 'example', 'domain', 'support@github', 'noreply', '.png', '.jpg', '.js'];
  return !junk.some(j => clean.includes(j)) && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean);
}

function categorizeEvent(title, desc = '') {
  const text = `${title} ${desc}`.toLowerCase();
  if (/\b(auction|estate auction|consignment auction|yard sale|garage sale|estate sale|rummage sale|tag sale)\b/i.test(text)) return 'Yard / Garage Sales';
  if (/\b(food truck|food trucks|food truck rally|brewery food|mobile eats)\b/i.test(text)) return 'Food Trucks';
  if (/\b(music|concert|band|live music|acoustic|orchestra|choir|singer|jazz|blues|rock|country music|symphony)\b/i.test(text)) return 'Concerts & Live Music';
  if (/\b(festival|fest|carnival|parade|fair|fall fest|octoberfest|oktoberfest|spring fest)\b/i.test(text)) return 'Festivals & Fairs';
  if (/\b(class|workshop|pottery|painting|cooking class|seminar|lesson|learn to|fitness class|yoga)\b/i.test(text)) return 'Classes';
  if (/\b(theater|theatre|comedy|stand-up|musical|play|improv|ballet|dance performance|opera|drama)\b/i.test(text)) return 'Theatre & Performing Arts';
  if (/\b(art|gallery|exhibition|craft fair|art crawl|museum|sculpture|pottery show)\b/i.test(text)) return 'Arts & Culture';
  if (/\b(market|farmers market|flea market|pop-up market|artisan market|vendor market)\b/i.test(text)) return 'Farmers Markets';
  if (/\b(trivia|bingo|karaoke|board games|game night)\b/i.test(text)) return 'Trivia & Games';
  if (/\b(5k|10k|marathon|run|race|walk|cycling|bike ride|triathlon|fun run)\b/i.test(text)) return 'Races & Active';
  if (/\b(beer|brewery|cider|wine|winery|tasting|beer release|pint night)\b/i.test(text)) return 'Drink & Nightlife';
  if (/\b(kids|family|storytime|children|puppet|magic show|family friendly)\b/i.test(text)) return 'Family & Kids';
  return 'Community & Social';
}

function parseHumanDateString(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace(/\s+/g, ' ').trim();

  // Range: "September 2 - 20, 2026"
  const rangeMatch = clean.match(/^([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})$/);
  if (rangeMatch) {
    const [_, monthStr, startDay, endDay, year] = rangeMatch;
    const d = new Date(`${monthStr} ${startDay}, ${year} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Single date with year: "Sep 24, 2026" or "October 2, 2026"
  const singleMatch = clean.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (singleMatch) {
    const d = new Date(`${singleMatch[1]} ${singleMatch[2]}, ${singleMatch[3]} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Single date without year: "Sep 24", "September 24", "Sep 24th"
  const monthDayMatch = clean.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (monthDayMatch) {
    const currentYear = new Date().getFullYear();
    const d = new Date(`${monthDayMatch[1]} ${monthDayMatch[2]}, ${currentYear} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

/**
 * Universal HTML and table event crawler
 */
async function crawlUrl(url, defaultCity = 'Statesville', defaultState = 'NC') {
  const events = [];
  const childUrls = new Set();
  const emails = new Set();

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    const html = await res.text();
    if (!html || typeof html !== 'string') return { events, childUrls: [], emails: [] };

    const $ = cheerio.load(html);

    // 1. Scan mailto links and text emails
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const clean = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
        if (isValidEmail(clean)) emails.add(clean);
      }
    });

    const bodyText = $('body').text();
    const emailMatches = bodyText.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) || [];
    for (const em of emailMatches) {
      if (isValidEmail(em)) emails.add(em.toLowerCase().trim());
    }

    // 2. Scan Schema.org JSON-LD scripts
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html();
        if (!content) return;
        const data = JSON.parse(content);

        function parseJsonLd(obj) {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) return obj.forEach(parseJsonLd);
          if (obj['@graph']) return obj['@graph'].forEach(parseJsonLd);
          if (obj.itemListElement) return obj.itemListElement.forEach(it => parseJsonLd(it.item || it));

          const type = obj['@type'];
          const isEvent = Array.isArray(type) ? type.some(t => /Event$/i.test(t)) : (typeof type === 'string' && /Event$/i.test(type));

          if (isEvent && obj.name && (obj.startDate || obj.doorTime)) {
            const startDateStr = obj.startDate || obj.doorTime;
            const eventDate = new Date(startDateStr);
            if (!isNaN(eventDate.getTime()) && eventDate >= new Date(Date.now() - 24 * 60 * 60 * 1000)) {
              let venueName = defaultCity;
              if (obj.location) {
                venueName = obj.location.name || (obj.location.address ? (obj.location.address.streetAddress || defaultCity) : defaultCity);
              }
              const title = String(obj.name).trim();
              const desc = String(obj.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

              events.push({
                title,
                venue: venueName,
                cityName: obj.location?.address?.addressLocality || defaultCity,
                stateName: obj.location?.address?.addressRegion || defaultState,
                category: categorizeEvent(title, desc),
                startTime: '7:00 PM',
                eventDate,
                details: desc || `${title} at ${venueName}.`,
                officialInfoUrl: obj.url || url,
                eventFlyerUrl: typeof obj.image === 'string' ? obj.image : (obj.image?.url || null),
                organizerName: obj.organizer?.name || undefined,
                organizerUrl: obj.organizer?.url || undefined,
              });

              if (obj.organizer?.url && obj.organizer.url.startsWith('http')) {
                childUrls.add(obj.organizer.url);
              }
            }
          }
        }
        parseJsonLd(data);
      } catch {}
    });

    // 2a. AEG / Bowery / AXS venues JSON feed detection (data-file attribute)
    if (events.length === 0) {
      const dataFileMatch = html.match(/data-file=["'](https?:\/\/[^"']+\.json[^"']*)["']/i);
      if (dataFileMatch) {
        const jsonUrl = dataFileMatch[1];
        try {
          const jsonRes = await fetch(jsonUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(10000),
          });
          if (jsonRes.ok) {
            const jsonData = await jsonRes.json();
            const rawEvents = jsonData.events || (Array.isArray(jsonData) ? jsonData : []);
            for (const ev of rawEvents) {
              if (!ev.eventDateTime) continue;
              const eventDate = new Date(ev.eventDateTime);
              if (isNaN(eventDate.getTime()) || eventDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) continue;

              const title = (ev.title?.eventTitleText || ev.title?.headlinersText || (typeof ev.title === 'string' ? ev.title : 'Concert')).replace(/<[^>]+>/g, '').trim();
              const venueName = ev.venue?.title || defaultCity;
              const cityName = ev.venue?.city || defaultCity;
              const stateName = ev.venue?.state || defaultState;
              const ticketUrl = ev.ticketing?.ticketURL || ev.ticketing?.url || ev.ticketing?.eventUrl || url;
              const flyerUrl = ev.media?.['17']?.file_name || ev.media?.['86']?.file_name || (ev.media ? Object.values(ev.media)[0]?.file_name : null);
              const desc = (ev.bio || ev.description || `${title} live in concert at ${venueName}.`).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

              events.push({
                title,
                venue: venueName,
                cityName,
                stateName,
                category: categorizeEvent(title, desc),
                startTime: ev.eventDateTime ? new Date(ev.eventDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '7:00 PM',
                eventDate,
                details: desc,
                officialInfoUrl: ticketUrl,
                eventFlyerUrl: flyerUrl,
                source: url,
              });
            }
          }
        } catch (err) {
          console.error(`[AEG_FEED_ERROR] Error fetching ${jsonUrl}:`, err.message);
        }
      }
    }

    // 2b. DOM Event Cards & RHP Event Wrappers
    if (events.length === 0) {
      const cardSelectors = [
        '.rhpSingleEvent',
        '.eventWrapper',
        '.rhp-event__single-event--list',
        '.eventItem',
        '.event-item',
        '.event_item',
        '.event-card',
        '.eventCard',
        '.events-card',
        'article.event',
        '.show-item',
        '.c-card--event',
        '.eventlist-event',
        'article.hentry',
      ];

      for (const sel of cardSelectors) {
        const cards = $(sel);
        if (cards.length > 0) {
          cards.each((_, el) => {
            let title = $(el)
              .find('.rhp-event__title--list, h2 a, h3 a, h4 a, .title a, .event-title a, h2, h3, h4, .title, .event-title')
              .first()
              .text()
              .trim();
            title = title.split('\t')[0].trim().replace(/\s+/g, ' ');

            const dateText = $(el)
              .find('.eventDateListTop, .rhp-event__date--list, .date, .event-date, time, [class*="date"]')
              .first()
              .text()
              .trim();
            if (!title || !dateText || title.length < 3 || title.length > 200) return;

            const parsedDate = parseHumanDateString(dateText);
            if (!parsedDate || isNaN(parsedDate.getTime())) return;

            const tagline = $(el)
              .find('.tagline, .sub-title, .event-sub-title, .desc, p')
              .first()
              .text()
              .trim();

            let detailUrl =
              $(el)
                .find('a[href*="/event"], a[href*="/show"], a[href*="/detail"], .title a, h3 a, a')
                .first()
                .attr('href') || url;
            try {
              detailUrl = new URL(detailUrl, url).href;
            } catch {}

            let flyerUrl = $(el).find('img').first().attr('src');
            try {
              if (flyerUrl) flyerUrl = new URL(flyerUrl, url).href;
            } catch {}

            const category = categorizeEvent(title, tagline);
            let venueName = $(el).find('.rhp-event__venue--list, .rhp-event-info, .venue, .location').first().text().trim();
            if (venueName.includes('Richmond Music Hall')) venueName = 'Richmond Music Hall';
            else if (venueName.includes('The Broadberry')) venueName = 'The Broadberry';
            else if (!venueName) venueName = $('h1').first().text().trim() || defaultCity;

            events.push({
              title,
              cityName: defaultCity,
              stateName: defaultState,
              venue: venueName,
              category,
              startTime: '7:30 PM',
              eventDate: parsedDate,
              details: tagline ? `${title} - ${tagline}. Live at ${venueName}.` : `${title} live at ${venueName}.`,
              officialInfoUrl: detailUrl,
              eventFlyerUrl: flyerUrl,
              source: url,
            });
          });

          if (events.length > 0) break;
        }
      }
    }

    // 3. HTML Tables and Monthly Accordions
    if ($('table').length > 0) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const now = new Date();
      const currentYear = now.getFullYear();
      const baseVenue = $('h1').first().text().trim() || $('title').first().text().split(/[-|]/)[0].trim() || defaultCity;

      $('table').each((i, tbl) => {
        let monthName = null;
        const prevHeader = $(tbl)
          .closest('.ui-accordion-content, .views-field, .accordion-item, div')
          .prevAll('h1, h2, h3, h4, button, .accordion-header')
          .first()
          .text()
          .trim();

        for (const m of months) {
          if (prevHeader.toLowerCase().includes(m.toLowerCase())) {
            monthName = m;
            break;
          }
        }
        if (!monthName && i < 12) monthName = months[i];
        if (!monthName) return;

        const monthIndex = months.indexOf(monthName);

        $(tbl).find('tbody tr, tr').each((_, tr) => {
          const tds = $(tr).find('td');
          if (tds.length < 2) return;

          const dateStr = $(tds[0]).text().replace(/\s+/g, ' ').trim();
          const eventCell = $(tds[1]);
          const buildingStr = tds.length >= 3 ? $(tds[2]).text().replace(/\s+/g, ' ').trim() : '';
          const contactStr = tds.length >= 4 ? $(tds[3]).text().replace(/\s+/g, ' ').trim() : '';

          if (/date/i.test(dateStr) && /event/i.test(eventCell.text())) return;

          const cellClone = eventCell.clone();
          cellClone.find('br').replaceWith('\n');
          cellClone.find('p, div').append('\n');

          let title = eventCell.find('strong, b, h4, h3, a').first().text().replace(/\s+/g, ' ').trim();
          if (!title) {
            title = cellClone.text().split('\n')[0].replace(/\s+/g, ' ').trim();
          }
          if (title.length > 70 && title.includes('.')) {
            title = title.split(/\. |\n/)[0].trim();
          }
          if (!title || title.length < 3) return;

          let detailUrl = eventCell.find('a[href^="http"]').first().attr('href') ||
                          eventCell.find('a[href]').first().attr('href') || url;
          try {
            detailUrl = new URL(detailUrl, url).href;
          } catch {}

          let organizerUrl = undefined;
          let organizerName = undefined;

          const externalLink = $(tr).find('a[href^="http"]').filter((_, a) => {
            const h = $(a).attr('href') || '';
            return !h.includes('facebook.com') && !h.includes('instagram.com') && !h.includes('twitter.com');
          }).first();

          if (externalLink.length > 0) {
            organizerUrl = externalLink.attr('href');
            const linkText = externalLink.text().trim();
            organizerName = linkText.length > 2 ? linkText : title;
            if (organizerUrl) childUrls.add(organizerUrl);
          } else if (contactStr && contactStr.length > 3) {
            const cleaned = contactStr.split(/[:\d(]/)[0].trim();
            if (cleaned.length > 2 && !cleaned.toLowerCase().includes('information')) {
              organizerName = cleaned;
            }
          }

          let eventDate = null;
          const dayMatch = dateStr.match(/^(\d{1,2})/);
          if (dayMatch) {
            const dayNum = parseInt(dayMatch[1], 10);
            let targetYear = currentYear;
            if (monthIndex < now.getMonth() - 1) targetYear += 1;
            eventDate = new Date(Date.UTC(targetYear, monthIndex, dayNum, 14, 0, 0));
          } else if (dateStr.toLowerCase().includes('every saturday') || dateStr.toLowerCase().includes('weekend')) {
            let targetYear = currentYear;
            if (monthIndex < now.getMonth() - 1) targetYear += 1;
            eventDate = new Date(Date.UTC(targetYear, monthIndex, 15, 14, 0, 0));
          }

          if (eventDate && eventDate >= new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            const fullDesc = eventCell.text().replace(/\s+/g, ' ').trim();
            const venueName = buildingStr ? `${baseVenue} (${buildingStr})` : baseVenue;

            events.push({
              title,
              cityName: defaultCity,
              stateName: defaultState,
              venue: venueName,
              category: categorizeEvent(title, fullDesc),
              startTime: '9:00 AM',
              eventDate,
              details: fullDesc || `${title} at ${venueName}.`,
              officialInfoUrl: detailUrl,
              organizerName,
              organizerUrl,
            });
          }
        });
      });
    }

    // 3b. Bandsintown & Artist Tour Widgets
    const bitWidget = $('.bit-widget-initializer, [data-artist-name], a[href*="bandsintown.com"]');
    const bitScript = $('script[src*="bandsintown.com"]');
    if (
      events.length === 0 &&
      (bitWidget.length > 0 || bitScript.length > 0 || html.includes('widget.bandsintown.com'))
    ) {
      try {
        let artistName = bitWidget.attr('data-artist-name');
        if (!artistName) {
          artistName =
            $('h1').first().text().trim() ||
            $('title').first().text().split(/[-|]/)[0].replace(/official\s+(?:site|website)\s+of/i, '').trim();
        }

        if (artistName) {
          const parsedUrl = new URL(url);
          const hostname = parsedUrl.hostname;
          const origin = parsedUrl.origin;
          const bitApiUrl = `https://rest.bandsintown.com/V3.1/artists/${encodeURIComponent(artistName)}/events?app_id=js_${hostname}&date=upcoming`;

          const bitRes = await fetch(bitApiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Referer: url,
              Origin: origin,
            },
            signal: AbortSignal.timeout(8000),
          });

          if (bitRes.ok) {
            const tourEvents = await bitRes.json();
            if (Array.isArray(tourEvents)) {
              for (const ev of tourEvents) {
                if (!ev.datetime || !ev.venue) continue;
                const eventDate = new Date(ev.datetime);
                if (isNaN(eventDate.getTime())) continue;

                const city = ev.venue.city || defaultCity;
                const state = ev.venue.region || defaultState;
                const venueName = ev.venue.name || `${artistName} Live`;
                const title = ev.title || `${artistName} at ${venueName}`;
                const detailUrl = ev.offers?.[0]?.url || ev.url || url;
                const desc =
                  ev.description ||
                  `${artistName} live in concert at ${venueName} in ${city}, ${state}.`;

                events.push({
                  title,
                  cityName: city,
                  stateName: state,
                  venue: venueName,
                  category: 'Concerts & Live Music',
                  startTime:
                    eventDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    }) || '7:00 PM',
                  eventDate,
                  details: desc,
                  officialInfoUrl: detailUrl,
                  eventFlyerUrl: ev.artist?.image_url || null,
                  performerName: artistName,
                  performerUrl: url,
                });
              }
            }
          }
        }
      } catch (bitErr) {
        console.error(`[BANDSINTOWN_CRAWL_ERROR] ${bitErr.message}`);
      }
    }

    // 4. Discover sub-links for deeper recursive calendar exploration
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (
        href &&
        (href.includes('/event/') ||
          href.includes('/events/') ||
          href.includes('/calendar/') ||
          href.includes('/shows/') ||
          href.includes('/happenings/'))
      ) {
        try {
          const parsed = new URL(href, url);
          const isSingle =
            (parsed.hostname.includes('facebook.com') && /\/events\/\d+/.test(parsed.pathname)) ||
            (parsed.hostname.includes('eventbrite.com') && parsed.pathname.startsWith('/e/')) ||
            (parsed.hostname.includes('ticketmaster.com') && parsed.pathname.includes('/event/'));

          if (!isSingle && parsed.protocol.startsWith('http') && parsed.href !== url) {
            childUrls.add(parsed.href);
          }
        } catch {}
      }
    });

  } catch (err) {
    console.error(`[SPIDER_CRAWL_ERR] Error crawling ${url}: ${err.message}`);
  }

  return {
    events,
    childUrls: Array.from(childUrls).slice(0, 15),
    emails: Array.from(emails).slice(0, 15),
  };
}

/**
 * Ingests events and connects child entities
 */
async function ingestCrawlResults(source, crawl) {
  let eventsInserted = 0;
  let childrenQueued = 0;
  let emailsInserted = 0;

  // 1. Ingest events
  for (const ev of crawl.events) {
    try {
      const dateIso = ev.eventDate.toISOString().slice(0, 10);
      const res = await sql`
        INSERT INTO events (
          title, city_name, state_name, venue, category,
          start_time, event_date, details, official_info_url,
          event_flyer_url, source, status, created_at, updated_at
        ) VALUES (
          ${ev.title}, ${ev.cityName}, ${ev.stateName || 'NC'}, ${ev.venue}, ${ev.category},
          ${ev.startTime || '7:00 PM'}, ${dateIso}, ${ev.details}, ${ev.officialInfoUrl || null},
          ${ev.eventFlyerUrl || null}, ${source.url}, 'published', NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
        RETURNING id;
      `;
      if (res.rowCount > 0) eventsInserted++;

      // Guard: If venue is a legitimate commercial entity (not a street address), ensure it exists in entities
      const isStreetAddr = /^\d+\s+[A-Za-z]/.test(ev.venue) || /^#\d+/.test(ev.venue);
      if (!isStreetAddr && ev.venue && ev.venue.length > 2) {
        const norm = ev.venue.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        await sql`
          INSERT INTO entities (
            name, normalized_name, entity_type, city_name, state_name,
            verification_status, created_at, updated_at
          ) VALUES (
            ${ev.venue}, ${norm}, 'venue', ${ev.cityName}, ${ev.stateName || 'NC'},
            'discovered', NOW(), NOW()
          )
          ON CONFLICT DO NOTHING;
        `;

        // Pre-check graph before firing child spider!
        const venueCheck = await checkEntityInSystem(ev.venue);
        if (venueCheck.exists && (venueCheck.hasActiveSource || venueCheck.hasWebsite)) {
          // Entity already known with active calendar source. Skip resolution.
        } else {
          // Brand new venue or missing calendar: Resolve & birth child spider!
          const resolvedVenue = await resolveEntityWebsiteAndCalendar(ev.venue, 'music venue / concert hall / event center', ev.cityName, ev.stateName);
          const venueCalUrl = resolvedVenue?.calendarUrl || resolvedVenue?.officialWebsite;
          if (venueCalUrl) {
            await sql`
              UPDATE entities SET website_url = ${venueCalUrl}, updated_at = NOW()
              WHERE normalized_name = ${norm};
            `;
            const childRes = await sql`
              INSERT INTO sources (
                url, name, source_type, city_name, state_name,
                scrape_interval_days, scrape_horizon_months, status,
                next_scrape_due, created_at, updated_at
              ) VALUES (
                ${venueCalUrl}, ${ev.venue}, 'venue', ${ev.cityName}, ${ev.stateName || 'NC'},
                14, 6, 'active', NOW(), NOW(), NOW()
              )
              ON CONFLICT (url) DO UPDATE SET next_scrape_due = NOW()
              RETURNING id;
            `;
            if (childRes.rowCount > 0) {
              console.log(`    ==> [NEW SPIDER FIRED] Child spider birthed for venue "${ev.venue}" at ${venueCalUrl} (queued at NOW)`);
              childrenQueued++;
            }
          }
        }
      }

      // Upsert organizer if present
      if (ev.organizerName && ev.organizerUrl && ev.organizerUrl.startsWith('http')) {
        const orgRes = await sql`
          INSERT INTO sources (
            url, name, source_type, city_name, state_name,
            scrape_interval_days, scrape_horizon_months, status,
            next_scrape_due, created_at, updated_at
          ) VALUES (
            ${ev.organizerUrl}, ${ev.organizerName}, 'organizer', ${ev.cityName}, ${ev.stateName || 'NC'},
            30, 6, 'active', NOW(), NOW(), NOW()
          )
          ON CONFLICT DO NOTHING
          RETURNING id;
        `;
        if (orgRes.rowCount > 0) childrenQueued++;
      }

      // Upsert performer if present
      if (ev.performerName) {
        const perfNorm = ev.performerName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        await sql`
          INSERT INTO entities (
            name, normalized_name, entity_type, city_name, state_name,
            website_url, verification_status, created_at, updated_at
          ) VALUES (
            ${ev.performerName}, ${perfNorm}, 'performer', ${ev.cityName}, ${ev.stateName || 'NC'},
            ${ev.performerUrl || null}, 'discovered', NOW(), NOW()
          )
          ON CONFLICT DO NOTHING;
        `;
        await sql`
          INSERT INTO performers (
            name, type, tour_page_url, official_site, created_at, updated_at
          ) VALUES (
            ${ev.performerName}, 'band', ${ev.performerUrl || null}, ${ev.performerUrl || null}, NOW(), NOW()
          )
          ON CONFLICT (name) DO UPDATE SET
            tour_page_url = COALESCE(performers.tour_page_url, EXCLUDED.tour_page_url),
            updated_at = NOW();
        `;

        if (ev.performerUrl && ev.performerUrl.startsWith('http')) {
          const perfSrc = await sql`
            INSERT INTO sources (
              url, name, source_type, city_name, state_name,
              scrape_interval_days, scrape_horizon_months, status,
              next_scrape_due, created_at, updated_at
            ) VALUES (
              ${ev.performerUrl}, ${`${ev.performerName} Tour`}, 'artist_tour', ${ev.cityName}, ${ev.stateName || 'NC'},
              30, 12, 'active', NOW(), NOW(), NOW()
            )
            ON CONFLICT (url) DO UPDATE SET next_scrape_due = NOW()
            RETURNING id;
          `;
          if (perfSrc.rowCount > 0) childrenQueued++;
        } else {
          // Pre-check graph before firing performer spider!
          const perfCheck = await checkEntityInSystem(ev.performerName);
          if (perfCheck.exists && (perfCheck.hasActiveSource || perfCheck.hasWebsite)) {
            // Performer already known with active calendar source. Skip resolution.
          } else {
            const resolvedPerf = await resolveEntityWebsiteAndCalendar(ev.performerName, 'band / musician / performer');
            const tourUrl = resolvedPerf?.calendarUrl || resolvedPerf?.officialWebsite;
            if (tourUrl) {
              await sql`
                UPDATE entities SET website_url = ${tourUrl}, updated_at = NOW()
                WHERE normalized_name = ${perfNorm};
              `;
              await sql`
                UPDATE performers SET tour_page_url = ${tourUrl}, official_site = ${tourUrl}, updated_at = NOW()
                WHERE name = ${ev.performerName};
              `;
              const perfSrc = await sql`
                INSERT INTO sources (
                  url, name, source_type, city_name, state_name,
                  scrape_interval_days, scrape_horizon_months, status,
                  next_scrape_due, created_at, updated_at
                ) VALUES (
                  ${tourUrl}, ${`${ev.performerName} Tour`}, 'artist_tour', ${ev.cityName}, ${ev.stateName || 'NC'},
                  30, 12, 'active', NOW(), NOW(), NOW()
                )
                ON CONFLICT (url) DO UPDATE SET next_scrape_due = NOW()
                RETURNING id;
              `;
              if (perfSrc.rowCount > 0) {
                console.log(`    ==> [NEW SPIDER FIRED] Child spider birthed for artist "${ev.performerName}" at ${tourUrl} (queued at NOW)`);
                childrenQueued++;
              }
            }
          }
        }
      }
    } catch (err) {
      // Ignore individual event collisions
    }
  }

  // 2. Ingest discovered child URLs into sources with next_scrape_due = NOW()
  for (const childUrl of crawl.childUrls) {
    try {
      const childRes = await sql`
        INSERT INTO sources (
          url, name, source_type, city_name, state_name,
          scrape_interval_days, scrape_horizon_months, status,
          next_scrape_due, created_at, updated_at
        ) VALUES (
          ${childUrl}, ${`${source.name || 'Discovered'} Child Source`}, 'venue', ${source.city_name || 'Raleigh'}, ${source.state_name || 'NC'},
          30, 6, 'active', NOW(), NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
        RETURNING id;
      `;
      if (childRes.rowCount > 0) childrenQueued++;
    } catch {}
  }

  // 3. Ingest discovered emails
  for (const em of crawl.emails) {
    try {
      const emRes = await sql`
        INSERT INTO email_contacts (
          email, category, city_name, state_name, country_code,
          status, source, metadata, created_at, updated_at
        ) VALUES (
          ${em}, 'Venues & Organizers', ${source.city_name || null}, ${source.state_name || 'NC'}, 'US',
          'active', ${source.url}, ${JSON.stringify({ sourceUrl: source.url, venue: source.name })}, NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
        RETURNING id;
      `;
      if (emRes.rowCount > 0) emailsInserted++;
    } catch {}
  }

  return { eventsInserted, childrenQueued, emailsInserted };
}

/**
 * Main Daemon Loop
 */
async function runSpiderDaemon() {
  console.log('====================================================');
  console.log('       AUTONOMOUS EVER-GOING SPIDER DAEMON          ');
  console.log(` Mode: ${isSingleRun ? 'Single Run Batch' : 'Continuous Daemon Loop'}`);
  console.log(` Batch Size: ${BATCH_SIZE} sources per cycle`);
  console.log('====================================================\n');

  let cycleCount = 0;

  while (isRunning) {
    cycleCount++;
    const now = new Date();
    console.log(`[CYCLE #${cycleCount}] ${now.toISOString()} - Polling for due sources (next_scrape_due <= NOW)...`);

    try {
      const dueSources = TARGET_SOURCE_ID
        ? await sql`
            SELECT id, url, name, source_type, city_name, state_name, scrape_interval_days, next_scrape_due
            FROM sources
            WHERE id = ${TARGET_SOURCE_ID};
          `
        : await sql`
            SELECT id, url, name, source_type, city_name, state_name, scrape_interval_days, next_scrape_due
            FROM sources
            WHERE status = 'active'
              AND (next_scrape_due IS NULL OR next_scrape_due <= NOW())
            ORDER BY id DESC
            LIMIT ${BATCH_SIZE};
          `;

      if (dueSources.rowCount === 0) {
        // Fetch earliest upcoming source to report next wake-up time
        const nextUp = await sql`
          SELECT url, name, next_scrape_due
          FROM sources
          WHERE status = 'active' AND next_scrape_due > NOW()
          ORDER BY next_scrape_due ASC
          LIMIT 1;
        `;
        const nextTime = nextUp.rowCount > 0 ? nextUp.rows[0].next_scrape_due : 'none scheduled';
        console.log(`[QUEUE IDLE] 0 sources due right now. Earliest next scrape: ${nextTime}.`);

        if (isSingleRun) {
          console.log('[SPIDER_DAEMON] Single run completed. Exiting.');
          break;
        }

        console.log(`[SPIDER_DAEMON] Sleeping ${SLEEP_MS / 1000}s before next heartbeat...\n`);
        await sleep(SLEEP_MS);
        continue;
      }

      console.log(`[QUEUE ACTIVE] Found ${dueSources.rowCount} sources due for scraping:\n`);

      for (const src of dueSources.rows) {
        if (!isRunning) break;

        const intervalDays = src.scrape_interval_days || 30;
        console.log(`--> [SPIDER] Crawling: ${src.name || 'Unnamed'} (${src.url})`);
        console.log(`    Location: ${src.city_name || 'N/A'}, ${src.state_name || 'NC'} | Interval: Every ${intervalDays} days`);

        const crawl = await crawlUrl(src.url, src.city_name || 'Raleigh', src.state_name || 'NC');
        const stats = await ingestCrawlResults(src, crawl);

        // Advance schedule for next lifecycle interval
        await sql`
          UPDATE sources
          SET
            last_scraped_at = NOW(),
            next_scrape_due = NOW() + (${intervalDays} || ' days')::interval,
            updated_at = NOW()
          WHERE id = ${src.id};
        `;

        console.log(`    [SUCCESS] +${stats.eventsInserted} events | +${stats.childrenQueued} child sources queued at NOW() | +${stats.emailsInserted} emails`);
        console.log(`    [NEXT DUE] Rescheduled in ${intervalDays} days\n`);
      }

      if (isSingleRun) {
        console.log('[SPIDER_DAEMON] Single run batch finished.');
        break;
      }

      // Small breather between batches
      await sleep(3000);

    } catch (cycleErr) {
      console.error(`[CYCLE_ERROR] ${cycleErr.message}`);
      await sleep(5000);
    }
  }

  console.log('[SPIDER_DAEMON] Daemon terminated cleanly.');
  process.exit(0);
}

runSpiderDaemon().catch(err => {
  console.error('[FATAL_ERROR]', err);
  process.exit(1);
});
