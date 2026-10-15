# Project Guidelines & Rules - LiveTimeData

## Webcam Ingestion & Sourcing Rules

### Banned Sources
- **Windy.com / Windy Webcams:** **STRICTLY BANNED / DO NOT USE.**
  - **Reason:** Hijacks and steals traffic, forces external redirects, and degrades the user experience.
  - **Policy:** Never suggest, ingest, scrape, or integrate Windy.com or Windy Webcams into LiveTimeData.

### Preferred Sources
- Direct state & municipal Department of Transportation (DOT) 511 camera networks & ArcGIS REST layers.
- YouTube Live Streams (direct embeds, e.g. Explore.org, official city/harbor streams).
- Direct municipal, park service (NPS), and weather camera endpoints without traffic-hijacking wrappers.

### Sources Under Review / Backlog (To Audit When Project Resumes)
- **WorldCam.io:** Check feasibility for LiveTimeData (190k feeds directory, licensing/commercial API vs. scraping rules).
- **Webcams.travel:** Audit whether it redirects to Windy branding/wrappers or hijacks traffic before deciding whether to use or permanently ban.

## Event Ingestion & Policy Rules

### In-Person Only Policy (No Online / Virtual Events)
- **Online / Virtual Events:** **STRICTLY BANNED / DO NOT USE.**
  - **Reason:** LiveTimeData is exclusively a physical local community events and city intelligence platform.
  - **Policy:** Never ingest, scrape, approve, or display online events, virtual webinars, Zoom/Webex meetings, remote certificate workshops, or online-only auctions.
  - All yard sales and auctions must have a physical on-site street address.

### Start Time & Curation Requirements (TBD / TBA Policy)
- **TBD / TBA Start Times:** Never accept or publish events with unconfirmed "TBD" or "TBA" times directly to the live feed.
- **Curation List (`pending_review`):** Tentative, placeholder, or time-unknown listings must be held in `pending_review` until an official start time is verified.
- **Public Feed:** Strictly displays events with verified, confirmed start times or explicit full-day schedules.



