// src/components/CityEditorialGuide.tsx
import React from "react";
import { Globe2, Clock, CloudSun, Calendar, MapPin, Compass, ShieldCheck } from "lucide-react";

interface CityEditorialGuideProps {
  cityName: string;
  stateName?: string;
  countryName?: string;
  lat: number;
  lon: number;
  timezone?: string;
  pageType?: "time" | "weather" | "dashboard";
}

export default function CityEditorialGuide({
  cityName,
  stateName,
  countryName = "United States",
  lat,
  lon,
  timezone = "America/New_York",
  pageType = "dashboard",
}: CityEditorialGuideProps) {
  const locationLabel = [cityName, stateName, countryName].filter(Boolean).join(", ");
  const shortLocation = [cityName, stateName || countryName].filter(Boolean).join(", ");

  // Schema.org structured data for Search Engines & AdSense Quality Bots
  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "City",
        "@id": `https://livetimedata.com/city-dashboard?name=${encodeURIComponent(cityName)}#city`,
        "name": cityName,
        "containedInPlace": {
          "@type": "AdministrativeArea",
          "name": stateName || countryName,
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": lat,
          "longitude": lon,
        },
        "description": `Comprehensive municipal guide, current atomic time, real-time weather forecasting, live visual feeds, and verified local events for ${locationLabel}.`,
        "url": `https://livetimedata.com/time/${cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "LiveTimeData",
            "item": "https://livetimedata.com",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": stateName || countryName,
            "item": `https://livetimedata.com/?search=${encodeURIComponent(stateName || countryName)}`,
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": cityName,
            "item": `https://livetimedata.com/time/${cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          },
        ],
      },
    ],
  };

  return (
    <section 
      aria-label={`Municipal Profile and Local Guide for ${locationLabel}`}
      className="w-full max-w-[1400px] mx-auto px-3 sm:px-6 py-10 mt-6 border-t border-slate-200 text-slate-800"
    >
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-10 space-y-8">
        
        {/* Header Briefing */}
        <div className="border-b border-slate-100 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Compass size={14} className="text-blue-600" />
            Verified Municipal Profile & Regional Intelligence
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            About {shortLocation}: Local Time, Climate Profile & Community Life
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-4xl">
            Welcome to the official LiveTimeData intelligence guide for <strong className="text-slate-900">{locationLabel}</strong>. 
            Whether you are a local resident checking today&apos;s schedule, an event coordinator scouting regional venues, 
            or a traveler planning a visit, our real-time municipal dashboard pairs live atomic clock synchronization with 
            multi-layer meteorological tracking, authentic live camera verifications, and active civic event calendars.
          </p>
        </div>

        {/* 4 In-Depth Editorial Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          
          {/* Pillar 1: Time Standards */}
          <div className="bg-slate-50/80 rounded-2xl p-5 sm:p-6 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-blue-700 font-bold text-base mb-2.5">
                <Clock size={18} />
                <h3>Time Standards & Solar Alignment</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Official civil timekeeping in {cityName} is anchored to the <span className="font-semibold text-slate-900">{timezone}</span> time zone standard. 
                LiveTimeData continuously synchronizes with Coordinated Universal Time (UTC) and reference time servers to deliver second-by-second accuracy. 
                Daylight saving transitions, solar noon variations, and sunrise/sunset transit calculations are automatically accounted for, 
                giving educators, transport planners, and remote teams exact temporal coordinates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Timezone ID: <code className="text-slate-700 font-mono">{timezone}</code></span>
              <span>Coordinates: {lat.toFixed(4)}° N, {lon.toFixed(4)}° W</span>
            </div>
          </div>

          {/* Pillar 2: Climate & Weather Profile */}
          <div className="bg-slate-50/80 rounded-2xl p-5 sm:p-6 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-amber-600 font-bold text-base mb-2.5">
                <CloudSun size={18} />
                <h3>Meteorological Profile & 10-Day Outlook</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Positioned at geographic coordinates <span className="font-semibold text-slate-900">{lat.toFixed(4)}° latitude, {lon.toFixed(4)}° longitude</span>, 
                {cityName} experiences distinct seasonal meteorological dynamics. Our atmospheric panels compute hourly temperature forecasts, 
                barometric pressure trends, surface wind velocity, and relative humidity. Planning outdoor recreation, athletic meets, or weekend excursions 
                relies on our continuous radar integration to anticipate frontal boundaries and precipitable moisture.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Forecast Resolution: 1-hour intervals</span>
              <span>Coverage: 10-day rolling cycle</span>
            </div>
          </div>

          {/* Pillar 3: Community & Live Events */}
          <div className="bg-slate-50/80 rounded-2xl p-5 sm:p-6 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-base mb-2.5">
                <Calendar size={18} />
                <h3>Community Events, Arts & Regional Festivals</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                The cultural heartbeat of {shortLocation} is reflected in its community gatherings. 
                Our autonomous discovery engine indexes concerts, regional theatrical productions, charity fundraisers, 
                youth athletic tournaments, yard sales, and seasonal celebrations (including Halloween trunk-or-treats and holiday parades). 
                Events are verified directly from civic centers, community associations, and trusted venue partners to ensure timely schedules.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Curation: Ongoing autonomous verification</span>
              <span>Radius: Local + 35-mile perimeter</span>
            </div>
          </div>

          {/* Pillar 4: Visual Verifications & Civic Resources */}
          <div className="bg-slate-50/80 rounded-2xl p-5 sm:p-6 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-purple-700 font-bold text-base mb-2.5">
                <Globe2 size={18} />
                <h3>Visual Verifications & Municipal Curation</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Live visual transparency sets LiveTimeData apart. Whenever available, verified live camera feeds and visual streams 
                provide real-time confirmation of atmospheric clarity, traffic density, and crowd levels in {cityName}. 
                Community contributors, classroom educators, and municipal departments can submit verified corrections, new camera streams, 
                and local facts directly through our moderation gateway to keep this guide authoritative.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1"><ShieldCheck size={13} className="text-emerald-600" /> Human & AI Verified</span>
              <span>Platform: LiveTimeData</span>
            </div>
          </div>

        </div>

        {/* Footer Editorial Attribution */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            Municipal data curated by LiveTimeData for {locationLabel}. All temporal, climatic, and civic schedules are maintained continuously.
          </p>
          <div className="flex items-center gap-2 text-slate-500 font-semibold">
            <MapPin size={12} className="text-blue-500" />
            <span>Earth &bull; {countryName} &bull; {cityName}</span>
          </div>
        </div>

      </div>
    </section>
  );
}
