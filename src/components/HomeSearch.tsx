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
      <div className="relative flex items-center w-full h-16 bg-[#222222] rounded-full border-2 border-white/80 px-6 group focus-within:border-white focus-within:shadow-[0_0_25px_rgba(255,255,255,0.35)] focus-within:bg-[#2a2a2a] transition-all shadow-[0_0_15px_rgba(255,255,255,0.15)]">
        <Search size={22} className="text-white mr-3 shrink-0" />
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
          placeholder="Search for any city..." 
          className="bg-transparent text-[16px] w-full outline-none text-white font-semibold placeholder:text-gray-300"
        />
        {loading ? (
          <Loader2 size={20} className="animate-spin text-white ml-3 shrink-0" />
        ) : (
          <button 
            onClick={() => results.length > 0 && onSelect(results[0])}
            className="ml-3 text-[13px] font-black uppercase tracking-wider bg-white text-black px-5 py-2 rounded-full hover:bg-gray-200 transition-all shrink-0 cursor-pointer shadow-sm"
          >
            Search
          </button>
        )}
      </div>

      {showDropdown && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-[#1A1A1A] border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-[200] max-h-[350px] overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm font-medium tracking-wide">Searching...</div>
          ) : (
            results.map((city, i) => (
              <button
                key={i}
                onClick={() => onSelect(city)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left"
              >
                <MapPin size={18} className="text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-white tracking-wide">
                    {city.name}
                  </span>
                  <span className="text-[12px] font-medium text-gray-500">
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
