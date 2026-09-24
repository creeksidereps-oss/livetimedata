"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Calendar, CloudSun, Camera, Video, PlusCircle, Sparkles, Image, Tv } from "lucide-react";

export default function SectionNavRibbon() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollTo = (targetId: string, isPhotoReel: boolean = false) => {
    setDropdownOpen(false);

    let resolvedId = targetId;

    // 1. Photo Reel Routing:
    // On mobile (< 1024px), scroll to the Fun Facts section placed just above Photo Reel.
    // On desktop/tablet, scroll directly to Photo Reel.
    if (isPhotoReel) {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        resolvedId = "fun-facts-mobile";
      } else {
        resolvedId = "photo-reel-section";
      }
    }

    // 2. Webcams Routing:
    // While main-feed webcam rows are temporarily hidden, scroll to Right Rail webcams
    if (targetId === "webcams-section") {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        resolvedId = "webcams-mobile";
      } else {
        resolvedId = "webcams-desktop";
      }
    }

    const element = document.getElementById(resolvedId);
    if (element) {
      const headerOffset = 115;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const handleOpenForm = (modalDetail: string) => {
    setDropdownOpen(false);
    window.dispatchEvent(new CustomEvent("openModal", { detail: modalDetail }));
  };

  return (
    <nav className="w-full flex items-center justify-between gap-2 py-1 relative">
      {/* Scrollable Navigation Pills on mobile / flex on desktop */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0">
        {/* Events */}
        <button
          type="button"
          onClick={() => scrollTo("events-section")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs whitespace-nowrap border border-slate-700/60 shrink-0"
        >
          <Calendar size={13} className="text-amber-400" />
          <span>Events</span>
        </button>

        {/* Weather */}
        <button
          type="button"
          onClick={() => scrollTo("clock-section")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs whitespace-nowrap border border-slate-700/60 shrink-0"
        >
          <CloudSun size={13} className="text-amber-400" />
          <span>Weather</span>
        </button>

        {/* Photo Reel */}
        <button
          type="button"
          onClick={() => scrollTo("photo-reel-section", true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs whitespace-nowrap border border-slate-700/60 shrink-0"
        >
          <Camera size={13} className="text-amber-400" />
          <span>Photo Reel</span>
        </button>

        {/* Webcams */}
        <button
          type="button"
          onClick={() => scrollTo("webcams-section")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs whitespace-nowrap border border-slate-700/60 shrink-0"
        >
          <Video size={13} className="text-amber-400" />
          <span>Webcams</span>
        </button>
      </div>

      {/* Submissions Dropdown - Positioned OUTSIDE overflow-x-auto so dropdown is NEVER clipped */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm whitespace-nowrap border border-blue-500"
        >
          <PlusCircle size={13} className="text-white" />
          <span>Submissions</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div 
            className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-[99999] animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ filter: "drop-shadow(0 20px 25px rgba(0, 0, 0, 0.25))" }}
          >
            <div className="px-3.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
              Community Submissions
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenForm("submit_event");
              }}
              className="w-full text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Calendar size={14} className="text-blue-500 shrink-0" />
              <span>Submit Event</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenForm("share_insights");
              }}
              className="w-full text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-800 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-500 shrink-0" />
              <span>Share Insights / Fun Fact</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenForm("submit_photo");
              }}
              className="w-full text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-800 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Image size={14} className="text-purple-500 shrink-0" />
              <span>Submit Photo</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenForm("submit_webcam");
              }}
              className="w-full text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Tv size={14} className="text-emerald-500 shrink-0" />
              <span>Submit Webcam</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}