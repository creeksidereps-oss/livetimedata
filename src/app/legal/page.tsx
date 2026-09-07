import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 bg-black min-h-screen text-slate-300">
      <Link href="/" className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors mb-8">
        <ArrowLeft size={14} className="mr-2" />
        Back to Home
      </Link>
      
      <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">LiveTimeData Legal & Disclaimers</h1>
      
      <div className="mt-8 space-y-5 text-[12px] md:text-[13px] leading-relaxed">
        <p className="font-bold text-slate-400">Effective Date: August 29, 2026</p>
        <p>LiveTimeData is designed to help users discover, explore, and learn about cities and places around the world.</p>
        <p>Information provided through LiveTimeData is for general informational, educational, planning, entertainment, and discovery purposes.</p>
        <p>These disclaimers supplement the LiveTimeData Terms of Service, Privacy Policy, Submission Terms, and Copyright & Content Removal Policy.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">1. GENERAL INFORMATION DISCLAIMER</h3>
        <p>LiveTimeData may display, organize, generate, compile, summarize, or otherwise provide information originating from LiveTimeData, third parties, contributors, organizations, businesses, public sources, automated systems, artificial intelligence, editorial processes, or combinations of these sources.</p>
        <p>Information may be:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>incomplete;</li>
          <li>inaccurate;</li>
          <li>outdated;</li>
          <li>delayed;</li>
          <li>estimated;</li>
          <li>approximate;</li>
          <li>automatically generated;</li>
          <li>incorrectly categorized;</li>
          <li>based on incomplete source material;</li>
          <li>unavailable;</li>
          <li>changed without notice.</li>
        </ul>
        <p>LiveTimeData does not guarantee that information appearing through the Service is complete, current, error-free, verified, official, or suitable for any particular purpose.</p>
        <p>When information matters to health, safety, travel, money, legal rights, deadlines, purchases, transportation, reservations, admission, or another consequential decision, users should independently verify the information with an appropriate authoritative source.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">2. AI-ASSISTED AND AUTOMATED CONTENT</h3>
        <p>Some LiveTimeData content may be generated, seeded, compiled, summarized, categorized, edited, translated, moderated, organized, analyzed, or otherwise assisted by artificial intelligence or other automated systems.</p>
        <p>LiveTimeData may use automated systems to help create broad informational coverage.</p>
        <p>Automated or AI-assisted material may later be supplemented, revised, corrected, expanded, or replaced using human-supplied reports, contributor information, research, editorial review, or additional sources.</p>
        <p>Artificial intelligence and automated systems can produce incorrect information, omit important information, misunderstand source material, make incorrect associations, or generate information that appears plausible but is not accurate.</p>
        <p>The appearance of information on LiveTimeData does not mean that it has been independently verified by a human.</p>
        <p>LiveTimeData does not guarantee the factual accuracy of AI-assisted or automatically processed information.</p>
        <p>LiveTimeData may revise, replace, supplement, correct, reorganize, or remove such content at any time.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">3. TIME, DATE, AND TIME-ZONE INFORMATION</h3>
        <p>Time, date, and time-zone information may depend on geographic information, time-zone databases, governmental decisions, daylight-saving rules, software, network conditions, browser or device settings, third-party information, and other technical factors.</p>
        <p>Time-zone boundaries and daylight-saving practices can change.</p>
        <p>LiveTimeData does not guarantee:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>atomic-clock accuracy;</li>
          <li>second-by-second precision;</li>
          <li>perfect synchronization;</li>
          <li>correct device-clock information;</li>
          <li>perfect daylight-saving treatment;</li>
          <li>legally authoritative time;</li>
          <li>uninterrupted availability of time information.</li>
        </ul>
        <p>Do not rely on LiveTimeData as the sole source for legal filing deadlines, transportation departures, financial transactions, medical schedules, examinations, appointments, business deadlines, broadcasts, or other consequential time-sensitive matters.</p>
        <p>Confirm important times and deadlines with the appropriate authoritative source.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">4. WEATHER AND FORECAST INFORMATION</h3>
        <p>Weather observations, current conditions, forecasts, temperatures, precipitation information, wind information, humidity information, icons, alerts, and other weather-related information are provided for general informational purposes.</p>
        <p>Weather conditions can change rapidly.</p>
        <p>Weather observations and forecasts may be delayed, estimated, modeled, geographically approximate, incomplete, unavailable, or inaccurate.</p>
        <p>Forecasts describe possible future conditions and are not guarantees.</p>
        <p>LiveTimeData is not an emergency weather service and does not provide professional meteorological, aviation, marine, emergency-management, or safety advice.</p>
        <p>For severe weather, storms, flooding, wildfire conditions, aviation, marine activity, outdoor safety, agriculture, emergencies, evacuations, or other safety-sensitive decisions, consult appropriate governmental, meteorological, emergency-management, or local authorities and evaluate actual local conditions.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">5. MAPS, COORDINATES, GEOGRAPHIC INFORMATION, AND LOCATION</h3>
        <p>Maps, coordinates, boundaries, city names, administrative regions, distances, directions, geographic classifications, and nearby-location information may be approximate, incomplete, outdated, or incorrect.</p>
        <p>Cities and places with identical or similar names may be confused.</p>
        <p>Coordinates displayed for a city may represent a city center, administrative point, approximate geographic point, or another representative location rather than an exact destination.</p>
        <p>Administrative boundaries and geographic classifications can change or vary among sources.</p>
        <p>A label such as "local," "nearby," "popular nearby," or similar wording does not guarantee that an item is within a particular municipal boundary, driving distance, walking distance, travel time, or geographic radius unless LiveTimeData expressly states a particular measurement.</p>
        <p>Users are responsible for confirming that they selected the intended city or location and for verifying geographic information when accuracy matters.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">6. CURRENCY AND EXCHANGE-RATE INFORMATION</h3>
        <p>Currency conversions, exchange rates, calculations, and related financial information displayed by LiveTimeData are provided for general informational purposes only.</p>
        <p>Displayed rates may be:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>delayed;</li>
          <li>estimated;</li>
          <li>rounded;</li>
          <li>indicative;</li>
          <li>incomplete;</li>
          <li>unavailable;</li>
          <li>different from actual transaction rates.</li>
        </ul>
        <p>Banks, payment networks, card issuers, currency exchanges, merchants, financial institutions, and other providers may use different exchange rates and may charge additional fees or commissions.</p>
        <p>LiveTimeData does not guarantee that any displayed exchange rate will be available for an actual transaction.</p>
        <p>Nothing displayed by LiveTimeData constitutes financial, investment, banking, accounting, tax, currency-trading, or other professional advice.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">7. EVENTS, CALENDARS, TICKETS, AND SCHEDULES</h3>
        <p>Event information is provided for discovery and informational purposes.</p>
        <p>Event information may originate from event organizers, venues, ticket sellers, contributors, third-party sources, public information, automated systems, or other sources.</p>
        <p>LiveTimeData does not guarantee that:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>every event occurring in a city or area is listed;</li>
          <li>an empty date means that no real-world events exist;</li>
          <li>an event listing has been independently verified;</li>
          <li>a listed event will actually occur;</li>
          <li>an event will occur at the displayed date or time;</li>
          <li>a displayed venue is correct;</li>
          <li>performers or participants will appear;</li>
          <li>prices are current;</li>
          <li>admission requirements are correct;</li>
          <li>tickets will remain available;</li>
          <li>seating will remain available;</li>
          <li>reservations will be accepted;</li>
          <li>vendor or exhibitor spaces will remain available;</li>
          <li>an event is suitable for a particular person;</li>
          <li>an organizer, promoter, venue, ticket seller, or other participant is legitimate or reliable.</li>
        </ul>
        <p>Events may be canceled, postponed, moved, rescheduled, modified, sold out, or otherwise changed without notice.</p>
        <p>Before traveling, purchasing tickets, making reservations, arranging accommodations, or otherwise relying on an event listing, confirm important information directly with the organizer, venue, ticket seller, or other authoritative source.</p>
        <p>Event categories are provided for convenience.</p>
        <p>A category such as "Family," "Kids," "Festivals," "Sports," "Concerts," or similar classification is not a guarantee of suitability, safety, accessibility, quality, content, age appropriateness, or availability.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">8. WEBCAMS, VIDEO, IMAGES, AND LIVE OR RECENT MEDIA</h3>
        <p>LiveTimeData may display, embed, link to, organize, or reference webcams, streams, refreshed images, snapshots, photographs, video, or other media.</p>
        <p>Some media may be supplied, hosted, operated, transmitted, or controlled by third parties.</p>
        <p>A label such as "Live," "Live Cam," "Webcam," or similar wording may refer to a live stream, periodically refreshed image, recent snapshot, or other camera feed.</p>
        <p>Such wording does not guarantee zero delay, continuous transmission, uninterrupted operation, or exact real-time imagery.</p>
        <p>A camera or feed may be:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>delayed;</li>
          <li>cached;</li>
          <li>frozen;</li>
          <li>temporarily unavailable;</li>
          <li>permanently offline;</li>
          <li>redirected;</li>
          <li>moved;</li>
          <li>mislabeled;</li>
          <li>obstructed;</li>
          <li>incorrectly located;</li>
          <li>displaying older imagery;</li>
          <li>changed by its operator without notice.</li>
        </ul>
        <p>LiveTimeData may not control what unexpectedly appears in a third-party camera feed.</p>
        <p>LiveTimeData does not guarantee that a webcam is continuously monitored, safe, appropriate, accurate, representative of current conditions, or available at any particular time.</p>
        <p>Webcam imagery should not be relied upon as official traffic, aviation, marine, weather, emergency, security, road-condition, or public-safety information.</p>
        <p>If you own, operate, control, appear in, or otherwise have a legitimate rights concern involving media displayed or referenced through LiveTimeData, contact:</p>
        <p className="font-bold">LiveTimeData@gmail.com</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">9. PHOTOGRAPHS AND OTHER IMAGES</h3>
        <p>Photographs and images displayed through LiveTimeData may originate from LiveTimeData, contributors, organizations, third parties, licensed sources, public sources, or other authorized sources.</p>
        <p>A photograph may not depict current conditions.</p>
        <p>Images may have been taken at an earlier date, cropped, resized, optimized, edited, enhanced, reformatted, or otherwise prepared for display.</p>
        <p>The presence of an image does not necessarily mean LiveTimeData owns the original copyright.</p>
        <p>Third-party photographs and images remain subject to the rights of their respective owners.</p>
        <p>If you believe an image violates your copyright, privacy, publicity, or other legal rights, review the LiveTimeData Copyright & Content Removal Policy or contact:</p>
        <p className="font-bold">LiveTimeData@gmail.com</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">10. ATTRACTIONS, RESTAURANTS, BUSINESSES, AND LOCAL PLACES</h3>
        <p>LiveTimeData may provide information concerning attractions, restaurants, businesses, venues, museums, parks, landmarks, entertainment, shopping, lodging, transportation, services, and other local places.</p>
        <p>This information may change frequently.</p>
        <p>LiveTimeData does not guarantee:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>that a business or attraction is currently operating;</li>
          <li>that operating hours are correct;</li>
          <li>that an address is correct;</li>
          <li>that admission is available;</li>
          <li>that reservations are available;</li>
          <li>that displayed prices are current;</li>
          <li>that menus or services are current;</li>
          <li>that a location is accessible to every visitor;</li>
          <li>that a business provides a particular product or service;</li>
          <li>that an attraction or business will meet a user's expectations;</li>
          <li>that a listed location is safe;</li>
          <li>that a listing constitutes endorsement.</li>
        </ul>
        <p>Businesses may close, relocate, change ownership, change hours, modify prices, discontinue services, or otherwise change without notice.</p>
        <p>Confirm important information directly with the applicable business, attraction, venue, transportation provider, or other authoritative source before making plans.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">11. RECOMMENDATIONS, POPULAR LOCATIONS, RANKINGS, AND FEATURED CONTENT</h3>
        <p>LiveTimeData may identify locations, events, attractions, businesses, views, photographs, webcams, or other information using descriptions such as:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>popular;</li>
          <li>featured;</li>
          <li>recommended;</li>
          <li>iconic;</li>
          <li>notable;</li>
          <li>nearby;</li>
          <li>hidden gem;</li>
          <li>top;</li>
          <li>favorite;</li>
          <li>must-see;</li>
          <li>similar descriptive terminology.</li>
        </ul>
        <p>These descriptions may reflect editorial judgment, third-party information, contributor suggestions, popularity information, automated processing, commercial arrangements where appropriately disclosed, or combinations of these factors.</p>
        <p>Such descriptions do not guarantee quality, safety, suitability, popularity, availability, accessibility, value, or user satisfaction.</p>
        <p>They should not be interpreted as professional advice, certification, or an official ranking unless expressly identified as such.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">12. SAFETY, CRIME, NEIGHBORHOODS, AND LOCAL CONDITIONS</h3>
        <p>LiveTimeData may provide or reference general information concerning safety, crime, neighborhoods, transportation, local conditions, or travel considerations.</p>
        <p>Safety conditions can vary significantly by neighborhood, location, time of day, season, current events, and individual circumstances.</p>
        <p>Crime statistics and safety information can vary according to reporting practices, geographic boundaries, methodology, source, and reporting period.</p>
        <p>LiveTimeData does not guarantee that any city, neighborhood, business, event, attraction, route, accommodation, transportation service, or other location is safe.</p>
        <p>Do not use LiveTimeData as a substitute for emergency services, law-enforcement information, governmental travel advisories, professional security advice, or reasonable personal judgment.</p>
        <p>In an emergency, contact the appropriate local emergency authority.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">13. HISTORICAL INFORMATION, FACTS, STORIES, MYTHS, AND LEGENDS</h3>
        <p>LiveTimeData may display historical information, facts, local stories, community knowledge, folklore, myths, legends, anecdotes, traditions, and contributor-supplied material.</p>
        <p>Historical accounts and community stories may differ among sources.</p>
        <p>Some information may be disputed, subjective, anecdotal, incomplete, difficult to verify, or based on tradition rather than established historical evidence.</p>
        <p>LiveTimeData may identify material as folklore, myth, legend, tradition, anecdote, opinion, or unverified information where appropriate.</p>
        <p>Publication of a statement does not establish that a disputed statement is true.</p>
        <p>If you identify a factual error or believe information should be corrected, contact LiveTimeData.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">14. AWARDS, RECOGNITIONS, AND THIRD-PARTY RANKINGS</h3>
        <p>LiveTimeData may reference awards, rankings, recognitions, certifications, designations, or similar information concerning cities, attractions, organizations, businesses, or other subjects.</p>
        <p>Such information may have been issued by independent third parties.</p>
        <p>Where practical, LiveTimeData may identify the organization, publication, year, or context associated with a recognition.</p>
        <p>Reference to an award, ranking, publication, organization, trademark, or designation does not imply that the applicable third party sponsors, endorses, or is affiliated with LiveTimeData.</p>
        <p>Awards and rankings may become outdated or may be based on subjective criteria.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">15. BUSINESS, ECONOMIC, PROPERTY, AND INVESTMENT INFORMATION</h3>
        <p>LiveTimeData may provide general information concerning local economies, businesses, industries, employment, population, demographics, development, property, investment conditions, or similar subjects.</p>
        <p>Such information is informational only.</p>
        <p>Nothing on LiveTimeData constitutes:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>investment advice;</li>
          <li>financial advice;</li>
          <li>legal advice;</li>
          <li>tax advice;</li>
          <li>accounting advice;</li>
          <li>real-estate advice;</li>
          <li>business consulting;</li>
          <li>due-diligence advice;</li>
          <li>a recommendation to buy, sell, invest, relocate, or enter into a transaction.</li>
        </ul>
        <p>Users should consult appropriately qualified professionals and authoritative sources before making consequential business, financial, property, legal, tax, or investment decisions.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">16. TRANSPORTATION, AIRPORTS, TRAFFIC, AND TRAVEL INFORMATION</h3>
        <p>LiveTimeData may display or reference airports, transportation services, traffic information, roads, transit, travel conditions, distances, or other transportation-related information.</p>
        <p>This information may be delayed, incomplete, estimated, or unavailable.</p>
        <p>LiveTimeData does not provide official aviation, traffic-control, navigation, road-safety, or transportation-operational information.</p>
        <p>Do not rely on LiveTimeData as the sole source for:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>flight operations;</li>
          <li>departure or arrival times;</li>
          <li>road closures;</li>
          <li>navigation;</li>
          <li>emergency routes;</li>
          <li>traffic safety;</li>
          <li>transit schedules;</li>
          <li>transportation deadlines;</li>
          <li>other safety-critical travel decisions.</li>
        </ul>
        <p>Verify consequential transportation information with the applicable transportation provider, airport, government agency, carrier, or other authoritative source.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">17. THIRD-PARTY LINKS, EMBEDS, SERVICES, AND TRANSACTIONS</h3>
        <p>LiveTimeData may contain links to or embeds from third-party websites and services.</p>
        <p>These may include businesses, event organizers, ticket sellers, webcam operators, mapping services, media services, advertisers, merchants, travel providers, attractions, restaurants, or other third parties.</p>
        <p>LiveTimeData does not control independent third-party:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>content;</li>
          <li>security;</li>
          <li>privacy practices;</li>
          <li>prices;</li>
          <li>products;</li>
          <li>services;</li>
          <li>availability;</li>
          <li>transactions;</li>
          <li>refunds;</li>
          <li>fulfillment;</li>
          <li>representations;</li>
          <li>terms and conditions.</li>
        </ul>
        <p>A link, listing, embed, mention, photograph, map, event listing, advertisement, or reference does not necessarily constitute endorsement, sponsorship, certification, partnership, or affiliation.</p>
        <p>Users interact with independent third parties at their own discretion and subject to the third party's applicable terms and policies.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">18. ADVERTISING, AFFILIATE, AND SPONSORED CONTENT</h3>
        <p>LiveTimeData may earn revenue from:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>advertisements;</li>
          <li>sponsorships;</li>
          <li>affiliate relationships;</li>
          <li>referrals;</li>
          <li>promoted placements;</li>
          <li>partnerships;</li>
          <li>other commercial arrangements.</li>
        </ul>
        <p>Where required, LiveTimeData will appropriately identify sponsored, paid, promotional, or affiliate relationships.</p>
        <p>Advertising appearing near editorial or informational content does not mean that an advertiser created, approved, or influenced that content unless expressly disclosed.</p>
        <p>Likewise, the presence of an advertisement does not constitute a LiveTimeData guarantee or endorsement of the advertiser's claims, products, services, prices, security, or fulfillment.</p>
        <p>Users should independently evaluate third-party offers before entering transactions.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">19. USER AND CONTRIBUTOR SUBMISSIONS</h3>
        <p>LiveTimeData may receive information and materials from users, contributors, organizations, businesses, event organizers, photographers, webcam owners or operators, students, educators, community members, and other sources.</p>
        <p>LiveTimeData does not guarantee that submitted information is accurate, complete, lawful, original, current, or reliable.</p>
        <p>Submission review, moderation, automated screening, or publication does not constitute a guarantee that LiveTimeData has independently verified every fact, right, permission, or claim.</p>
        <p>LiveTimeData may correct, edit, summarize, combine, restrict, replace, or remove submitted information.</p>
        <p>Additional rules governing submitted material are contained in the LiveTimeData Submission Terms.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">20. CONTENT CORRECTIONS AND CHANGES</h3>
        <p>LiveTimeData is an evolving information service.</p>
        <p>Information may be corrected, updated, expanded, reorganized, replaced, or removed as new or better information becomes available.</p>
        <p>A previous version of a page or statement should not be assumed to remain LiveTimeData's current position.</p>
        <p>If you believe information is inaccurate or outdated, you may contact:</p>
        <p className="font-bold">LiveTimeData@gmail.com</p>
        <p>Please identify the relevant page and the information you believe should be reviewed.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">21. NO PROFESSIONAL RELATIONSHIP</h3>
        <p>Use of LiveTimeData does not create an attorney-client, doctor-patient, financial-adviser, fiduciary, professional-consultant, travel-agent, broker, employment, agency, or other professional relationship.</p>
        <p>Information provided through LiveTimeData should not be treated as a substitute for professional advice where professional advice is appropriate.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">22. THIRD-PARTY AVAILABILITY AND TECHNICAL FAILURES</h3>
        <p>LiveTimeData depends in part on third-party infrastructure, data, media, advertising, communications, and other services.</p>
        <p>Third-party services may experience:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>outages;</li>
          <li>delays;</li>
          <li>rate limits;</li>
          <li>maintenance;</li>
          <li>errors;</li>
          <li>data changes;</li>
          <li>discontinued services;</li>
          <li>changed terms;</li>
          <li>unavailable content;</li>
          <li>technical failures.</li>
        </ul>
        <p>LiveTimeData does not guarantee the uninterrupted availability of third-party information or functionality.</p>
        <p>We may replace, change, suspend, or discontinue a provider, feature, data source, feed, embed, or other component at any time.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">23. NO GUARANTEE OF CONTINUOUS SERVICE</h3>
        <p>LiveTimeData itself may experience outages, maintenance, errors, interruptions, delays, security incidents, software problems, or other technical issues.</p>
        <p>We do not guarantee uninterrupted or error-free access.</p>
        <p>Features, content, categories, pages, interfaces, and functionality may be changed, replaced, suspended, or discontinued at any time.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">24. MOBILE DEVICES AND FUTURE APPLICATIONS</h3>
        <p>LiveTimeData may be accessed through desktop computers, mobile phones, tablets, and other compatible devices.</p>
        <p>Performance, layout, accuracy, permissions, availability, and functionality may vary by browser, device, network, or operating system.</p>
        <p>If LiveTimeData later provides a native mobile application or another platform requiring additional permissions or disclosures, additional terms or policies may apply.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">25. ACCESSIBILITY</h3>
        <p>LiveTimeData aims to make its website usable by as many people as reasonably possible, including people who use assistive technologies.</p>
        <p>We continue to improve accessibility as LiveTimeData evolves.</p>
        <p>LiveTimeData does not represent or guarantee that every page, third-party embed, third-party content item, or feature will meet every accessibility standard at all times.</p>
        <p>If you experience difficulty accessing any part of LiveTimeData, please contact us and describe the page, feature, or issue so that we can review it.</p>
        <p>Accessibility contact:</p>
        <p className="font-bold">LiveTimeData@gmail.com</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">26. NO GUARANTEE CREATED BY CORRECTION OR REVIEW</h3>
        <p>LiveTimeData may review, edit, correct, moderate, or update information.</p>
        <p>The fact that some information has been reviewed or corrected does not mean that every other item on the Service has been reviewed or verified.</p>
        <p>Unless LiveTimeData expressly states otherwise, words such as "reviewed," "updated," or similar editorial descriptions should not be interpreted as a warranty or guarantee of complete accuracy.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">27. LIMITATION OF RELIANCE</h3>
        <p>LiveTimeData is intended to assist with general discovery and information.</p>
        <p>Users remain responsible for evaluating information and determining whether additional verification is appropriate.</p>
        <p>LiveTimeData should not be the sole basis for decisions involving significant financial loss, personal safety, legal rights, medical matters, emergency situations, travel deadlines, transportation safety, investment decisions, property transactions, or other consequential matters.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">28. CHANGES TO THESE DISCLAIMERS</h3>
        <p>LiveTimeData may update these Legal & Disclaimers as the Service, features, information categories, technology, laws, or business practices evolve.</p>
        <p>The Effective Date at the beginning of this document identifies the current version.</p>

        <h3 className="text-[14px] md:text-[15px] font-bold text-white uppercase tracking-wider mt-10 mb-2">29. CONTACT</h3>
        <p>For questions, corrections, accessibility concerns, or general issues concerning information displayed through LiveTimeData:</p>
        <p className="font-bold">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States<br /><br />Email: LiveTimeData@gmail.com</p>
        <p>Copyright, media-rights, and formal content-removal concerns should also be reviewed under the LiveTimeData Copyright & Content Removal Policy.</p>
      </div>
    </div>
  );
}
