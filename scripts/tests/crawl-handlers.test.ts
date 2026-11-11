// scripts/tests/crawl-handlers.test.ts   run: npx tsx scripts/tests/crawl-handlers.test.ts
//
// Offline tests for the spider repair (2026-11-10): add-to-calendar handler, venue-stated location,
// hub/detail/article classification, pagination, canonical URLs, localized dates, fetch classification.
// Inline fixtures only. No live sites, no DB, no publishEvent(), no geocoder (verifier is stubbed).

import * as cheerio from "cheerio";
import { parseCalendarLinks, parseDomCards } from "../../src/lib/events/crawl/parsers";
import { extractFromContent } from "../../src/lib/events/crawl/extract";
import { isoDateFromSource, localizeDateWords } from "../../src/lib/events/crawl/helpers";
import {
  canonicalUrl, classifyPage, collectEntities, detectHandlerQueue, findHubLinks, findPaginationLinks, isListingShaped, pagingInfo,
} from "../../src/lib/events/crawl/discover";
import {
  applySiteVenues, collectSiteVenues, readVenueCandidates, readVenueDirectoryLinks, venueNamesMatch, type VenueVerifier,
} from "../../src/lib/events/crawl/venueLocation";
import { isJsShell, isWafResponse } from "../../src/lib/events/crawl/fetch";
import type { ExtractedEvent } from "../../src/lib/events/crawl/types";

const Y = new Date().getUTCFullYear() + 1; // always in the future

let pass = 0;
let fail = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`}`);
}

// Stub verifier: accepts any street-level address with a city token we recognise (no network).
const KNOWN: Record<string, string> = { springfield: "springfield-us", rivertown: "rivertown-us", lakeside: "lakeside-ca" };
const verify: VenueVerifier = async (c) => {
  const t = `${c.city || ""} ${c.address}`.toLowerCase();
  const k = Object.keys(KNOWN).find((x) => t.includes(x));
  return k ? { citySlug: KNOWN[k], cityName: k } : null;
};

function gcal(text: string, dates: string, location: string, ctz = "America/New_York") {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${dates}&ctz=${encodeURIComponent(ctz)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent("Get tickets at the box office or online.")}`;
}

async function main() {
  // ------------------------------------------------------------ 1. add-to-calendar handler (tour page)
  const tourHtml = `<html><head><title>Tickets & Tour Dates | Ice Show</title></head><body><main><div class="board">
    <div class="engagement">
      <div class="details"><div class="venue-link"><a href="https://www.springfieldarena.com">More Venue Info</a></div>
        <a href="https://www.ticketmaster.com/x">Buy</a><a href="https://springfieldarena.com/events/?group_sales_only=1">Groups</a></div>
      <div class="dates">
        <a href="${gcal("Ice Show - Springfield - Coming up in 1 week!", `${Y}0104T090000/${Y}0104T110000`, "Springfield Arena, 100 Main Street, Springfield, IL 62701")}">remind</a>
        <a href="${gcal("Ice Show - Springfield", `${Y}0111T190000/${Y}0111T210000`, "Springfield Arena, 100 Main Street, Springfield, IL 62701")}">add</a>
        <a href="${gcal("Ice Show - Springfield", `${Y}0112T130000/${Y}0112T150000`, "Springfield Arena, 100 Main Street, Springfield, IL 62701")}">add</a>
        <a href="https://outlook.live.com/calendar/0/deeplink/compose?subject=Ice%20Show&startdt=${Y}-01-11T19:00:00">outlook</a>
      </div>
    </div>
    <div class="engagement">
      <div class="details"><div class="venue-link"><a href="https://lakesidecentre.ca/">More Venue Info</a></div></div>
      <div class="dates"><a href="${gcal("Ice Show - Lakeside", `${Y}0220T000000Z/${Y}0220T020000Z`, "Lakeside Centre, 300 Portage Ave., Lakeside, MB R3C 5S4", "America/Winnipeg")}">add</a></div>
    </div>
  </div></main></body></html>`;
  const $tour = cheerio.load(tourHtml);
  const cal = parseCalendarLinks($tour, "https://www.iceshow.example/en-us/tickets/");
  eq("calendar: reminder links dropped, 3 performances", cal.map((e) => [e.title, e.eventDate, e.startTime]), [
    ["Ice Show - Springfield", `${Y}-01-11`, "7:00 PM"],
    ["Ice Show - Springfield", `${Y}-01-12`, "1:00 PM"],
    ["Ice Show - Lakeside", `${Y}-02-19`, "6:00 PM"],
  ]);
  eq("calendar: full address as stated", cal[0]?.address, "Springfield Arena, 100 Main Street, Springfield, IL 62701");
  eq("calendar: venue name = first address part", cal[0]?.venue, "Springfield Arena");
  eq("calendar: venue's own site from the same block (not ticket / group-sales links)", cal[0]?.venueUrl, "https://www.springfieldarena.com/");
  eq("calendar: second venue block gets its own site", cal[2]?.venueUrl, "https://lakesidecentre.ca/");
  eq("calendar: UTC time converted with the link's own ctz", cal[2]?.startTime, "6:00 PM");
  const tourEntities = collectEntities(cal, []);
  eq("calendar: each tour stop venue is an entity with a URL", tourEntities.map((e) => [e.type, e.name, e.url]), [
    ["venue", "Springfield Arena", "https://www.springfieldarena.com/"],
    ["venue", "Lakeside Centre", "https://lakesidecentre.ca/"],
  ]);
  const tourFull = await extractFromContent("https://www.iceshow.example/en-us/tickets/", tourHtml, { network: false });
  eq("calendar: extractFromContent picks calendar_link", tourFull.strategies, ["calendar_link"]);
  eq("calendar: tour page is a hub", tourFull.pageClass, "hub");

  // ------------------------------------------------------------ 2. venue-stated location (single venue)
  const venueHtml = `<html><head><title>Events | Springfield Arena</title><meta property="og:site_name" content="Springfield Arena"></head><body>
    <div class="eventItem"><h3><a href="/events/detail/rock-night">Rock Night</a></h3><div class="date">January 20, ${Y}</div><div class="time">7:30 PM</div></div>
    <div class="eventItem"><h3><a href="/events/detail/hockey">Hockey Game</a></h3><div class="date">January 22, ${Y}</div><div class="time">7:00 PM</div></div>
    <div class="eventItem"><h3><a href="/events/detail/away">Expo Away</a></h3><div class="date">January 25, ${Y}</div><div class="address">55 Elm Road, Rivertown, OH 44101</div></div>
    <footer><address>Springfield Arena<br>100 Main Street<br>Springfield, IL 62701</address><a href="/events">Events</a><a href="/events/groups">Groups</a></footer>
  </body></html>`;
  const vEvents = parseDomCards(cheerio.load(venueHtml), "https://www.springfieldarena.com/events");
  eq("venue: three events parsed", vEvents.length, 3);
  const cands = readVenueCandidates(cheerio.load(venueHtml), "https://www.springfieldarena.com/events");
  eq("venue: footer address read as the site's own address", cands.map((c) => [c.name, c.from]), [["Springfield Arena", "address_text"]]);
  const sv = await collectSiteVenues(venueHtml, "https://www.springfieldarena.com/events", vEvents, async () => null, verify);
  const applied = applySiteVenues(vEvents, sv);
  eq("venue: applied to the two events with no location", applied, { applied: 2, status: "verified" });
  eq("venue: provenance recorded", vEvents.map((e) => e.locationProvenance || "event"), ["venue_site", "venue_site", "event"]);
  eq("venue: card-stated location always wins", vEvents[2].address, "55 Elm Road, Rivertown, OH 44101");
  eq("venue: venue name filled from the site", vEvents[0].venue, "Springfield Arena");

  // ------------------------------------------------------------ 3. venue-stated location (multi-venue org)
  const orgHtml = `<html><head><title>Events | City Arts</title></head><body>
    <nav><a href="https://cityarts.example/venues/detail/belk-hall">Belk Hall</a><a href="https://cityarts.example/venues/detail/knight-stage">Knight Stage</a></nav>
    <div class="eventItem"><h3><a href="/events/detail/a">Play A</a></h3><div class="date">March 1, ${Y}</div><div class="venue">Belk Hall</div></div>
    <div class="eventItem"><h3><a href="/events/detail/b">Play B</a></h3><div class="date">March 2, ${Y}</div><div class="venue">Knight Stage</div></div>
    <div class="eventItem"><h3><a href="/events/detail/c">Play C</a></h3><div class="date">March 3, ${Y}</div><div class="venue">Somewhere Else Hall</div></div>
    <div class="eventItem"><h3><a href="/events/detail/d">Play D</a></h3><div class="date">March 4, ${Y}</div></div>
  </body></html>`;
  const venuePages: Record<string, string> = {
    "https://cityarts.example/venues/detail/belk-hall": `<html><body><div class="venue-address">130 North Tryon Street, Springfield, IL 62702</div></body></html>`,
    "https://cityarts.example/venues/detail/knight-stage": `<html><body><script type="application/ld+json">{"@type":"PerformingArtsTheater","name":"Knight Stage","address":{"@type":"PostalAddress","streetAddress":"430 South Tryon Street","addressLocality":"Springfield","addressRegion":"IL"}}</script></body></html>`,
  };
  const oEvents = parseDomCards(cheerio.load(orgHtml), "https://cityarts.example/events");
  eq("multi: venue directory links read", readVenueDirectoryLinks(cheerio.load(orgHtml), "https://cityarts.example/events").map((l) => l.name), ["Belk Hall", "Knight Stage"]);
  const osv = await collectSiteVenues(orgHtml, "https://cityarts.example/events", oEvents, async (u) => venuePages[u] || null, verify);
  const oApplied = applySiteVenues(oEvents, osv);
  eq("multi: each named venue gets its own stated address", oEvents.slice(0, 2).map((e) => e.address), ["130 North Tryon Street, Springfield, IL 62702", "430 South Tryon Street, Springfield, IL"]);
  eq("multi: unknown venue name gets nothing", oEvents[2].address, undefined);
  eq("multi: event with no venue on a multi-venue site gets nothing", oEvents[3].address, undefined);
  eq("multi: status", oApplied, { applied: 2, status: "multi_venue" });

  // Organisation address must not be applied to unnamed events on a calendar that names several venues.
  const mixed: ExtractedEvent[] = [
    { title: "X", details: "", category: "", venue: "Hall One", startTime: "", eventDate: `${Y}-05-01`, sourceUrl: "https://o.example", strategy: "dom_card" },
    { title: "Y", details: "", category: "", venue: "Hall Two", startTime: "", eventDate: `${Y}-05-02`, sourceUrl: "https://o.example", strategy: "dom_card" },
    { title: "Z", details: "", category: "", venue: "", startTime: "", eventDate: `${Y}-05-03`, sourceUrl: "https://o.example", strategy: "dom_card" },
  ];
  applySiteVenues(mixed, [{ name: "Org HQ", address: "1 Office Park, Springfield, IL", evidenceUrl: "https://o.example", from: "address_text", citySlug: "springfield-us", verifiedCity: "springfield" }]);
  eq("mixed: unnamed event not placed at the org address when the calendar names other venues", mixed.map((e) => e.address), [undefined, undefined, undefined]);
  eq("venue names: 'The Belk Theater' ~ 'Belk Theater'", venueNamesMatch("The Belk Theater", "Belk Theater"), true);
  eq("venue names: 'Hall' !~ 'Knight Hall Annex'", venueNamesMatch("Hall", "Knight Hall Annex"), false);

  // ------------------------------------------------------------ 4. hubs vs detail pages, spawn rule
  eq("listing: /events", isListingShaped("https://a.example/events"), true);
  eq("listing: /en/whats-on", isListingShaped("https://a.example/en/whats-on"), true);
  eq("listing: /calendar/list", isListingShaped("https://a.example/calendar/list"), true);
  eq("listing: /events/category/music", isListingShaped("https://a.example/events/category/music"), true);
  eq("listing: detail /events/charbroil-300 is not a hub", isListingShaped("https://a.example/events/charbroil-300/"), false);
  eq("listing: /events/groups is not a calendar", isListingShaped("https://a.example/events/groups"), false);
  eq("listing: /events/group-tickets is not a calendar", isListingShaped("https://a.example/events/group-tickets"), false);
  eq("listing: /events/mobile-ticketing is not a calendar", isListingShaped("https://a.example/events/mobile-ticketing"), false);
  eq("listing: /events/facility-maps is not a calendar", isListingShaped("https://a.example/events/facility-maps/"), false);
  eq("listing: news article path", isListingShaped("https://paper.example/news/2026/old-stats"), false);

  const hubHtml = `<html><body>
    <a href="/events">Events</a><a href="/events/detail/rock-night">Rock Night</a><a href="/calendar?utm_source=x">Calendar</a>
    <a href="https://other.example/events">Other site</a><a href="/events/groups">Groups</a><a href="/whats-on">What's on</a></body></html>`;
  eq("hubs: same-site listing pages only, canonical, detail pages excluded",
    findHubLinks(cheerio.load(hubHtml), "https://www.springfieldarena.com/home", new Set(["https://www.springfieldarena.com/events/detail/rock-night"])),
    ["https://www.springfieldarena.com/events", "https://www.springfieldarena.com/calendar", "https://www.springfieldarena.com/whats-on"]);

  const emptyPage = await extractFromContent("https://paper.example/sports/old-stats", `<html><head><script type="application/ld+json">{"@type":"NewsArticle","headline":"Old stats"}</script><title>Old stats</title></head><body><p>Scores from 1998.</p><a href="/events">Events</a></body></html>`, { network: false });
  eq("article: classified as article (explicit NewsArticle)", emptyPage.pageClass, "article");
  const wpPage = await extractFromContent("https://fest.example/events", `<html><head><meta property="og:type" content="article"></head><body><a href="/calendar">Calendar</a></body></html>`, { network: false });
  eq("article: og:type article alone (WordPress SEO default) is NOT an article", wpPage.pageClass, "empty");
  eq("paging: month URL carries months ahead", pagingInfo(`https://hb.example/events?month=01&year=${Y + 1}`).monthsAhead! > 12, true);
  eq("article: spawns nothing (no events, no venues)", emptyPage.subUrls, []);
  const nothing = await extractFromContent("https://x.example/about", `<html><body><p>Hello</p><a href="/events">Events</a></body></html>`, { network: false });
  eq("empty page: class empty, spawns nothing", [nothing.pageClass, nothing.subUrls], ["empty", []]);
  const venueHome = await extractFromContent("https://www.springfieldarena.com/", `<html><head><meta property="og:site_name" content="Springfield Arena"></head><body><a href="/events">Events</a><footer><address>100 Main Street, Springfield, IL 62701</address></footer></body></html>`, { network: false });
  eq("venue homepage (no events, own address): facility that spawns its calendar", [venueHome.pageClass, venueHome.subUrls], ["facility", ["https://www.springfieldarena.com/events"]]);

  const detailHtml = `<html><head><script type="application/ld+json">{"@type":"Event","name":"Charbroil 300","startDate":"${Y}-05-22T19:30:00","url":"https://speedway.example/events/charbroil-300/","location":{"@type":"Place","name":"Speedway","address":{"@type":"PostalAddress","streetAddress":"5555 Concord Pkwy S","addressLocality":"Concord","addressRegion":"NC"}}}</script></head><body><a href="/events">All events</a><a href="/events/travel/">Travel</a></body></html>`;
  const detail = await extractFromContent("https://speedway.example/events/charbroil-300/", detailHtml, { network: false });
  eq("detail: single-event page classified as detail", detail.pageClass, "detail");
  eq("detail: still leads to the site's real calendar, not to travel/refer pages", detail.subUrls, ["https://speedway.example/events"]);

  const $c = cheerio.load("<html><body></body></html>");
  eq("classify: js shell", classifyPage({ $: $c, url: "https://a.example/", events: [], venueCount: 0, hasPagination: false, fetchStatus: "js_shell" }), "js_shell");

  // ------------------------------------------------------------ 5. pagination + canonical URLs
  const pagHtml = `<html><head><link rel="next" href="/events/page/2/"></head><body><a href="/events/page/2/">Next</a><a href="/events/?tribe_event_display=past">Previous events</a><a href="/events?page=2" aria-label="Next page">›</a></body></html>`;
  eq("pagination: rel=next / Next / aria-label, past excluded", findPaginationLinks(cheerio.load(pagHtml), "https://a.example/events/"), ["https://a.example/events/page/2/", "https://a.example/events?page=2"]);
  eq("canonical: tracking params stripped, query sorted",
    canonicalUrl("https://Disney.example/events/Show-1/?xref=XMAwebsite&b=2&utm_source=x&a=1#top"), "https://disney.example/events/Show-1/?a=1&b=2");

  // Page / date variants: never new sources; past months never followed (current & future only).
  const CY = new Date().getUTCFullYear();
  { const i = pagingInfo("https://hb.example/events?mode=calendar&month=04&year=2019"); eq("paging: past month is past", [i.paged, i.past], [true, true]); }
  { const i = pagingInfo(`https://hb.example/events?mode=calendar&month=02&year=${Y}`); eq("paging: next year's month is not past", [i.paged, i.past], [true, false]); }
  eq("paging: ?ao_pg=8 is a page of the same listing", pagingInfo("https://artscal.example/events/?ao_pg=8"), { paged: true, past: false });
  eq("paging: plain listing is not paged", pagingInfo("https://artscal.example/events/"), { paged: false, past: false });
  const gridHtml = `<html><body>
    <a href="/events?mode=calendar&month=04&year=2019">2019</a>
    <a href="/events?mode=calendar&month=01&year=${CY - 1}">last year</a>
    <a href="/events?mode=calendar&month=03&year=${Y}">future month</a>
    <a href="/events/?ao_pg=2">2</a>
    <a href="/calendar">Calendar</a></body></html>`;
  eq("hubs: page/date variants are never hubs", findHubLinks(cheerio.load(gridHtml), "https://hb.example/events", new Set()), ["https://hb.example/calendar"]);
  eq("pagination: same calendar's future month and page 2 followed, past months dropped",
    findPaginationLinks(cheerio.load(gridHtml), "https://hb.example/events"),
    [`https://hb.example/events?mode=calendar&month=03&year=${Y}`, "https://hb.example/events/?ao_pg=2"]);

  // ------------------------------------------------------------ 6. localized dates
  eq("date fr: 13 novembre", isoDateFromSource(`13 novembre ${Y}`), `${Y}-11-13`);
  eq("date fr: 1er décembre", isoDateFromSource(`1er décembre ${Y}`), `${Y}-12-01`);
  eq("date fr: weekday + month", isoDateFromSource(`samedi 7 février ${Y}`), `${Y}-02-07`);
  eq("date de: 13. November", isoDateFromSource(`13. November ${Y}`), `${Y}-11-13`);
  eq("date es: sábado 5 de diciembre de", isoDateFromSource(`sábado 5 de diciembre de ${Y}`), `${Y}-12-05`);
  eq("date it: 3 marzo", isoDateFromSource(`3 marzo ${Y}`), `${Y}-03-03`);
  eq("date en: untouched", localizeDateWords(`March 3, ${Y}`), `March 3, ${Y}`);
  eq("date: numeric d/m/y never reinterpreted", localizeDateWords("03/04/2027"), "03/04/2027");

  // ------------------------------------------------------------ 7. fetch classification + handler queue
  eq("waf: cloudflare 403", isWafResponse(403, { server: "cloudflare" }, "<html>Just a moment...</html>"), true);
  eq("waf: plain 404 is not waf", isWafResponse(404, {}, "not found"), false);
  eq("waf: 403 challenge body", isWafResponse(403, {}, "<title>Attention Required!</title>"), true);
  eq("js shell: empty app root", isJsShell(`<html><head><script src="/main.js"></script></head><body><app-root></app-root></body></html>`), true);
  eq("js shell: real page is not", isJsShell(`<html><body>${"<p>Real event listing text here.</p>".repeat(40)}</body></html>`), false);
  eq("handler queue: season URL", detectHandlerQueue("https://theatre.example/calendrier-2026-2027", "ok", [], "empty"), "season_url");
  eq("handler queue: blocked", detectHandlerQueue("https://a.example/events", "waf_blocked", [], "empty"), "waf_blocked");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
