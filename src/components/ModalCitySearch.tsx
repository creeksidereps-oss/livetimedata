"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

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

interface ModalCitySearchProps {
  onClose: () => void;
  targetAnchor?: string; // default "#community-guide"
  placeholder?: string;
  accentColor?: "emerald" | "rose" | "blue" | "amber" | "white";
}

export default function ModalCitySearch({
  onClose,
  targetAnchor = "#community-guide",
  placeholder = "Search any city report (e.g. Denver, Paris, Tokyo)...",
  accentColor = "emerald",
}: ModalCitySearchProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const themeClasses = {
    rose: {
      border: "border-rose-400/60 hover:border-rose-400 focus-within:border-rose-400 focus-within:ring-rose-400/30",
      text: "text-rose-400",
      dropdownBorder: "border-rose-400/40",
      hoverBg: "hover:bg-rose-500/20",
      hoverText: "group-hover:text-rose-300",
      pin: "text-rose-400",
      arrow: "group-hover:text-rose-400"
    },
    emerald: {
      border: "border-emerald-400/60 hover:border-emerald-400 focus-within:border-emerald-400 focus-within:ring-emerald-400/30",
      text: "text-emerald-400",
      dropdownBorder: "border-emerald-400/40",
      hoverBg: "hover:bg-emerald-500/20",
      hoverText: "group-hover:text-emerald-300",
      pin: "text-emerald-400",
      arrow: "group-hover:text-emerald-400"
    },
    blue: {
      border: "border-blue-400/60 hover:border-blue-400 focus-within:border-blue-400 focus-within:ring-blue-400/30",
      text: "text-blue-400",
      dropdownBorder: "border-blue-400/40",
      hoverBg: "hover:bg-blue-500/20",
      hoverText: "group-hover:text-blue-300",
      pin: "text-blue-400",
      arrow: "group-hover:text-blue-400"
    },
    amber: {
      border: "border-amber-400/60 hover:border-amber-400 focus-within:border-amber-400 focus-within:ring-amber-400/30",
      text: "text-amber-400",
      dropdownBorder: "border-amber-400/40",
      hoverBg: "hover:bg-amber-500/20",
      hoverText: "group-hover:text-amber-300",
      pin: "text-amber-400",
      arrow: "group-hover:text-amber-400"
    },
    white: {
      border: "border-white/40 hover:border-white focus-within:border-white focus-within:ring-white/20",
      text: "text-white",
      dropdownBorder: "border-white/20",
      hoverBg: "hover:bg-white/10",
      hoverText: "group-hover:text-white",
      pin: "text-white",
      arrow: "group-hover:text-white"
    }
  }[accentColor];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setShowDropdown(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.cities)) {
        setResults(data.cities.slice(0, 6));
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("City search failed:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onSelectCity = (city: CityResult) => {
    onClose();
    const destination = targetAnchor ? `${city.href}${targetAnchor}` : city.href;
    router.push(destination);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Search Input Bar */}
      <div className={`relative flex items-center w-full h-11 sm:h-12 bg-slate-950/90 rounded-2xl border-2 ${themeClasses.border} focus-within:ring-2 px-3.5 transition-all shadow-inner`}>
        <Search size={17} className={`${themeClasses.text} mr-2.5 shrink-0`} />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            handleSearch(e.target.value);
          }}
          onFocus={() => {
            if (q.trim().length >= 2) setShowDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              onSelectCity(results[0]);
            }
          }}
          placeholder={placeholder}
          className="bg-transparent text-xs sm:text-sm w-full outline-none text-white font-medium placeholder:text-slate-400"
          autoComplete="off"
        />
        {loading && (
          <Loader2 size={16} className={`${themeClasses.text} animate-spin ml-2 shrink-0`} />
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && (
        <div className={`absolute left-0 right-0 top-full mt-1.5 bg-slate-950/95 border ${themeClasses.dropdownBorder} rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-md max-h-60 overflow-y-auto`}>
          {results.length > 0 ? (
            <div className="py-1 divide-y divide-white/5">
              {results.map((city, idx) => {
                const subtitle = [city.admin1, city.country_name || city.country_code]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <button
                    key={`${city.name}-${city.latitude}-${city.longitude}-${idx}`}
                    type="button"
                    onClick={() => onSelectCity(city)}
                    className={`w-full text-left px-3.5 py-2.5 ${themeClasses.hoverBg} flex items-center justify-between group transition-colors cursor-pointer`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <MapPin size={15} className={`${themeClasses.pin} shrink-0 group-hover:scale-110 transition-transform`} />
                      <div className="truncate">
                        <span className={`text-xs font-bold text-white ${themeClasses.hoverText}`}>
                          {city.name}
                        </span>
                        {subtitle && (
                          <span className="text-[11px] text-slate-400 ml-1.5">
                            · {subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={13} className={`text-slate-500 ${themeClasses.arrow} shrink-0 group-hover:translate-x-0.5 transition-all`} />
                  </button>
                );
              })}
            </div>
          ) : q.trim().length >= 2 && !loading ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">
              No matching cities found for &ldquo;{q}&rdquo;. Try another city name.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
