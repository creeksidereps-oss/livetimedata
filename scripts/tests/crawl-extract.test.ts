// scripts/tests/crawl-extract.test.ts   run: npx tsx scripts/tests/crawl-extract.test.ts
//
// Offline tests for src/lib/events/crawl: inline fixtures only. No live sites, no DB, no publishEvent().
// Core assertion: location fields come ONLY from the fixture and are empty when the fixture has none.

import * as cheerio from "cheerio";
import {
  parseJsonLdEvents, parseTribeEvents, parseICalEvents, parseAegFeed, parseDomCards, parseHtmlTables,
} from "../../src/lib/events/crawl/parsers";
import { extractFromContent } from "../../src/lib/events/crawl/extract";
import { formatTimeFromDate, isoDateFromSource, parseStartTime } from "../../src/lib/events/crawl/helpers";
import type { ExtractedEvent } from "../../src/lib/events/crawl/types";

const Y = new Date().getUTCFullYear() + 1; // always in the future
const PAGE = "https://example-venue.se/kalender";

let pass = 0;
let fail = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`}`);
}
const LOC_KEYS = ["city", "region", "country", "address", "lat", "lon"] as const;
function locOf(e?: ExtractedEvent) {
  if (!e) return null;
  return Object.fromEntries(LOC_KEYS.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));
}
// Strings that would indicate a parent-source / hardcoded default leaked into an event that the fixture
// did not place there (none of the fixtures mention these places).
const BANNED = /raleigh|statesville|greenwich|charlotte|\bNC\b|local venue/i;
function noDefaults(name: string, evs: ExtractedEvent[]) {
  const leaked = evs.filter((e) => [e.city, e.region, e.country, e.address, e.venue].some((v) => v && BANNED.test(String(v))));
  eq(`${name}: no default/parent locations leaked`, leaked.map((e) => e.title), []);
}

async function main() {
  // ---------------------------------------------------------------- JSON-LD
  const jsonLdHtml = `<!doctype html><html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
    {"@type":"MusicEvent","name":"Hardcore Superstar","startDate":"${Y}-03-14T20:00:00+01:00",
     "description":"Swedish rock band returns for a full headline show with special guests.",
     "location":{"@type":"Place","name":"Börsen","address":{"@type":"PostalAddress","streetAddress":"Drottninggatan 12",
       "addressLocality":"Stockholm","postalCode":"111 51","addressCountry":"SE"},
       "geo":{"@type":"GeoCoordinates","latitude":"59.3326","longitude":"18.0649"}},
     "url":"https://example-venue.se/event/hardcore-superstar"},
    {"@type":"Event","name":"Mystery Gathering","startDate":"${Y}-04-02","description":"A gathering with no stated place at all, held somewhere."},
    {"@type":"Event","name":"Online Webinar Thing","startDate":"${Y}-04-03T18:00:00","eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode"},
    {"@type":"Event","name":"Old Show","startDate":"2001-01-01T19:00:00","location":{"@type":"Place","name":"Old Hall"}},
    {"@type":"TheaterEvent","name":"Hamlet","startDate":"${Y}-05-01T19:30:00",
     "location":{"@type":"Place","name":"Main Stage","address":"12 rue de Rivoli, 75001 Paris, France"}},
    {"@type":"Event","name":"Hybrid Talk","startDate":"${Y}-05-02T18:00:00Z",
     "location":[{"@type":"VirtualLocation","url":"https://zoomish.example"},{"@type":"Place","name":"Library Hall","address":{"addressLocality":"Haines","addressRegion":"AK"}}]}
  ]}</script></head><body><a href="mailto:info@example-venue.org">mail</a></body></html>`;
  const $ = cheerio.load(jsonLdHtml);
  const emails = new Set<string>();
  const ld = parseJsonLdEvents($, PAGE, emails);
  const byTitle = (list: ExtractedEvent[], t: string) => list.find((e) => e.title === t);

  eq("jsonld: event count (online + past dropped)", ld.map((e) => e.title), ["Hardcore Superstar", "Mystery Gathering", "Hamlet", "Hybrid Talk"]);
  const hs = byTitle(ld, "Hardcore Superstar");
  eq("jsonld: structured address -> page location", locOf(hs), {
    city: "Stockholm", country: "SE", address: "Drottninggatan 12, Stockholm, 111 51, SE", lat: 59.3326, lon: 18.0649,
  });
  eq("jsonld: venue", hs?.venue, "Börsen");
  eq("jsonld: local wall-clock time", hs?.startTime, "8:00 PM");
  eq("jsonld: local date", hs?.eventDate, `${Y}-03-14`);
  eq("jsonld: real description kept", hs?.details, "Swedish rock band returns for a full headline show with special guests.");
  const mg = byTitle(ld, "Mystery Gathering");
  eq("jsonld: no location on page -> all location fields empty", locOf(mg), {});
  eq("jsonld: no venue on page -> venue empty (no 'Local Venue')", mg?.venue, "");
  eq("jsonld: date-only -> start time unconfirmed", mg?.startTime, "");
  const ham = byTitle(ld, "Hamlet");
  eq("jsonld: string address kept verbatim, city NOT split out", locOf(ham), { address: "12 rue de Rivoli, 75001 Paris, France" });
  const hy = byTitle(ld, "Hybrid Talk");
  eq("jsonld: physical location chosen over VirtualLocation", locOf(hy), { city: "Haines", region: "AK", address: "Haines, AK" });
  eq("jsonld: 'Z' time -> unconfirmed local time", hy?.startTime, "");
  noDefaults("jsonld", ld);

  // ---------------------------------------------------------------- Tribe REST
  const tribeJson = {
    events: [
      {
        status: "publish", title: "Harvest Festival &#8211; Day 1", url: "https://example.org/event/harvest/",
        description: "<p>Live music, local food and crafts across the downtown square all afternoon.</p>",
        start_date: `${Y}-09-20 11:00:00`, all_day: false,
        venue: { venue: "Town Square", address: "100 Main St", city: "Haines", state: "AK", zip: "99827", country: "United States", geo_lat: "59.2358", geo_lng: "-135.4450" },
        organizer: [{ organizer: "Haines Chamber", website: "https://haineschamber.example", email: "events@hainesalaska.org" }],
        image: { url: "https://example.org/img/harvest.jpg" },
      },
      {
        status: "publish", title: "Venue-less Meetup", url: "https://example.org/event/meetup/",
        description: "<p>Monthly meetup for members and friends, details shared on arrival.</p>",
        start_date: `${Y}-10-01 00:00:00`, all_day: true, venue: [],
      },
      { status: "draft", title: "Draft Event", start_date: `${Y}-10-02 10:00:00` },
    ],
  };
  const tEmails = new Set<string>();
  const tribe = parseTribeEvents(tribeJson, "https://example.org/events/", tEmails);
  eq("tribe: event count (draft dropped)", tribe.map((e) => e.title), ["Harvest Festival – Day 1", "Venue-less Meetup"]);
  eq("tribe: venue city/state/country/zip/address -> page location", locOf(tribe[0]), {
    city: "Haines", region: "AK", country: "United States", address: "100 Main St, Haines, AK 99827, United States", lat: 59.2358, lon: -135.445,
  });
  eq("tribe: time", tribe[0]?.startTime, "11:00 AM");
  eq("tribe: organizer", tribe[0]?.organizerName, "Haines Chamber");
  eq("tribe: organizer email collected", [...tEmails], ["events@hainesalaska.org"]);
  eq("tribe: no venue -> all location fields empty", locOf(tribe[1]), {});
  eq("tribe: explicit all_day -> 'All Day'", tribe[1]?.startTime, "All Day");
  noDefaults("tribe", tribe);

  // ---------------------------------------------------------------- iCal
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "X-WR-TIMEZONE:Europe/Stockholm",
    "BEGIN:VEVENT",
    `DTSTART;TZID=Europe/Stockholm:${Y}0612T190000`,
    "SUMMARY:Midsommar Concert",
    "DESCRIPTION:Outdoor concert with the city orchestra\\, bring a blanket and a picnic.",
    "LOCATION:Stadsparken\\, Parkgatan 5\\, 222 22 Lund\\, Sweden",
    "GEO:55.7047;13.1910",
    "URL:https://example-venue.se/e/midsommar",
    "END:VEVENT",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${Y}0701`,
    "SUMMARY:Nameless Fair",
    "DESCRIPTION:A long-running community fair with stalls and games for every",
    " one in the family.",
    "END:VEVENT",
    "BEGIN:VEVENT",
    `DTSTART:${Y}0702T170000Z`,
    "SUMMARY:UTC Talk",
    "LOCATION:Aula Magna",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART:20010101T100000",
    "SUMMARY:Ancient Event",
    "LOCATION:Somewhere 1\\, Oldtown",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const ical = parseICalEvents(ics, "https://example-venue.se/cal.ics");
  eq("ical: event count (past dropped)", ical.map((e) => e.title), ["Midsommar Concert", "Nameless Fair", "UTC Talk"]);
  eq("ical: LOCATION -> address verbatim, GEO -> coords, no city invented", locOf(ical[0]), {
    address: "Stadsparken, Parkgatan 5, 222 22 Lund, Sweden", lat: 55.7047, lon: 13.191,
  });
  eq("ical: venue from LOCATION first part", ical[0]?.venue, "Stadsparken");
  eq("ical: TZID local time", ical[0]?.startTime, "7:00 PM");
  eq("ical: escaped commas in description", ical[0]?.details, "Outdoor concert with the city orchestra, bring a blanket and a picnic.");
  eq("ical: no LOCATION/GEO -> all location fields empty", locOf(ical[1]), {});
  eq("ical: folded description unfolded", ical[1]?.details, "A long-running community fair with stalls and games for everyone in the family.");
  eq("ical: VALUE=DATE -> 'All Day'", ical[1]?.startTime, "All Day");
  eq("ical: UTC + X-WR-TIMEZONE converted to local", [ical[2]?.eventDate, ical[2]?.startTime], [`${Y}-07-02`, "7:00 PM"]);
  eq("ical: venue-only LOCATION -> venue, no address", [ical[2]?.venue, locOf(ical[2])], ["Aula Magna", {}]);
  noDefaults("ical", ical);

  // ---------------------------------------------------------------- AEG feed
  const aeg = parseAegFeed({
    events: [
      { eventDateTime: `${Y}-02-10T19:30:00`, title: { eventTitleText: "Band A" }, venue: { title: "The Hall", city: "Denver", state: "CO" }, bio: "" },
      { eventDateTime: `${Y}-02-11T20:00:00`, title: { eventTitleText: "Band B" }, venue: { title: "The Hall" } },
    ],
  }, "https://thehall.example/events");
  eq("aeg: venue city/state from feed", locOf(aeg[0]), { city: "Denver", region: "CO", address: "Denver, CO" });
  eq("aeg: empty bio -> empty description (no template)", aeg[0]?.details, "");
  eq("aeg: no venue city -> empty location", locOf(aeg[1]), {});

  // ---------------------------------------------------------------- DOM cards + tables
  const domHtml = `<html><body><h1>Raleigh Venue Events</h1>
    <div class="event-card"><h3><a href="/show/1">Jazz Night</a></h3><span class="date">March 3, ${Y}</span><span class="time">8pm</span>
      <span class="venue">Blue Room</span><div class="address">55 King St, Charleston, SC 29401</div></div>
    <div class="event-card"><h3><a href="/show/2">Poetry Slam</a></h3><span class="date">March 4, ${Y}</span></div>
  </body></html>`;
  const dom = parseDomCards(cheerio.load(domHtml), "https://bluroom.example/events");
  eq("dom: card address used", locOf(dom[0]), { address: "55 King St, Charleston, SC 29401" });
  eq("dom: card time parsed", dom[0]?.startTime, "8:00 PM");
  eq("dom: card without location -> empty; page h1 never used", [locOf(dom[1]), dom[1]?.venue], [{}, ""]);
  eq("dom: card without time -> unconfirmed (no default 7:30 PM)", dom[1]?.startTime, "");

  const tableHtml = `<html><body><h2>June ${Y}</h2><div><table>
    <tr><td>Date</td><td>Event</td><td>Building</td></tr>
    <tr><td>14</td><td><strong>Gem Show</strong> Minerals and fossils from regional collectors.</td><td>Expo Hall</td></tr>
  </table></div><table><tr><td>3</td><td>Unlabelled Month Thing</td></tr></table></body></html>`;
  const tables = parseHtmlTables(cheerio.load(tableHtml), "https://fair.example/calendar");
  eq("table: only tables with a stated month", tables.map((e) => [e.title, e.eventDate]), [["Gem Show", `${Y}-06-14`]]);
  eq("table: no location in row -> empty", locOf(tables[0]), {});
  eq("table: no time in row -> unconfirmed (no default 9:00 AM)", tables[0]?.startTime, "");

  // ---------------------------------------------------------------- extractFromContent (offline)
  const full = await extractFromContent(PAGE, jsonLdHtml, { network: false });
  eq("extract: strategy", full.strategies, ["jsonld"]);
  eq("extract: email from mailto", full.extractedEmails.includes("info@example-venue.org"), true);
  const icsDirect = await extractFromContent("https://example-venue.se/cal.ics", ics, { network: false });
  eq("extract: raw iCal body", icsDirect.events.length, 3);
  noDefaults("extract", [...full.events, ...icsDirect.events]);

  // ---------------------------------------------------------------- helpers
  eq("time: date-only -> ''", formatTimeFromDate(`${Y}-01-01`), "");
  eq("time: midnight -> ''", formatTimeFromDate(`${Y}-01-01T00:00:00`), "");
  eq("time: offset kept as wall clock", formatTimeFromDate(`${Y}-01-01T21:15:00-05:00`), "9:15 PM");
  eq("time: free text range", parseStartTime("Times: Thurs., 6-7pm"), "6:00 PM");
  eq("time: none -> ''", parseStartTime("Every weekend"), "");
  eq("date: local date not shifted to UTC", isoDateFromSource(`${Y}-03-14T23:30:00-08:00`), `${Y}-03-14`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
