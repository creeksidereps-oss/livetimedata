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
      setSearchParams(sp);
      
      const cityName = (sp.name as string) || "Statesville";
      const stateName = (sp.admin1 as string) || "";
      const lat = parseFloat(sp.lat as string) || 35.7826;
      const lon = parseFloat(sp.lon as string) || -80.8873;

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
        });
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, lat, lng: lon, type: 'about' }),
        });
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, lat, lng: lon, type: 'facts' }),
        });
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, lat, lng: lon, type: 'on_this_day', timezone: (sp.timezone as string) }),
        });
        fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, countryName: (sp.country as string) || "United States", lat, lng: lon, type: 'holidays' }),
        });
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
    <div className="flex flex-col min-h-screen bg-[#f8fafc] w-full max-w-[100vw] overflow-x-hidden relative">
      <header className="sticky top-0 z-[100] w-full bg-white border-b border-gray-200 px-3 md:px-6 py-2.5 min-h-[64px] flex items-center">
        <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 w-full md:max-w-md relative z-[110]">
            <CitySearch />
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3 min-w-0">
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
              <button onClick={() => setActiveModal("about")} className="bg-slate-950 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer shadow-sm">About City</button>
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-[1400px] mx-auto w-full px-4 md:px-8 py-6 transition-all duration-500 ${(activeModal || improveOpen) ? 'blur-xl grayscale opacity-60 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_0.95fr] gap-8">
          <div className="flex flex-col gap-6 min-w-0">
            <CityClock 
              cityName={cityName} 
              timezone={searchParams.timezone as string} 
              countryCode={searchParams.country_code as string || "US"} 
              onOpenOnThisDay={() => setActiveModal("on_this_day")}
              onOpenHoliday={() => setActiveModal("holidays")}
            />
            
            <WeatherPanels key={tempUnit} current={weather?.current} daily={weather?.daily} unitPreference={tempUnit} onUnitChange={(u) => setTempUnit(u)} />
            <div className="w-full h-[45px] bg-slate-200 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">
              AdSense: Under Weather
            </div>
            {/* TEMPORARILY HIDDEN PER USER REQUEST
            <WebcamRows cityName={cityName} stateName={searchParams?.admin1 as string} countryName={searchParams?.country as string} />
            <div className="w-full h-[45px] bg-slate-200 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">
              AdSense: Under Webcams
            </div>
            */}

            <EventsBlock cityName={cityName} stateName={searchParams?.admin1} />
            <div className="w-full h-[45px] bg-slate-200 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">
              AdSense: Under Events Calendar
            </div>

            <PhotoReel cityName={cityName} />
            <div className="w-full h-[45px] bg-slate-200 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">
              AdSense: Under Photo Reel
            </div>

            {/* MOBILE ONLY: Right Rail placed directly under Photo Reel with Action Pill Buttons just above it */}
            <div className="block lg:hidden mt-2">
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
                  onClick={() => setActiveModal("about")} 
                  className="bg-slate-950 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer shadow-sm"
                >
                  About City
                </button>
              </div>

              <RightRail cityName={cityName} flagAtBottom={true} />
            </div>
          </div>
          <aside className="hidden lg:block min-w-0">
            <RightRail cityName={cityName} />
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