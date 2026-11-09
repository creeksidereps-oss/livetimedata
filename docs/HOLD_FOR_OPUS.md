# Hold for Opus

This document tracks venue seeds and calendar sources that require architectural patterns, specialized parser handlers, or policy solutions, held for review and implementation rather than applying one-off brittle patches.

---

## 1. Cloud-Blocked & Failed Initial Seeds

### Visit Raleigh (`#1213`)
* **URL:** `https://www.visitraleigh.com/events/`
* **Status:** Failed on Vercel Cloud with `403 Forbidden`
* **Issue:** Protected by WAF / Cloudflare bot-shielding that blocks server datacenter IP requests (like Vercel/AWS).
* **Objective for Opus:** Evaluate designated handler: test browser-mimicking headers, upstream destination marketing API (Simpleview CMS endpoints if exposed), or residential proxy rotation if permitted.

### NC Festivals (`#498`)
* **URL:** `https://www.ncfestivals.com/events`
* **Status:** Returned 200 OK, but parsed `0 events found`
* **Issue:** Non-standard portal layout. Does not implement Schema.org JSON-LD, Microdata, or iCal feeds. The event listings exist inside proprietary ASP.NET table/card DOM containers.
* **Objective for Opus:** Build a designated DOM handler for this portal layout or discover its underlying feed/API endpoint.

---

## 2. French Stadiums, Arenas & Ticketing Subdomains

### Comédie-Française (Paris, France)
* **URL:** `https://www.comedie-francaise.fr/calendrier-2026-2027`
* **Issue:**
  1. **Year/Season in URL:** URL contains hardcoded season years (`calendrier-2026-2027`). Needs a canonical permanent route (e.g. `https://www.comedie-francaise.fr/fr/programme-saison`).
  2. **French Theatre Season Architecture:** Season calendars use interactive date filters and custom CMS agenda structures rather than standard Schema.org JSON-LD or iCal feeds.
* **Objective for Opus:** Design a standardized season/theatre calendar parser pattern for European performing arts halls.

### Accor Arena (Paris, France)
* **URL:** `https://www.accorarena.com/fr/programmation`
* **Issue:**
  1. **Angular SSR / Custom Web Components:** Built with custom tags (`<aa-sessions-dates>`, `<aa-link-item>`). No JSON-LD, Microdata, Tribe Events, or iCal feeds present.
  2. **Missing In-DOM Start Times:** Event showpages display the date (`13 novembre 2026`) but omit start times, deferring door/show times to the separate ticketing subdomain (`billetterie.accorarena.com`). Under current strict rules, events without confirmed start times are routed to `pending_review`.
  3. **Foreign Language Date Strings:** Uses localized French month names rather than standard ISO dates.
* **Objective for Opus:** Design a unified European arena / ticketing-linked venue handler that can extract session schedules or resolve times without scraping protected ticketing brokers.

### French Ticketing Portals & Arenas
* **Paris Saint-Germain (PSG) Ticketing:**
  * `https://billetterie.psg.fr/fr/calendrier-des-matchs` (Soccer)
  * `https://billetterie.psg.fr/fr/hand/calendrier-des-matchs` (Handball)
  * `https://billetterie.psg.fr/fr/footfem/calendrier-des-matchs` (Women's Soccer)
* **Paris FC Ticketing:**
  * `https://billetterie.parisfc.fr/fr/calendrier`
  * `https://billetterie.parisfc.fr/fr/equipe-feminine/calendrier`
* **Stade Français Rugby:** `https://billetterie.stade.fr/fr/calendrier`
* **Stade de France:** `https://www.stadefrance.com/fr/billetteries`
* **Adidas Arena:** `https://www.adidasarena.com/programmation`
* **Dôme de Paris:** `https://www.ledomedeparis.com/fr/spectacles/a-laffiche`
* **Plénitude Arena:** `https://www.plenitudearena.com/billetterie/`
* **City of Paris Calendar:** `https://www.paris.fr/quefaire/semaine` and `https://www.paris.fr/pages/les-concerts-du-mois-de-novembre-a-paris-37062`
* **Common Problem Across All:** French ticketing engines (Secutix, Digitick, Ticketmaster FR) lock event dates and match kickoff times inside dynamic booking modals or require session cookies.
* **Objective for Opus:** Create a unified European sports/arena handler that hooks into official league fixtures (e.g. Ligue 1, Top 14 Rugby) rather than parsing fragile ticketing subdomains.

---

## 3. Major Sports League Roll-Up Design

### League Schedules vs. Aggregator Portals
* **NFL Official:** `https://www.nfl.com/schedules`
* **ESPN Sports Portals:**
  * `https://www.espn.com/nba/schedule`
  * `https://www.espn.com/nfl/`
  * `https://www.espn.com/college-football/schedule`
  * `https://www.espn.com/mlb/schedule`
  * `https://www.espn.com/soccer/schedule`
  * `https://www.espn.com/nhl/schedule`
  * `https://www.espn.com/wnba/schedule`
  * `https://www.espn.com/boxing/story/_/id/12508267/boxing-schedule`
  * `https://www.espn.com/mma/schedule`
  * `https://www.espn.com/golf/schedule` (including TGL, WTGL, LPGA, Champions Tour, LIV, European Tour)
* **Project Policy (Rule 7):** Team matches roll up to the league schedule source, not one spider per team.
* **Objective for Opus:** Decide architecture: should we ingest from hidden JSON schedule APIs (e.g. ESPN's site API `site.api.espn.com/apis/site/v2/sports/...`) or use official league feeds (NFL.com, NBA.com)? Ensure venue addresses and host cities map cleanly to official stadium entities.

---

## 4. Rejected Seeds & Architectural Alternatives

### Secondary Ticket Aggregators
* **VividSeats Horse Racing:** `https://www.vividseats.com/sports/horse-racing?wsUser=717&wsVar=Horseracingindexnav`
* **Reason Rejected:** Secondary ticket broker/aggregator. Strictly banned by Rule 6.
* **Objective for Opus:** Determine official horse racing calendar sources (e.g. Equibase, NTRA, or primary track sources like Churchill Downs, Belmont, Saratoga) to cover race schedules without aggregators.

### Facility Description Pages (No Event Calendars)
* **Stade Yves-du-Manoir:** `https://www.hauts-de-seine.fr/sortir-et-decouvrir/sport/equipements-sportifs/le-stade-departemental-yves-du-manoir`
* **Gymnase Bertrand Dauvin:** `https://www.paris.fr/lieux/centre-sportif-bertrand-dauvin-3074`
* **La Patinoire de l'Accor Arena:** `https://www.accorarena.com/fr/le-faubourg/patinoire`
* **Stade Paul Faber:** `https://www.paris.fr/lieux/stade-paul-faber-3070`
* **Stade Élisabeth:** `https://www.paris.fr/lieux/centre-sportif-elisabeth-3050`
* **Théâtre Édouard VII:** `https://www.theatreedouard7.com/`
* **Reason Rejected / Held:** These are municipal static facility profiles, public park guides, or facility hours pages—not live calendar feeds of upcoming ticketed events.
* **Objective for Opus:** Create a distinction between "Physical Facility/Venue Directory Listings" (which have addresses and opening hours) and "Event Calendar Feeds" (which have specific upcoming scheduled dates/times).

### Missing URL Seeds
* **Théâtre du Palais-Royal:** Submitted as a bare name without a URL.
* **Reason Rejected:** Banned by Rule 4 (Option A gatekeeper: venues only get spiders if they have a real calendar URL; spiders never guess or fabricate URLs).
* **Objective for Opus:** Establish a verified intake workflow to locate and validate official calendar URLs before registering entities.
