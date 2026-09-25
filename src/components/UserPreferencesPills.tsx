"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Home, Star, ChevronDown, Check, X, Plus, Sparkles, Trash2, ArrowRight } from "lucide-react";

interface FavoriteCity {
  name: string;
  path: string;
  state?: string;
  country?: string;
  countryCode?: string;
  addedAt: number;
}

interface StartPageData {
  name: string;
  path: string;
  state?: string;
  country?: string;
  countryCode?: string;
}

interface UserPreferencesPillsProps {
  cityName: string;
  stateName?: string;
  countryName?: string;
  countryCode?: string;
}

const START_PAGE_KEY = "ltd_start_page";
const FAVORITES_KEY = "ltd_favorite_places";

export default function UserPreferencesPills({
  cityName,
  stateName,
  countryName,
  countryCode,
}: UserPreferencesPillsProps) {
  const [startPage, setStartPage] = useState<StartPageData | null>(null);
  const [favorites, setFavorites] = useState<FavoriteCity[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [activeModalOpen, setActiveModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedStart = window.localStorage.getItem(START_PAGE_KEY);
      if (savedStart) {
        setStartPage(JSON.parse(savedStart));
      }

      const savedFavs = window.localStorage.getItem(FAVORITES_KEY);
      if (savedFavs) {
        setFavorites(JSON.parse(savedFavs));
      }
    } catch (e) {
      console.warn("Could not load user preferences from localStorage:", e);
    }
  }, []);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentPath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search || ""}`
      : `/time/${cityName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const isCurrentStartPage = startPage?.name?.toLowerCase() === cityName.toLowerCase();
  const isCurrentFavorite = favorites.some((f) => f.name.toLowerCase() === cityName.toLowerCase());

  // Save favorites helper
  const saveFavorites = (newFavs: FavoriteCity[]) => {
    setFavorites(newFavs);
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavs));
    } catch (e) {}
  };

  // Save start page helper
  const saveStartPage = (newStart: StartPageData | null) => {
    setStartPage(newStart);
    try {
      if (newStart) {
        window.localStorage.setItem(START_PAGE_KEY, JSON.stringify(newStart));
      } else {
        window.localStorage.removeItem(START_PAGE_KEY);
      }
    } catch (e) {}
  };

  // Add current city to favorites
  const addCurrentToFavorites = () => {
    if (isCurrentFavorite) return;
    const newEntry: FavoriteCity = {
      name: cityName,
      path: currentPath,
      state: stateName,
      country: countryName,
      countryCode: countryCode,
      addedAt: Date.now(),
    };
    const updated = [newEntry, ...favorites.filter((f) => f.name.toLowerCase() !== cityName.toLowerCase())];
    saveFavorites(updated);
    setToast(`⭐ Added ${cityName} to your favorite places!`);
  };

  // Remove city from favorites
  const removeFavorite = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.filter((f) => f.name.toLowerCase() !== nameToRemove.toLowerCase());
    saveFavorites(updated);
    if (startPage?.name?.toLowerCase() === nameToRemove.toLowerCase()) {
      saveStartPage(null);
    }
    setToast(`Removed ${nameToRemove} from favorites.`);
  };

  // Directly set any city as start page
  const setCityAsStartPage = (city: { name: string; path: string; state?: string; country?: string; countryCode?: string }) => {
    const startData: StartPageData = {
      name: city.name,
      path: city.path,
      state: city.state,
      country: city.country,
      countryCode: city.countryCode,
    };
    saveStartPage(startData);

    // Ensure the start page is also in the favorites list
    if (!favorites.some((f) => f.name.toLowerCase() === city.name.toLowerCase())) {
      const newEntry: FavoriteCity = {
        name: city.name,
        path: city.path,
        state: city.state,
        country: city.country,
        countryCode: city.countryCode,
        addedAt: Date.now(),
      };
      saveFavorites([newEntry, ...favorites]);
    }

    setToast(`🏠 ${city.name} is now your default Start Page on LiveTimeData.com!`);
    setSwitchModalOpen(false);
  };

  // Handle click on the main "Start Page" button
  const handleStartPageClick = () => {
    if (isCurrentStartPage) {
      // Already active -> open manage/reset modal
      setActiveModalOpen(true);
      return;
    }

    if (startPage && startPage.name.toLowerCase() !== cityName.toLowerCase()) {
      // User has a DIFFERENT city set as start page -> ask if they want to switch!
      setSwitchModalOpen(true);
      return;
    }

    // No start page set yet -> make this one the start page immediately!
    setCityAsStartPage({
      name: cityName,
      path: currentPath,
      state: stateName,
      country: countryName,
      countryCode: countryCode,
    });
  };

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0 relative">
        {/* Button 1: My Favorites Dropdown Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            title="View your favorite places"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs whitespace-nowrap border border-slate-900 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Star size={13} className="text-amber-300 fill-amber-300" />
            <span>MY FAVORITES</span>
            {favorites.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black leading-none bg-blue-900/70 text-white border border-white/20">
                {favorites.length}
              </span>
            )}
            <ChevronDown size={11} className={`text-white transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Favorites Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[99999] animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-900">
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                  <span>My Favorite Places</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {favorites.length} {favorites.length === 1 ? "City" : "Cities"}
                </span>
              </div>

              {/* Favorites List */}
              <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100 py-1">
                {favorites.length === 0 ? (
                  <div className="py-6 px-4 text-center">
                    <p className="text-xs font-semibold text-slate-500 mb-1">No favorite places yet</p>
                    <p className="text-[10px] text-slate-400">Save places you visit often for quick 1-click access.</p>
                  </div>
                ) : (
                  favorites.map((fav) => {
                    const isThisStart = startPage?.name?.toLowerCase() === fav.name.toLowerCase();
                    return (
                      <div
                        key={fav.name}
                        className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50 rounded-xl transition-colors group"
                      >
                        <Link
                          href={fav.path}
                          onClick={() => setDropdownOpen(false)}
                          className="flex flex-col min-w-0 flex-1 pl-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                              {fav.name}
                            </span>
                            {isThisStart && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[9px] font-black text-amber-900 uppercase tracking-wider shrink-0">
                                <Home size={9} className="text-amber-700" />
                                <span>Start Page</span>
                              </span>
                            )}
                          </div>
                          {(fav.state || fav.country) && (
                            <span className="text-[10px] text-slate-400 truncate">
                              {fav.state ? `${fav.state}, ` : ""}{fav.country || fav.countryCode || ""}
                            </span>
                          )}
                        </Link>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isThisStart && (
                            <button
                              type="button"
                              onClick={() => setCityAsStartPage(fav)}
                              title={`Set ${fav.name} as default start page`}
                              className="px-2 py-1 rounded-full text-[9px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                            >
                              Make Start
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => removeFavorite(fav.name, e)}
                            title="Remove from favorites"
                            className="p-1 rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Action: Add Current City */}
              <div className="pt-2 border-t border-slate-100">
                {!isCurrentFavorite ? (
                  <button
                    type="button"
                    onClick={() => {
                      addCurrentToFavorites();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus size={14} className="text-white" />
                    <span>Add {cityName} to Favorites</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-rose-50 rounded-xl text-[11px] font-bold text-rose-800">
                    <span className="flex items-center gap-1.5">
                      <Check size={13} className="text-rose-600" />
                      <span>{cityName} is in your Favorites</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => removeFavorite(cityName, e)}
                      className="text-[10px] font-black text-rose-600 hover:text-rose-800 underline uppercase"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Button 2: Save As Start Page Button */}
        <button
          type="button"
          onClick={handleStartPageClick}
          title={isCurrentStartPage ? "Current Start Page (Click to manage)" : `Save ${cityName} as your start page`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs whitespace-nowrap border border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-500/20"
        >
          <Home size={13} className="text-slate-950 fill-slate-950" />
          <span>
            {isCurrentStartPage ? "START PAGE ✓" : "SAVE AS START PAGE"}
          </span>
        </button>
      </div>

      {/* MODAL 1: Switch Start Page Confirmation Modal */}
      {switchModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-slate-900 relative">
            <button
              type="button"
              onClick={() => setSwitchModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-4">
              <Home size={24} />
            </div>

            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">
              Change Your Start Page?
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Your default start page is currently set to{" "}
              <strong className="text-slate-900 font-black">{startPage?.name}{startPage?.state ? `, ${startPage.state}` : ""}</strong>.
              Would you like to make <strong className="text-blue-600 font-black">{cityName}</strong> your new start page?
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setCityAsStartPage({
                    name: cityName,
                    path: currentPath,
                    state: stateName,
                    country: countryName,
                    countryCode: countryCode,
                  })
                }
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                ✓ Yes, Save {cityName} As Start Page
              </button>

              <button
                type="button"
                onClick={() => {
                  addCurrentToFavorites();
                  setSwitchModalOpen(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                ⭐ Add to My Favorite Cities
              </button>

              <button
                type="button"
                onClick={() => setSwitchModalOpen(false)}
                className="w-full py-2 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
              >
                🏠 Keep {startPage?.name} as Start Page
              </button>

              <button
                type="button"
                onClick={() => setSwitchModalOpen(false)}
                className="w-full py-1 text-slate-400 hover:text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Active Start Page Manage / Clear Modal */}
      {activeModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-slate-900 relative">
            <button
              type="button"
              onClick={() => setActiveModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 mb-4 shadow-md">
              <Home size={24} />
            </div>

            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">
              {cityName} is Your Start Page
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Whenever you visit <strong className="text-slate-900">LiveTimeData.com</strong>, your browser opens directly to{" "}
              <strong className="text-blue-600">{cityName}</strong> with real-time local intelligence, weather, and events.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  saveStartPage(null);
                  setActiveModalOpen(false);
                  setToast("Start page cleared. LiveTimeData.com will open the global homepage.");
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                ✕ Remove Start Page (Return to Global Home)
              </button>

              <button
                type="button"
                onClick={() => setActiveModalOpen(false)}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Keep {cityName} as Start Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100001] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles size={14} className="text-amber-400 shrink-0" />
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white p-0.5"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
}
