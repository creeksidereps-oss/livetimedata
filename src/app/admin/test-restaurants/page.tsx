"use client";

import React, { useState } from "react";
import RestaurantsBlock from "@/components/restaurants/RestaurantsBlock";
import { Utensils, MapPin, CloudSun, Calendar, Camera, ExternalLink, Sparkles, Clock, CheckCircle2 } from "lucide-react";

export default function TestRestaurantsPage() {
  const [selectedCity, setSelectedCity] = useState("Charlotte");
  const [isRestaurantsModalOpen, setIsRestaurantsModalOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {/* ======================================================== */}
      {/* 1. SANDBOX CONTROLS HEADER (Dev Toolbar)                 */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 py-2 px-4 shadow-md">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-orange-500/20 text-orange-400">
              <Utensils size={16} />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Restaurants Sandbox
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Modal Format Preview
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* City Selector */}
            <span className="text-xs text-slate-400 font-medium">City:</span>
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedCity("Charlotte")}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  selectedCity === "Charlotte"
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Charlotte
              </button>
              <button
                type="button"
                onClick={() => setSelectedCity("Statesville")}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  selectedCity === "Statesville"
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Statesville
              </button>
            </div>

            {/* Modal Open/Close Toggle Button */}
            <button
              type="button"
              onClick={() => setIsRestaurantsModalOpen(true)}
              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Utensils size={13} />
              <span>{isRestaurantsModalOpen ? "Modal Active" : "Open Restaurants Modal"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. SIMULATED MAIN CITY PAGE IN THE BACKGROUND            */}
      {/* This remains fully visible behind the modal overlay!      */}
      {/* ======================================================== */}
      <main className="max-w-[1200px] mx-auto px-4 py-8 space-y-6">
        {/* City Title Banner */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 relative overflow-hidden shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">
                <MapPin size={14} />
                <span>North Carolina, United States</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">
                {selectedCity}
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-xl">
                Current local time, 14-day weather forecast, live webcams, and upcoming events for {selectedCity}, NC.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 shrink-0 text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Local Time</div>
              <div className="text-2xl font-black text-white mt-0.5">2:48 PM</div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">EDT (UTC-4)</div>
            </div>
          </div>
        </div>

        {/* Section Navigation Ribbon Simulation */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs"
          >
            <Calendar size={13} className="text-amber-300" />
            <span>Events</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRestaurantsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer animate-pulse"
          >
            <Utensils size={13} className="text-yellow-200" />
            <span>Restaurants (Click to Open)</span>
          </button>

          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <CloudSun size={13} className="text-amber-400" />
            <span>Weather</span>
          </button>

          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Camera size={13} className="text-blue-400" />
            <span>Photo Reel</span>
          </button>
        </div>

        {/* Simulated Events Section */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Calendar size={16} className="text-blue-400" />
              <span>City Events {selectedCity.toUpperCase()}</span>
            </h3>
            <span className="text-xs text-slate-400">Calendar Feed Active</span>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
              <div>
                <span className="font-bold text-white">Charlotte Symphony: Beethoven Symphony No. 5</span>
                <div className="text-[11px] text-slate-400 mt-0.5">Belk Theater · 7:30 PM</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">Concerts</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
              <div>
                <span className="font-bold text-white">Carolina Barbecue & Blues Invitational</span>
                <div className="text-[11px] text-slate-400 mt-0.5">Romare Bearden Park · 12:00 PM</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Festivals</span>
            </div>
          </div>
        </div>

        {/* Simulated Weather & City Facts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <CloudSun size={14} className="text-amber-400" />
              <span>Weather Conditions</span>
            </h4>
            <div className="text-3xl font-black text-white">74°F</div>
            <p className="text-xs text-slate-400 mt-1">Partly Cloudy · Humidity 58% · Wind 6 mph</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <Sparkles size={14} className="text-yellow-400" />
              <span>Local Municipal Insights</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Known as the "Queen City", Charlotte was named in honor of German princess Charlotte of Mecklenburg-Strelitz.
            </p>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. SMALLER FORMAT RESTAURANTS MODAL OVERLAY (AS REQUESTED)                 */}
      {/* - Main city page is still viewable behind it                              */}
      {/* - Clicking on the backdrop exits back to where the user was               */}
      {/* - Circular (X) pill button in top-right corner exits back to list/city    */}
      {/* ========================================================================= */}
      {isRestaurantsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn"
          onClick={() => setIsRestaurantsModalOpen(false)}
        >
          {/* Modal Container: sized so the background city page is clearly visible! */}
          <div
            className="relative w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-3xl shadow-2xl my-auto transition-all"
            onClick={(e) => e.stopPropagation()} // Clicking inside the modal prevents closing
          >
            <RestaurantsBlock
              cityName={selectedCity}
              stateName="NC"
              countryCode="US"
              onClose={() => setIsRestaurantsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
