"use client";

import React, { useState, useEffect } from "react";
import { Newspaper, ExternalLink, ChevronDown, ChevronUp, Clock, X } from "lucide-react";

interface NewsStory {
  id: string;
  title: string;
  source: string;
  pubDate: string;
  timestamp?: number;
  timeAgo: string;
  snippet: string;
  link: string;
}

interface CityNewsBlockProps {
  cityName: string;
  stateName?: string;
  countryName?: string;
}

export default function CityNewsBlock({ cityName, stateName, countryName }: CityNewsBlockProps) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadNews() {
      if (!cityName) return;
      setLoading(true);
      try {
        const query = `/api/news?city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(stateName || "")}&country=${encodeURIComponent(countryName || "")}`;
        const res = await fetch(query);
        const data = await res.json();
        if (data.ok && isMounted) {
          const sorted = (data.stories || []).sort((a: NewsStory, b: NewsStory) => {
            const tA = a.timestamp || (a.pubDate ? new Date(a.pubDate).getTime() : 0);
            const tB = b.timestamp || (b.pubDate ? new Date(b.pubDate).getTime() : 0);
            return tB - tA;
          });
          setStories(sorted);
        }
      } catch (err) {
        console.warn("City news load warning:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadNews();
    return () => { isMounted = false; };
  }, [cityName, stateName, countryName]);

  if (loading && stories.length === 0) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-2xl p-3 md:p-3.5 shadow-xs animate-pulse mb-3.5">
        <div className="h-3.5 w-40 bg-slate-200 rounded mb-2.5" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 hidden md:block bg-slate-100 rounded-xl" />
          <div className="h-16 hidden md:block bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (stories.length === 0) return null;

  const displayedStories = isExpanded ? stories : stories.slice(0, 3);

  return (
    <>
      {/* Main City News Container - Compact Vertical Footprint */}
      <section className="w-full bg-white border border-gray-200 rounded-2xl p-3 md:p-3.5 shadow-xs mb-3.5">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Newspaper size={13} />
            </div>
            <div>
              <h2 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-900 leading-tight">
                Top Headlines in {cityName}
              </h2>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Regional Coverage</span>
              </div>
            </div>
          </div>

          {stories.length > 1 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer"
            >
              <span>{isExpanded ? "View Less" : "View More"}</span>
              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>

        {/* Stories Grid: 1 on mobile when collapsed, 3 on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {displayedStories.map((story, index) => {
            const hiddenOnMobile = !isExpanded && index > 0;
            return (
              <div
                key={story.id}
                onClick={() => setSelectedStory(story)}
                className={`group bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-blue-300 rounded-xl p-2.5 sm:p-3 transition-all cursor-pointer shadow-2xs hover:shadow-sm flex-col justify-between ${
                  hiddenOnMobile ? "hidden md:flex" : "flex"
                }`}
              >
                <div>
                  {/* Publisher & Time */}
                  <div className="flex items-center justify-between gap-2 text-[9.5px] font-bold text-slate-500 mb-1.5">
                    <span className="truncate uppercase tracking-wider text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200/60 max-w-[65%]">
                      {story.source}
                    </span>
                    <span className="inline-flex items-center gap-1 shrink-0 text-slate-400">
                      <Clock size={9} />
                      {story.timeAgo}
                    </span>
                  </div>

                  {/* Headline */}
                  <h3 className="text-[11px] sm:text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                    {story.title}
                  </h3>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[9px] font-bold text-slate-400 group-hover:text-blue-600">
                  <span>Story Preview</span>
                  <ExternalLink size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Story Preview Modal */}
      {selectedStory && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedStory(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 md:p-6 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Row */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-black uppercase tracking-wider text-blue-700">
                <Newspaper size={12} />
                <span>{selectedStory.source}</span>
                <span>•</span>
                <span>{selectedStory.timeAgo}</span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStory(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Headline */}
            <h2 className="text-base md:text-lg font-black text-slate-900 leading-snug mb-3">
              {selectedStory.title}
            </h2>

            {/* Story Excerpt */}
            <div className="text-xs text-slate-600 leading-relaxed mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p>{selectedStory.snippet}</p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedStory(null)}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Close
              </button>

              <a
                href={selectedStory.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                <span>Read Full Story on {selectedStory.source}</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
