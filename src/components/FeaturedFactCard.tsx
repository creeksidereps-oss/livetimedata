"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, X, BookOpen, PlusCircle } from "lucide-react";

interface FactItem {
  id: number;
  title: string;
  description: string;
  category: string;
  scope: string;
  factNumber: number;
  totalFacts: number;
  source_attribution?: string;
  contributed_by?: string;
}

interface FeaturedFactCardProps {
  cityName: string;
  stateName?: string;
  countryName?: string;
}

export default function FeaturedFactCard({ cityName, stateName, countryName }: FeaturedFactCardProps) {
  const [featuredFact, setFeaturedFact] = useState<FactItem | null>(null);
  const [allFacts, setAllFacts] = useState<FactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadFacts() {
      if (!cityName) return;
      setLoading(true);
      try {
        const query = `/api/facts/featured?city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(stateName || "")}&country=${encodeURIComponent(countryName || "")}`;
        const res = await fetch(query);
        const data = await res.json();
        if (data.ok && isMounted) {
          setFeaturedFact(data.featured);
          setAllFacts(data.allFacts || []);
          if (data.featured && typeof data.featured.factNumber === "number") {
            setCurrentIdx(data.featured.factNumber - 1);
          }
        }
      } catch (err) {
        console.warn("Featured fact load warning:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFacts();
    return () => { isMounted = false; };
  }, [cityName, stateName, countryName]);

  const handleNextFact = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allFacts.length === 0) return;
    const nextIdx = (currentIdx + 1) % allFacts.length;
    setCurrentIdx(nextIdx);
    setFeaturedFact({
      ...allFacts[nextIdx],
      factNumber: nextIdx + 1,
      totalFacts: allFacts.length
    });
  };

  if (loading && !featuredFact) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm animate-pulse mb-5">
        <div className="h-3 w-28 bg-slate-200 rounded mb-3" />
        <div className="h-4 w-4/5 bg-slate-200 rounded mb-2" />
        <div className="h-12 w-full bg-slate-100 rounded" />
      </div>
    );
  }

  if (!featuredFact) return null;

  const scopeLabel = featuredFact.scope === "state" 
    ? `${stateName || "REGIONAL"} CURIO` 
    : featuredFact.scope === "national"
    ? "NATIONAL ODDITY"
    : `${cityName.toUpperCase()} ODDITY`;

  return (
    <>
      {/* Featured Fact Card - Positioned at top of Right Rail */}
      <div className="w-full bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all mb-5 relative overflow-hidden group">
        {/* Subtle accent top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500" />

        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-[10px] font-black tracking-wider text-amber-900 uppercase">
            <Sparkles size={11} className="text-amber-600" />
            <span>{scopeLabel} • #{featuredFact.factNumber} OF {allFacts.length || featuredFact.totalFacts}</span>
          </div>

          {allFacts.length > 1 && (
            <button
              type="button"
              onClick={handleNextFact}
              title="Rotate to next fact"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full transition-all cursor-pointer"
            >
              <RefreshCw size={10} className="group-hover:rotate-45 transition-transform" />
              <span>Next</span>
            </button>
          )}
        </div>

        {/* Fact Title */}
        <h3 className="text-[13px] font-black text-slate-900 leading-snug tracking-tight mb-1.5">
          {featuredFact.title}
        </h3>

        {/* Fact Description */}
        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 mb-3">
          {featuredFact.description}
        </p>

        {/* Action Buttons: Stacked on Mobile, Side-by-Side on Desktop */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <BookOpen size={12} />
            <span>Explore More Facts</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("openModal", { detail: "share_insights" }))}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full bg-slate-950 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <PlusCircle size={12} />
            <span>Submit a Fact for {cityName}</span>
          </button>
        </div>
      </div>

      {/* Full Fun Facts Modal (Unthrottled, scrollable list of all facts) */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-600" />
                  <span>Curated Municipal Oddities & Lore</span>
                </div>
                <h2 className="text-base md:text-lg font-black uppercase tracking-tight text-slate-900 mt-0.5">
                  {cityName} Fun Facts & Curiosities ({allFacts.length})
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Scrollable list of all unthrottled facts */}
            <div id="fun-facts-modal-list" className="p-5 overflow-y-auto space-y-4 flex-1 divide-y divide-slate-100">
              {allFacts.map((fact, idx) => (
                <div key={fact.id || idx} className={`${idx > 0 ? "pt-4" : ""} group`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Fact #{idx + 1}
                    </span>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {fact.category?.replace(/_/g, " ") || "Curiosity"}
                    </span>
                  </div>
                  <h4 className="text-[13px] font-black text-slate-900 mb-1">
                    {fact.title}
                  </h4>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    {fact.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Modal Footer: Stacked on Mobile, Side-by-Side on Desktop */}
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const listEl = document.getElementById("fun-facts-modal-list");
                    if (listEl) listEl.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <BookOpen size={12} />
                  <span>Explore More Facts</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    window.dispatchEvent(new CustomEvent("openModal", { detail: "share_insights" }));
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-full bg-slate-950 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <PlusCircle size={12} />
                  <span>Submit a Fact for {cityName}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 sm:py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
