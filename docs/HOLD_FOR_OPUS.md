# Hold for Opus

This document tracks venue seeds and calendar sources that require architectural patterns or specialized parser handlers, held for review and implementation rather than applying one-off brittle patches.

---

## 1. Comédie-Française (Paris, France)
* **URL:** `https://www.comedie-francaise.fr/calendrier-2026-2027`
* **Entity / Venue:** Comédie-Française (National Theatre)
* **Issues / Pattern:**
  1. **Year/Season in URL:** The URL contains hardcoded season years (`calendrier-2026-2027`). Need a canonical permanent route (e.g. `https://www.comedie-francaise.fr/fr/programme-saison`).
  2. **French Theatre Season Architecture:** Season calendars use interactive date filters and custom CMS agenda structures rather than standard Schema.org JSON-LD or iCal feeds.
  3. **Objective for Opus:** Design a standardized season/theatre calendar parser pattern for European performing arts halls.

---

## 2. Accor Arena (Paris, France)
* **URL:** `https://www.accorarena.com/fr/programmation`
* **Entity / Venue:** Accor Arena (Bercy Arena, Paris)
* **Issues / Pattern:**
  1. **Angular SSR / Custom Web Components:** Built with custom tags (`<aa-sessions-dates>`, `<aa-link-item>`). No JSON-LD, Microdata, Tribe Events, or iCal feeds present.
  2. **Missing In-DOM Start Times:** Event showpages display the date (`13 novembre 2026`) but omit start times, deferring door/show times to the separate ticketing subdomain (`billetterie.accorarena.com`). Under current strict rules, events without confirmed start times are routed to `pending_review`.
  3. **Foreign Language Date Strings:** Uses localized French month names rather than standard ISO dates.
  4. **Objective for Opus:** Design a unified European arena / ticketing-linked venue handler that can extract session schedules or resolve times without scraping protected ticketing brokers.
