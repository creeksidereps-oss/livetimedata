# Master Crawl Directory — Event Calendars to Crawl

*Maintained for LiveTimeData Spider Lifecycle*  
*Spreadsheet source file: [`docs/EVENT_CALENDARS_TO_CRAWL.csv`](file:///c:/Users/creek/livetimedata-clean/docs/EVENT_CALENDARS_TO_CRAWL.csv)*

---

| Source Name | Calendar URL | Crawl Frequency | Category / Scope | Coverage Area | Feed Format / Tech | Quality Tier | Extraction Rules | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Iron Podium** | `https://ironpodium.com/browse/events` | **Monthly** | Sports & Recreation / Strongman | Nationwide (US, UK, Global) | Embedded JSON Array (Vue.js state) | **Tier 1** (High Fidelity: Address + Time + Flyer + Description) | Parse embedded `events:[...]` JSON array directly. **DO NOT** create child spiders for host gym venues. Route missing addresses to `pending_review`. | **Active** | 191/193 events contain verified physical street addresses and Cloudfront flyers. |
| **Downtown Newton Development Association** | `http://www.downtownnewton.org` | **Monthly** | Festivals / Community & Civic | Newton, NC | HTML / Social Links | **Tier 1** (Community festival producer) | Scrape seasonal street festivals and community vendor markets. | **Candidate** | Verified organizer behind North College Harvest Fest and downtown events. |
| **City of Newton Parks & Rec** | `https://www.newtonnc.gov/departments/recreation/eventscalendar.php` | **Never (Manual Only)** | Municipal Rec Announcements | Newton, NC | Scanned JPG Image (`OCTOBER HAND OUT.jpg`) | **Tier 4** (Zero HTML text or tables) | **DO NOT crawl with HTML spider.** Staff uploads paper handout images; HTML crawler will choke. | **Excluded from Auto-Crawl** | Requires manual curation or dedicated OCR image watcher. |

---

### Key Metadata Columns Defined:

1. **Source Name**: The primary event producer or directory hub.
2. **Calendar URL**: Direct URL to the calendar/browse endpoint.
3. **Crawl Frequency**: How often the spider should poll (e.g. `Weekly`, `Monthly`, `Quarterly`, `Never`).
4. **Category / Scope**: Niche or event genre.
5. **Coverage Area**: Specific city or nationwide/multi-city aggregator.
6. **Feed Format / Tech**: How data is structured (JSON-LD, iCal, Embedded Vue.js JSON, HTML Table, etc.).
7. **Quality Tier**:
   * **Tier 1**: Complete records (Street address + verified time + flyer + authentic description).
   * **Tier 2**: Good records needing address geocoding or time normalization.
   * **Tier 3**: Aggregators requiring individual page probing.
   * **Tier 4**: Scanned images/PDFs unusable for standard HTML crawlers.
8. **Extraction Rules**: Exact boundaries (e.g. "Do not spawn child venue spiders").
9. **Status**: `Active`, `Candidate`, `Excluded from Auto-Crawl`, `Pushed via Newsletter`.
