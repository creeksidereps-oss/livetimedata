"use client";

import React, { useState, useEffect } from "react";
import CityClock from "@/components/CityClock";
import WeatherPanels from "@/components/WeatherPanels";
import WebcamRows from "@/components/WebcamRows";
import EventsBlock from "@/components/EventsBlock";
import PhotoReel from "@/components/PhotoReel";
import RightRail from "@/components/RightRail";
import SectionNavRibbon from "@/components/SectionNavRibbon";
import CitySearch from "@/components/CitySearch";
import InfoModal from "@/components/modals/InfoModal";
import ImproveFormModal from "@/components/ImproveFormModal";
import { resolveCityFromSlug } from "@/lib/cityResolver";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/config/adSlots";
import CityNewsBlock from "@/components/CityNewsBlock";
import CityReportBlock from "@/components/CityReportBlock";
import FeaturedFactCard from "@/components/FeaturedFactCard";
import UserPreferencesPills from "@/components/UserPreferencesPills";

export default function Page(props: { 
  params: Promise<{ slug: string }>, 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const [searchParams, setSearchParams] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [improveOpen, setImproveOpen] = useState(false);
  const [tempUnit, setTempUnit] = useState<"f" | "c">("c");

  useEffect(() => {
    const handleOpenModal = (e: CustomEvent) => {
      if (e.detail === 'share_insights' || e.detail === 'submit_webcam') {
        setActiveModal(null);
        setImproveOpen(true);
      }
    };
    window.addEventListener('openModal', handleOpenModal as EventListener);
    return () => window.removeEventListener('openModal', handleOpenModal as EventListener);
  }, []);

  useEffect(() => {
    async function init() {
      const sp = await props.searchParams;
      const p = await props.params;
      const resolved = resolveCityFromSlug(p?.slug);
      const cityName = (sp?.name as string) || resolved.name;
      const stateName = sp?.admin1 !== undefined ? (sp.admin1 as string) : resolved.admin1;
      const country = (sp?.country as string) || resolved.country;
      const country_code = (sp?.country_code as string) || resolved.country_code;
      const lat = parseFloat(sp?.lat as string) || resolved.lat;
      const lon = parseFloat(sp?.lon as string) || resolved.lon;
      const timezone = (sp?.timezone as string) || resolved.timezone || "auto";

      setSearchParams({ 
        ...sp, 
        name: cityName, 
        admin1: stateName, 
        country, 
        country_code, 
        lat, 
        lon, 
        timezone 
      });

      // 1. Fetch Current Weather Forecast
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=10`);
      if (res.ok) setWeather(await res.json());

      // 2. Immediate Library Pre-Caching Runner
      // This silently warms up the Neon database cache or triggers the AI generation immediately upon search
      try {
        fetch('/api/admin/scraper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, lat, lng: lon }),
        }).catch(() => {});
        fetch('/api/admin/scraper/webcams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName }),
        }).catch(() => {});
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, lat, lng: lon, type: 'about' }),
        }).catch(() => {});
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, lat, lng: lon, type: 'facts' }),
        }).catch(() => {});
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, lat, lng: lon, type: 'on_this_day', timezone: (sp.timezone as string) }),
        }).catch(() => {});
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, countryName: (sp.country as string) || "United States", lat, lng: lon, type: 'holidays' }),
        }).catch(() => {});
      } catch (e) {
        console.error("Background pre-cache loop paused:", e);
      }
    }
    init();
  }, [props.searchParams]);

  if (!searchParams) return null;
  const cityName = (searchParams.name as string) || "Statesville";
  const lat = parseFloat(searchParams.lat as string) || 35.7826;
  const lon = parseFloat(searchParams.lon as string) || -80.8873;

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] w-full max-w-[100vw] overflow-x-clip relative">
      <header className="sticky top-0 z-[120] w-full bg-white border-b border-gray-200 shadow-xs">
        {/* Sticky Top Navigation Ribbon directly above City Search */}
        <div className="w-full bg-slate-950 text-white border-b border-slate-800 px-2 sm:px-4 md:px-6 py-1 sm:py-1.5 relative z-[130]">
          <div className="max-w-[1400px] mx-auto w-full">
            <SectionNavRibbon />
          </div>
        </div>

        {/* City Search Row */}
        <div className="px-3 md:px-6 py-2.5 min-h-[64px] flex items-center">
          <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 w-full md:max-w-md relative z-[110]">
              <CitySearch />
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3 min-w-0 flex-wrap sm:flex-nowrap">
              {/* User Preferences: Start Page & Favorites (placed beside search bar, directly left of city name) */}
              <UserPreferencesPills
                cityName={cityName}
                stateName={searchParams.admin1 as string}
                countryName={searchParams.country as string}
                countryCode={searchParams.country_code as string}
              />

              <div className="flex flex-col min-w-0">
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900 truncate">
                  {cityName}
                </h1>
                <div className="text-[10px] font-black uppercase text-slate-400 truncate">
                  <span className="text-blue-600 font-black">{searchParams.admin1} • {searchParams.country_code}</span> • {lat.toFixed(2)}°, {lon.toFixed(2)}°
                </div>
              </div>
              {/* Desktop-only action pill buttons in header */}
              <div className="hidden lg:flex gap-2 shrink-0">
                <button 
                  onClick={() => setImproveOpen(true)} 
                  className="bg-blue-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all cursor-pointer shadow-sm"
                >
                  Share insights
                </button>
                <button onClick={() => setActiveModal("facts")} className="bg-slate-950 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer shadow-sm">Fun Facts</button>
                <button 
                  onClick={() => {
                    const el = document.getElementById("community-guide");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else setActiveModal("about");
                  }} 
                  className="bg-slate-950 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer shadow-sm"
                >
                  About City
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-[1400px] mx-auto w-full px-4 md:px-8 py-6 transition-all duration-500 ${(activeModal || improveOpen) ? 'blur-xl grayscale opacity-60 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_0.95fr] gap-8 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <div id="clock-section">
              <CityClock 
                cityName={cityName} 
                timezone={searchParams.timezone as string} 
                countryCode={searchParams.country_code as string || "US"} 
                onOpenOnThisDay={() => setActiveModal("on_this_day")}
                onOpenHoliday={() => setActiveModal("holidays")}
              />
            </div>
            
            <div id="weather-section">
              <WeatherPanels key={tempUnit} current={weather?.current} daily={weather?.daily} unitPreference={tempUnit} onUnitChange={(u) => setTempUnit(u)} />
            </div>
            <AdSlot slot={AD_SLOTS.DASHBOARD_UNDER_WEATHER} />
            
            <CityNewsBlock cityName={cityName} stateName={searchParams?.admin1} countryName={searchParams?.country} />

            {/* TEMPORARILY HIDDEN PER USER REQUEST - USING RIGHT RAIL FOR NOW
            <div id="webcams-section">
              <WebcamRows cityName={cityName} stateName={searchParams?.admin1 as string} countryName={searchParams?.country as string} />
              <AdSlot slot={AD_SLOTS.DASHBOARD_UNDER_WEBCAMS} />
            </div>
            */}

            <div id="events-section">
              <div id="events">
                <EventsBlock cityName={cityName} stateName={searchParams?.admin1} countryCode={searchParams?.country_code as string} lat={lat} lon={lon} />
              </div>
            </div>
            <AdSlot slot={AD_SLOTS.DASHBOARD_UNDER_EVENTS} />

            {/* MOBILE ONLY: Fun Facts section positioned directly above Photo Reel so it doesn't get buried */}
            <div id="fun-facts-mobile" className="block lg:hidden mb-2">
              <FeaturedFactCard 
                cityName={cityName} 
                stateName={searchParams?.admin1} 
                countryName={searchParams?.country} 
              />
            </div>

            <div id="photo-reel-section">
              <PhotoReel cityName={cityName} />
            </div>
            <AdSlot slot={AD_SLOTS.DASHBOARD_UNDER_PHOTO_REEL} />

            <CityReportBlock 
              cityName={cityName} 
              stateName={searchParams?.admin1} 
              countryName={searchParams?.country} 
              lat={lat} 
              lng={lon} 
              timezone={searchParams?.timezone as string}
              onOpenInsights={() => setImproveOpen(true)}
            />

            {/* MOBILE ONLY: Right Rail placed directly under Photo Reel & Community Guide with Action Pill Buttons just above it */}
            <div id="webcams-mobile" className="block lg:hidden mt-2">
              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                <button 
                  onClick={() => setImproveOpen(true)} 
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all cursor-pointer shadow-sm"
                >
                  Share insights
                </button>
                <button 
                  onClick={() => setActiveModal("facts")} 
                  className="bg-slate-950 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer shadow-sm"
                >
                  Fun Facts
                </button>
                <button 
                  onClick={() => {
                    const el = document.getElementById("community-guide");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else setActiveModal("about");
                  }} 
                  className="bg-slate-950 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer shadow-sm"
                >
                  About City
                </button>
              </div>

              <RightRail cityName={cityName} stateName={searchParams?.admin1} countryName={searchParams?.country} flagAtBottom={true} />
            </div>
          </div>
          <aside id="webcams-desktop" className="hidden lg:block min-w-0">
            <RightRail cityName={cityName} stateName={searchParams?.admin1} countryName={searchParams?.country} />
          </aside>
        </div>
      </main>

      {activeModal && (
        <InfoModal 
          type={activeModal}
          cityName={cityName} 
          stateName={searchParams.admin1}
          countryName={(searchParams.country as string) || "United States"}
          timezone={searchParams.timezone as string}
          lat={lat} lng={lon}
          onClose={() => setActiveModal(null)}
          onOpenInsights={() => {
            setActiveModal(null);
            setImproveOpen(true);
          }}
          onOpenWebcam={() => {
            setActiveModal(null);
            setImproveOpen(true);
          }}
        />
      )}

      {improveOpen && (
        <ImproveFormModal 
          isOpen={improveOpen}
          onClose={() => setImproveOpen(false)}
          cityName={cityName}
          stateName={searchParams.admin1 || "N/A"}
          countryCode={searchParams.country_code || "US"}
          lat={lat}
          lng={lon}
        />
      )}
    </div>
  );
}