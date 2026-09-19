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

export default function HomeSearch() {
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
    router.push(city.href);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto" ref={dropdownRef}>
      <div className="relative flex items-center w-full h-16 md:h-[68px] bg-white rounded-full border-2 border-amber-400/90 hover:border-amber-500 focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-300/40 shadow-[0_10px_35px_rgba(245,158,11,0.22)] px-6 group transition-all">
        <Search size={24} className="text-blue-600 mr-3.5 shrink-0 group-focus-within:text-amber-600 transition-colors" />
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
          placeholder="Search your hometown, dream destination, or any city in the world..." 
          className="bg-transparent text-[16px] md:text-[18px] w-full outline-none text-slate-950 font-bold placeholder:text-slate-400 placeholder:font-normal"
        />
        {loading ? (
          <Loader2 size={22} className="animate-spin text-amber-500 ml-3 shrink-0" />
        ) : (
          <button 
            onClick={() => results.length > 0 && onSelect(results[0])}
            className="ml-3 text-[12px] md:text-[13px] font-black uppercase tracking-wider bg-slate-950 hover:bg-amber-500 hover:text-slate-950 text-white px-6 md:px-7 py-3 rounded-full transition-all shrink-0 cursor-pointer shadow-md"
          >
            Search
          </button>
        )}
      </div>

      {showDropdown && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-[200] max-h-[360px] overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          {loading && results.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm font-bold tracking-wide flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              Searching cities across the world...
            </div>
          ) : (
            results.map((city, i) => (
              <button
                key={i}
                onClick={() => onSelect(city)}
                className="w-full flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-blue-50/70 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                    <MapPin size={16} className="text-amber-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors truncate">
                      {city.name}
                    </span>
                    <span className="text-[12px] font-semibold text-slate-500 truncate">
                      {city.admin1 ? `${city.admin1}, ` : ""}{city.country_name || city.country_code}
                    </span>
                  </div>
                </div>

                <span className="hidden sm:inline-flex items-center text-[11px] font-black uppercase tracking-wider text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  Explore City →
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
