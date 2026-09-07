"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type CityResult = {
  name: string;
  admin1?: string | null;
  country_name?: string | null;
  country_code?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string | null;
  href: string;
};

export default function CitySearch({ onSelectOverride }: { onSelectOverride?: (city: CityResult) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setShowDropdown(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (data.ok) {
        setResults(data.cities || []);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const onSelect = async (city: CityResult) => {
    setQ("");
    setShowDropdown(false);

    if (onSelectOverride) {
      onSelectOverride(city);
      return;
    }

    // --- SILENT SAVE LOGIC START ---
    // This sends the city data to your 'save-report' pipe in the background.
    // We don't 'await' it because we want the user to jump to the page immediately.
    fetch("/api/admin/save-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city_name: city.name,
        state_name: city.admin1 || city.country_name || "N/A",
        report_content: "Initial log entry - full report pending generation.",
        lat: city.latitude,
        lng: city.longitude
      }),
    }).catch(err => console.error("Background save failed", err));
    // --- SILENT SAVE LOGIC END ---

    router.push(city.href);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center w-full h-[36px] bg-gray-50 rounded border-2 border-slate-900 px-3 group focus-within:border-blue-600 focus-within:bg-white transition-all shadow-sm">
        <Search size={14} className="text-slate-400 mr-2" />
        <input 
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            handleSearch(e.target.value);
          }}
          onFocus={() => q.length >= 2 && setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              onSelect(results[0]);
            }
          }}
          placeholder="Search any city, state, or country..." 
          className="bg-transparent text-[13px] w-full outline-none text-slate-950 font-semibold placeholder:text-slate-400"
        />
        {loading ? (
          <Loader2 size={14} className="animate-spin text-blue-600 ml-2" />
        ) : (
          <button 
            onClick={() => results.length > 0 && onSelect(results[0])}
            className="ml-2 text-[11px] font-black uppercase tracking-tighter text-blue-700 hover:text-blue-900 transition-colors"
          >
            SEARCH
          </button>
        )}
      </div>

      {showDropdown && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-[200] max-h-[300px] overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Searching Database...</div>
          ) : (
            results.map((city, i) => (
              <button
                key={i}
                onClick={() => onSelect(city)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-left"
              >
                <MapPin size={14} className="text-slate-400" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-slate-900 uppercase tracking-tight">
                    {city.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {city.admin1 ? `${city.admin1}, ` : ""}{city.country_name || city.country_code}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}