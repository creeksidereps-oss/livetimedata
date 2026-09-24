"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import HomeSearch from "@/components/HomeSearch";
import CityGridCard from "@/components/CityGridCard";
import ImproveFormModal from "@/components/ImproveFormModal";
import FooterModal from "@/components/modals/FooterModal";
import EventSubmissionModal from "@/components/modals/EventSubmissionModal";
import ModalCitySearch from "@/components/ModalCitySearch";
import topCities from "@/data/top100cities.json";
import { 
  Calendar, 
  Video, 
  Camera, 
  BookOpen, 
  GraduationCap, 
  Store, 
  Sparkles, 
  ArrowRight, 
  Globe2, 
  Clock, 
  Compass, 
  HeartHandshake, 
  Tag, 
  MapPin, 
  CheckCircle2, 
  Tv, 
  CloudSun, 
  X 
} from "lucide-react";

// Curated world capitals and destinations from top 100 cities (no local small cities)
const CURATED_WORLD_CITIES = topCities.slice(0, 12);

type ModalType = "time" | "weather" | "events" | "attractions" | "photos" | "webcams" | null;

export default function HomePage() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isImproveModalOpen, setIsImproveModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [redirectingToStart, setRedirectingToStart] = useState<string | null>(null);
  const [savedStartPage, setSavedStartPage] = useState<{ name: string; path: string } | null>(null);

  // Auto-redirect to user's saved start page (stored strictly in client localStorage)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem("ltd_start_page");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.path && typeof parsed.path === "string" && parsed.path.startsWith("/")) {
          setSavedStartPage(parsed);
          const params = new URLSearchParams(window.location.search);
          if (!params.has("home") && !params.has("explore")) {
            setRedirectingToStart(parsed.name || "your chosen city");
            window.location.replace(parsed.path);
          }
        }
      }
    } catch (e) {
      console.warn("Could not check start page preference:", e);
    }
  }, []);

  useEffect(() => {
    const handleOpenModal = (e: CustomEvent) => {
      if (e.detail === 'share_insights' || e.detail === 'submit_webcam') {
        setActiveModal(null);
        setIsContactModalOpen(false);
        setIsEventModalOpen(false);
        setIsImproveModalOpen(true);
      } else if (e.detail === 'submit_event') {
        setActiveModal(null);
        setIsContactModalOpen(false);
        setIsImproveModalOpen(false);
        setIsEventModalOpen(true);
      }
    };
    window.addEventListener('openModal', handleOpenModal as EventListener);
    return () => window.removeEventListener('openModal', handleOpenModal as EventListener);
  }, []);

  useEffect(() => {
    if (!activeModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  return (
    <main className="min-h-screen bg-[#060b18] text-white flex flex-col selection:bg-amber-400 selection:text-slate-950">
      
      {/* Start Page Redirect Notice */}
      {redirectingToStart && (
        <div className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 text-center text-xs font-black uppercase tracking-wider flex items-center justify-center gap-3 shadow-md z-[200]">
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-950 animate-ping" />
            Opening your saved Start Page ({redirectingToStart})...
          </span>
          <Link
            href="/?home=true"
            onClick={() => setRedirectingToStart(null)}
            className="underline text-[11px] font-black hover:text-slate-800 transition-colors ml-2 bg-slate-950/10 px-2 py-0.5 rounded-full"
          >
            Stay on Global Home
          </Link>
        </div>
      )}

      {/* 1. ABOVE-THE-FOLD SEARCH HEADER (Clean, bright, noticeable, with NO extra pill rows) */}
      <section className="w-full pt-4 md:pt-6 pb-4 px-4 bg-gradient-to-b from-[#030712] via-[#060b18] to-[#0a1128] border-b border-white/10">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 text-white text-[11px] md:text-xs font-black uppercase tracking-widest shadow-lg mb-3.5 border border-amber-400/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
            YOUR WINDOW TO EVERY HOMETOWN & WONDER ON EARTH
          </div>

          {/* Bright, Noticeable Search Bar - strictly Above the Fold */}
          <div className="w-full max-w-3xl">
            <HomeSearch />
          </div>

          {/* Quick Start Page jump shortcut if saved on this device */}
          {savedStartPage && (
            <div className="mt-2.5 flex items-center justify-center">
              <Link
                href={savedStartPage.path}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/90 hover:bg-amber-300 text-slate-950 text-[11px] font-black uppercase tracking-wider transition-all shadow-sm"
              >
                <span>🏠 Your Start Page: {savedStartPage.name}</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}

          {/* Welcoming Invitation Copy */}
          <div className="mt-3.5 text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl mx-auto space-y-0.5">
            <p>Search your hometown or city of your dreams. Want to visit a memory or create one?</p>
            <p>Work is sending you away? Don’t fret — take a look at where you are going right here.</p>
            <p className="text-slate-200">See live weather, find local events, and prepare for an amazing experience.</p>
          </div>

        </div>
      </section>

      {/* 2. THE PRISTINE ORIGINAL HEADER BANNER & CLEAN 6 FEATURE DISCOVERY BUTTONS */}
      <section className="max-w-6xl mx-auto w-full px-3 sm:px-6 pt-5 pb-4">
        
        {/* Pristine high-resolution original banner created a week ago (No overlays, no warped text) */}
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-slate-950">
          <img 
            src="/assets/LiveTimeData_Header.png" 
            alt="LiveTimeData - Local Information. Real Places. A More Connected World."
            className="w-full h-auto object-cover select-none block"
          />
        </div>

        {/* 6 High-Contrast Clean Feature Buttons (Dedicated row below the banner, opening modals cleanly) */}
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          
          <button
            type="button"
            onClick={() => setActiveModal("time")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-amber-400/80 shadow-md transition-all cursor-pointer group"
          >
            <Clock size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 group-hover:text-amber-300">Time</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("weather")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-amber-400/80 shadow-md transition-all cursor-pointer group"
          >
            <CloudSun size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 group-hover:text-amber-300">Weather</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("events")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-amber-400/80 shadow-md transition-all cursor-pointer group"
          >
            <Calendar size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 group-hover:text-amber-300">Events</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("attractions")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-amber-400/80 shadow-md transition-all cursor-pointer group"
          >
            <Compass size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 group-hover:text-amber-300">City Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("photos")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-amber-400/80 shadow-md transition-all cursor-pointer group"
          >
            <Camera size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 group-hover:text-amber-300">Photos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("webcams")}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-amber-400/80 shadow-md transition-all cursor-pointer group"
          >
            <Video size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200 group-hover:text-amber-300">Live Views</span>
          </button>

        </div>
      </section>

      {/* 3. FOR TEACHERS, STUDENTS & CLASSROOM PARTNERSHIPS (CENTERED) */}
      <section id="teachers" className="max-w-5xl mx-auto w-full px-4 py-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-950 text-white p-8 sm:p-12 border border-slate-800 shadow-2xl text-center">
          
          {/* Amber ambient glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
            
            {/* Centered Eyebrow */}
            <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest mb-4">
              <GraduationCap size={15} />
              Classroom & Community Partnership
            </div>

            {/* Centered Headline */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight text-center">
              Teachers: Make Reports Fun for Your Students!
            </h2>

            {/* Centered Subtitle */}
            <p className="mt-4 text-slate-300 font-medium text-sm sm:text-base leading-relaxed text-center max-w-2xl">
              We can publish student research and creative writing right here on LiveTimeData to share with readers worldwide, or help you hold a contest in your classroom to publish the best-in-class report on their featured city!
            </p>

            {/* Centered 3 Sub-Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 w-full">
              
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center flex flex-col items-center">
                <div className="font-black text-amber-400 text-sm uppercase tracking-wide flex items-center justify-center gap-2 mb-2">
                  <BookOpen size={16} />
                  Real-World Class Projects
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Engage students in real-world geography, writing, photography, and art centered around hometowns and world cities.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center flex flex-col items-center">
                <div className="font-black text-amber-400 text-sm uppercase tracking-wide flex items-center justify-center gap-2 mb-2">
                  <Calendar size={16} />
                  Promote School Events
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Promote school athletics, band & orchestra concerts, drama plays, and fundraisers to the local community to build attendance and parent participation.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center flex flex-col items-center">
                <div className="font-black text-amber-400 text-sm uppercase tracking-wide flex items-center justify-center gap-2 mb-2">
                  <Tag size={16} />
                  Booster & Club Sales
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Having a school band booster yard sale, church market, or student charity drive? Let us help get the word out.
                </p>
              </div>

            </div>

            {/* Centered Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 w-full">
              <button 
                type="button"
                onClick={() => setIsContactModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-full text-xs uppercase tracking-wider transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <HeartHandshake size={15} />
                Connect With Us for Class Projects
              </button>
              <button 
                type="button"
                onClick={() => setIsEventModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                Submit a School Event or Yard Sale
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 5. FOR LOCAL BUSINESSES & VENUE WEBCAMS */}
      <section className="max-w-5xl mx-auto w-full px-4 py-4">
        <div className="bg-slate-900/90 rounded-3xl border border-white/10 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <Store size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Have a Local Business or Scenic Spot in Your City?
              </h3>
              <p className="text-slate-300 font-medium text-sm mt-1 max-w-2xl leading-relaxed">
                Submit your public webcam or live feed so travelers, visitors, and locals can see your location and what it looks like before they arrive. Help your town shine!
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setIsImproveModalOpen(true)}
            className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-full text-xs uppercase tracking-wider transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
          >
            Submit Your Webcam <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* 6. FEATURED WORLD DESTINATIONS GRID (TOP GLOBAL CAPITALS) */}
      <section className="max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[10px] font-black uppercase tracking-widest border border-white/10 mb-2">
              <Clock size={12} />
              World Horizons
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Featured Global Capitals & Destinations
            </h2>
            <p className="text-slate-400 font-medium text-xs sm:text-sm mt-1">
              Select any city below for real-time clocks, 14-day forecasts, live webcams, and community stories.
            </p>
          </div>

          <div className="text-xs font-bold text-slate-400">
            Top global destinations
          </div>
        </div>

        {/* The Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CURATED_WORLD_CITIES.map((city, idx) => (
            <React.Fragment key={idx}>
              <CityGridCard city={city} variant="dark" />
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* 7. FEATURE MODALS (TIME, WEATHER, EVENTS, ATTRACTIONS, PHOTOS, LIVE VIEWS) */}
      {activeModal && (
        <div 
          className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="bg-slate-900 border border-white/20 shadow-2xl rounded-3xl max-w-lg w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200 relative text-white cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-all cursor-pointer"
              title="Close modal"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* MODAL: EVENTS */}
            {activeModal === "events" && (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Calendar size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                    Community Events & Yard Sales
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight mt-2">
                    Never Miss What’s Happening in Town
                  </h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Discover what is happening today, this weekend, and all month long in your town. Browse local festivals, farmer’s markets, live music concerts, high school athletics, band performances, and drama plays.
                </p>
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-400/30 text-xs font-semibold text-slate-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Tag size={14} className="text-amber-400" />
                    Mandatory Street Addresses on Yard Sales
                  </div>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed">
                    No guessing where sales are located. Every garage, estate, booster, and church yard sale requires a verified street address so you can plan your weekend stops with confidence.
                  </p>
                </div>
                <div className="pt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="bg-white/10 hover:bg-white/20 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                  >
                    BACK TO SITE
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setIsEventModalOpen(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Add Event
                  </button>
                </div>

                {/* City Search Box */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2">
                    Search City Events
                  </label>
                  <ModalCitySearch
                    onClose={() => setActiveModal(null)}
                    targetAnchor="#events"
                    placeholder="Search any city events (e.g. Austin, London, Chicago)..."
                    accentColor="amber"
                  />
                </div>
              </div>
            )}

            {/* MODAL: LIVE VIEWS / WEBCAMS */}
            {activeModal === "webcams" && (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
                  <Video size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                    Real-Time City Windows
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight mt-2">
                    Live City Lookouts & World Wildlife Streams
                  </h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Actually take a look inside cities to experience what is happening there right this very minute. Watch live streaming webcams of downtown centers, scenic mountain views, bustling harbors, and ocean coastlines.
                </p>
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-400/30 text-xs font-semibold text-slate-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-300">
                    <Tv size={14} className="text-blue-400" />
                    Animals Throughout the World & Usual Day Glimpses
                  </div>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed">
                    Watch live animal webcams across the globe—from brown bears in Alaska to African savannas. In cities where live feeds aren’t yet available, enjoy a curated glimpse into a typical day.
                  </p>
                </div>
                <div className="pt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="bg-white/10 hover:bg-white/20 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                  >
                    BACK TO SITE
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setIsImproveModalOpen(true);
                    }}
                    className="bg-blue-500 hover:bg-blue-400 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Submit a Webcam
                  </button>
                </div>

                {/* City Search Box */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-blue-300 uppercase tracking-wider mb-2">
                    Search City Webcams
                  </label>
                  <ModalCitySearch
                    onClose={() => setActiveModal(null)}
                    targetAnchor="#webcams"
                    placeholder="Search any city webcams (e.g. Paris, Tokyo, Miami)..."
                    accentColor="blue"
                  />
                </div>
              </div>
            )}

            {/* MODAL: PHOTOS */}
            {activeModal === "photos" && (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400">
                  <Camera size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-400/30">
                    Community Photo Reels
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight mt-2">
                    From Your Backyard to the World
                  </h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Experience cities through the eyes of real people who live there and travelers passing through. Browse authentic community photo reels capturing genuine neighborhood character.
                </p>
                <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-400/30 text-xs font-semibold text-slate-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-300">
                    <CheckCircle2 size={14} className="text-rose-400" />
                    Submit Your Own Photos
                  </div>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed">
                    Share pictures of anywhere you have visited or live—even your own backyard, local park, scenic walking trail, or your favorite neighborhood coffee shop.
                  </p>
                </div>
                {/* Search Box beside Submit Photo pill */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-rose-300 uppercase tracking-wider mb-2">
                    Search City Photo Reels
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="flex-1">
                      <ModalCitySearch
                        onClose={() => setActiveModal(null)}
                        targetAnchor="#photos"
                        placeholder="Search any city photos (e.g. Rome, Tokyo, Miami)..."
                        accentColor="rose"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        setIsImproveModalOpen(true);
                      }}
                      className="bg-rose-500 hover:bg-rose-400 text-white font-black px-5 py-3 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap text-center shadow-lg shadow-rose-500/20"
                    >
                      Submit a Photo →
                    </button>
                  </div>
                </div>

                {/* 3-Point Exit Strategy (Point 3: BACK TO SITE) */}
                <div className="pt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="bg-white/10 hover:bg-white/20 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                  >
                    BACK TO SITE
                  </button>
                </div>
              </div>
            )}

            {/* MODAL: CITY REPORTS */}
            {activeModal === "attractions" && (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <Compass size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    City Reports
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight mt-2">
                    City Reports
                  </h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Our city guides combine authentic narrative stories about atmosphere, history, economy, and local attractions with quick reference fact tables.
                </p>
                
                {/* City Search Box */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-2">
                    Search City Reports
                  </label>
                  <ModalCitySearch
                    onClose={() => setActiveModal(null)}
                    targetAnchor="#community-guide"
                    placeholder="Search any city report (e.g. Denver, Paris, Tokyo)..."
                  />
                </div>

                {/* 3-Point Exit Strategy & Actions */}
                <div className="pt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="bg-white/10 hover:bg-white/20 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                  >
                    BACK TO SITE
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setIsImproveModalOpen(true);
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                  >
                    Share Insights
                  </button>
                </div>
              </div>
            )}

            {/* MODAL: WEATHER */}
            {activeModal === "weather" && (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <CloudSun size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                    Live Weather & Forecasts
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight mt-2">
                    Real-Time Conditions & 14-Day Horizons
                  </h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Check live temperatures, wind speeds, humidity, and weather conditions across the globe. Seamlessly toggle between Fahrenheit and Celsius for any city.
                </p>
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-400/30 text-xs font-semibold text-slate-200 space-y-1">
                  <div className="font-bold text-amber-300">Extended Forecasts & Radar</div>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed">
                    Plan your travels, outdoor weekend activities, yard sales, and school sporting events with reliable 14-day weather forecasts.
                  </p>
                </div>
                <div className="pt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="bg-white/10 hover:bg-white/20 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                  >
                    BACK TO SITE
                  </button>
                </div>

                {/* City Search Box */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-2">
                    Search City Weather & Forecasts
                  </label>
                  <ModalCitySearch
                    onClose={() => setActiveModal(null)}
                    targetAnchor=""
                    placeholder="Search any city weather (e.g. Tokyo, Miami, Paris)..."
                    accentColor="amber"
                  />
                </div>
              </div>
            )}

            {/* MODAL: TIME */}
            {activeModal === "time" && (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Clock size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                    Atomic Precision Clocks
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight mt-2">
                    Synchronized World Clocks & Timezones
                  </h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Precise local time, date, and timezone identifiers for every city in the world. Features both digital and analog clocks with 12h/24h display modes.
                </p>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs font-semibold text-slate-300 space-y-1">
                  <div className="font-bold text-white">Global Horizon Discovery</div>
                  <p className="text-slate-400 text-[11.5px] leading-relaxed">
                    Compare timezones, calculate offsets, and plan international meetings or family check-ins across the globe with zero confusion.
                  </p>
                </div>
                <div className="pt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="bg-white/10 hover:bg-white/20 text-white font-black px-5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                  >
                    BACK TO SITE
                  </button>
                </div>

                {/* City Search Box */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Search World Clocks & Timezones
                  </label>
                  <ModalCitySearch
                    onClose={() => setActiveModal(null)}
                    targetAnchor=""
                    placeholder="Search any world clock (e.g. London, Tokyo, New York)..."
                    accentColor="white"
                  />
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 8. LOCAL INSIGHTS & WEBCAMS MODAL FORM */}
      {isImproveModalOpen && (
        <ImproveFormModal 
          isOpen={isImproveModalOpen}
          onClose={() => setIsImproveModalOpen(false)}
        />
      )}

      {/* 9. COMMUNITY EVENT SUBMISSION MODAL FORM */}
      {isEventModalOpen && (
        <EventSubmissionModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
        />
      )}

      {/* 10. FOOTER CONTACT MODAL */}
      {isContactModalOpen && (
        <FooterModal
          type="contact"
          onClose={() => setIsContactModalOpen(false)}
        />
      )}

    </main>
  );
}