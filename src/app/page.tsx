import React from "react";
import HomeSearch from "@/components/HomeSearch";
import LocalClockBlock from "@/components/LocalClockBlock";
import CityGridCard from "@/components/CityGridCard";
import topCities from "@/data/top100cities.json";

export const runtime = "nodejs";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black flex flex-col selection:bg-pink-500/30">
      <div className="flex-1 flex flex-col items-center pt-6 pb-8 px-4">
        
        {/* Hero Top */}
        <div className="w-full max-w-4xl flex flex-col items-center text-center">
          {/* Brand Eyebrow */}
          <div className="inline-flex items-center px-5 py-2 rounded-full bg-white/5 border border-white/10 text-base font-semibold text-white/80 mb-3 shadow-sm tracking-wide">
            LiveTimeData.com
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Global Data
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-600">Real-Time.</span>
          </h1>
        </div>

        {/* Sticky Search Bar Container */}
        <div className="sticky top-0 z-[100] w-full bg-black/90 backdrop-blur-md py-3 px-2 flex justify-center border-b border-white/5 shadow-2xl transition-all">
          <div className="w-full max-w-3xl">
            <HomeSearch />
          </div>
        </div>

        {/* Geolocation Clock Block */}
        <div className="w-full max-w-4xl flex flex-col items-center text-center mt-4">
          <div className="w-full relative z-10 mb-4">
            <LocalClockBlock />
          </div>
        </div>

        {/* Popular Cities Grid Phase 4 */}
        <div className="w-full max-w-6xl mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
            {topCities.map((city, idx) => (
              <React.Fragment key={idx}>
                <CityGridCard city={city} />
                
                {/* Ad Placeholder every 3rd row (9th item) */}
                {(idx + 1) % 9 === 0 && (
                  <div className="col-span-full w-full h-[48px] bg-[#111] border border-white/10 rounded-2xl flex items-center justify-center relative overflow-hidden group my-2 shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_2s_infinite]" />
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">
                      Advertisement Space
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}