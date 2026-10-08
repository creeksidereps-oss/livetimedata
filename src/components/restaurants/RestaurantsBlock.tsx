"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Utensils, 
  MapPin, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Star, 
  Sparkles, 
  Store,
  Navigation,
  ExternalLink,
  PlusCircle,
  Share2
} from "lucide-react";
import { RestaurantItem, EstablishmentTier, RadiusOption } from "./types";
import { SAMPLE_RESTAURANTS } from "./sampleData";
import RestaurantDetailModal from "./RestaurantDetailModal";

type RestaurantsBlockProps = {
  cityName: string;
  stateName?: string;
  countryCode?: string;
  initialRadius?: RadiusOption;
  onClose?: () => void;
};

export default function RestaurantsBlock({
  cityName = "Charlotte",
  stateName = "NC",
  countryCode = "US",
  initialRadius = "0",
  onClose,
}: RestaurantsBlockProps) {
  // 1. Core State
  const [radius, setRadius] = useState<RadiusOption>(initialRadius);
  const [activeTier, setActiveTier] = useState<EstablishmentTier | "all">("local"); // Defaults to Local Gems!
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 2. Selected Restaurant for Detail Modal
  const [activeRestaurant, setActiveRestaurant] = useState<RestaurantItem | null>(null);

  // 3. Fullscreen Lightbox State
  const [lightboxData, setLightboxData] = useState<{
    restaurantName: string;
    photos: string[];
    currentIndex: number;
  } | null>(null);

  // Close lightbox on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxData(null);
      if (lightboxData) {
        if (e.key === "ArrowLeft") handlePrevPhoto();
        if (e.key === "ArrowRight") handleNextPhoto();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxData]);

  const handleNextPhoto = () => {
    if (!lightboxData) return;
    setLightboxData({
      ...lightboxData,
      currentIndex: (lightboxData.currentIndex + 1) % lightboxData.photos.length,
    });
  };

  const handlePrevPhoto = () => {
    if (!lightboxData) return;
    setLightboxData({
      ...lightboxData,
      currentIndex:
        (lightboxData.currentIndex - 1 + lightboxData.photos.length) %
        lightboxData.photos.length,
    });
  };

  // 4. Filter by Radius
  const radiusFiltered = useMemo(() => {
    const maxMiles = radius === "0" ? 0 : radius === "15" ? 15 : 30;
    return SAMPLE_RESTAURANTS.filter((item) => {
      // In-city matches
      if (maxMiles === 0) {
        return (
          item.cityName.toLowerCase() === cityName.toLowerCase() ||
          (item.distanceMiles || 0) === 0
        );
      }
      // Radius matches
      return (item.distanceMiles || 0) <= maxMiles;
    });
  }, [cityName, radius]);

  // 5. Filter by Tier (Local vs Franchise vs Chain vs All)
  const tierFiltered = useMemo(() => {
    if (activeTier === "all") return radiusFiltered;
    return radiusFiltered.filter((item) => item.tier === activeTier);
  }, [radiusFiltered, activeTier]);

  // 6. Dynamic Cuisine Calculation (Zero Ghost Pills!)
  const dynamicCuisines = useMemo(() => {
    const counts: Record<string, number> = {};
    tierFiltered.forEach((r) => {
      counts[r.primaryCuisine] = (counts[r.primaryCuisine] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return [{ name: "All", count: tierFiltered.length }, ...sorted];
  }, [tierFiltered]);

  // If the currently selected cuisine is no longer valid in this filter, reset to "All"
  useEffect(() => {
    if (
      selectedCuisine !== "All" &&
      !dynamicCuisines.some((c) => c.name === selectedCuisine)
    ) {
      setSelectedCuisine("All");
    }
  }, [dynamicCuisines, selectedCuisine]);

  // 7. Search & Final Filtered List
  const finalRestaurants = useMemo(() => {
    let list = tierFiltered;

    // Filter by selected dynamic cuisine
    if (selectedCuisine !== "All") {
      list = list.filter((r) => r.primaryCuisine === selectedCuisine);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.primaryCuisine.toLowerCase().includes(q) ||
          r.cuisines.some((c) => c.toLowerCase().includes(q)) ||
          (r.tagline && r.tagline.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    // Sort order:
    // 1) Sponsored tier always pinned first
    // 2) If in nearby mode: in-city first, then ordered by distance
    // 3) Then by viewCount descending (page views popularity)
    return [...list].sort((a, b) => {
      if (a.isSponsored && !b.isSponsored) return -1;
      if (!a.isSponsored && b.isSponsored) return 1;

      if (radius !== "0") {
        const distA = a.distanceMiles || 0;
        const distB = b.distanceMiles || 0;
        if (distA !== distB) return distA - distB;
      }

      return (b.viewCount || 0) - (a.viewCount || 0);
    });
  }, [tierFiltered, selectedCuisine, searchQuery, radius]);

  return (
    <section className="w-full mt-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-5 shadow-xs transition-all">
      {/* ======================================================== */}
      {/* 1. TOP HEADER ROW (Matching Site Styling)                */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Utensils size={18} />
            </span>
            <h2 className="text-[17px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
              RESTAURANTS IN {cityName.toUpperCase()}
              {radius !== "0" && (
                <span className="text-orange-600 dark:text-orange-400 font-bold ml-1.5 text-xs lowercase">
                  (+{radius} miles)
                </span>
              )}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Discover local one-of-a-kind eateries, neighborhood delis, and dining destinations.
          </p>
        </div>

        {/* 3-Stage Distance Radius Control + X Close Pill Button */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setRadius("0")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                radius === "0"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <MapPin size={11} className={radius === "0" ? "text-orange-400 dark:text-orange-600" : ""} />
              <span>{cityName}</span>
            </button>

            <button
              type="button"
              onClick={() => setRadius("15")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                radius === "15"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Navigation size={11} className={radius === "15" ? "text-orange-400 dark:text-orange-600" : ""} />
              <span>+15 Mi</span>
            </button>

            <button
              type="button"
              onClick={() => setRadius("30")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                radius === "30"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Navigation size={11} className={radius === "30" ? "text-orange-400 dark:text-orange-600" : ""} />
              <span>+30 Mi</span>
            </button>
          </div>

          {/* Circular X Close Pill Button (Matching Screenshot Top-Right Close Button) */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close and exit back to city page"
              className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. SEARCH BAR + CLASSIFICATION SEGMENTED PILLS           */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-3">
        {/* Real-time Search Box */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search restaurants, pastrami, tacos, pizza, bakeries..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* 3-Tier Classification Filter (Segmented Control) */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700/50 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTier("local")}
            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTier === "local"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sparkles size={12} className={activeTier === "local" ? "text-yellow-200" : "text-amber-500"} />
            <span>Local Gems & Diners</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTier("franchise")}
            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTier === "franchise"
                ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Store size={12} />
            <span>Regional & Franchises</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTier("chain")}
            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTier === "chain"
                ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Fast-Food & Chains</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTier("all")}
            className={`px-2 py-1 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTier === "all"
                ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>All</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. DYNAMIC CUISINE PILLS (Matching Screenshot Pill Row)  */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 mt-1 no-scrollbar border-b border-slate-100 dark:border-slate-800/70">
        {dynamicCuisines.map((c) => {
          const isActive = selectedCuisine === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => setSelectedCuisine(c.name)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-orange-500 text-white shadow-xs"
                  : "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <span>{c.name}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive
                    ? "bg-orange-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                ({c.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 4. COMPACT RESTAURANT LIST ROWS (MATCHING SCREENSHOT)    */}
      {/* Layout: [ Title & Info Area ] [ Photo Reel ] [ View Btn ]*/}
      {/* ======================================================== */}
      <div className="mt-3 space-y-2.5">
        {finalRestaurants.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <Utensils size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No restaurants found matching your criteria
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Try expanding your radius (+15 or +30 miles), choosing another cuisine pill, or searching for another keyword.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTier("all");
                setSelectedCuisine("All");
                setSearchQuery("");
                setRadius("30");
              }}
              className="mt-3 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              Reset Filters & Expand Distance
            </button>
          </div>
        ) : (
          finalRestaurants.map((restaurant) => {
            const hasPhotos = restaurant.photos && restaurant.photos.length > 0;
            const isNearby = (restaurant.distanceMiles || 0) > 0;

            return (
              <div
                key={restaurant.id}
                onClick={() => setActiveRestaurant(restaurant)}
                className="group relative rounded-2xl border border-orange-200/70 hover:border-orange-400 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-800/90 p-3 sm:px-4 sm:py-3 transition-all duration-150 hover:shadow-xs cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* ZONE 1: Title & Info Area */}
                  <div className="min-w-0 flex-1">
                    {/* Title & Featured Spotlight */}
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-tight">
                        {restaurant.name}
                      </h3>

                      {restaurant.isSponsored && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider border border-amber-500/20">
                          <Sparkles size={9} />
                          Featured
                        </span>
                      )}
                    </div>

                    {/* Metadata line: Cuisine + Rating + Price + City badge */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {/* Primary Cuisine Badge */}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        🍴 {restaurant.primaryCuisine}
                      </span>

                      {/* City badge (styled like screenshot's city pill) */}
                      <span className="px-2 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                        {restaurant.cityName}
                        {isNearby && ` · ${restaurant.distanceMiles} mi`}
                      </span>

                      {/* Price Tier */}
                      {restaurant.priceRange && (
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          {restaurant.priceRange}
                        </span>
                      )}

                      {/* Star Rating */}
                      {restaurant.rating && (
                        <div className="flex items-center gap-0.5 text-amber-500 font-bold">
                          <Star size={11} className="fill-amber-400" />
                          <span>{restaurant.rating}</span>
                          {restaurant.reviewCount && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({restaurant.reviewCount})
                            </span>
                          )}
                        </div>
                      )}

                      {restaurant.hours && (
                        <span className="text-slate-400 text-[10px] hidden md:inline">
                          • {restaurant.hours}
                        </span>
                      )}
                    </div>

                    {/* Address line with pin */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      <MapPin size={11} className="text-rose-500 shrink-0" />
                      <span className="truncate">{restaurant.address}</span>
                    </div>

                    {/* 1-Line Tagline if available */}
                    {restaurant.tagline && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 italic line-clamp-1">
                        "{restaurant.tagline}"
                      </p>
                    )}
                  </div>

                  {/* ZONE 2: Photo Reel (Between Title Area and View Button!) */}
                  {/* CRUCIAL RULE: If no photos exist, container is omitted cleanly */}
                  {hasPhotos && (
                    <div
                      className="flex items-center gap-1.5 shrink-0 self-center"
                      onClick={(e) => {
                        // Allow clicking photos directly to open Lightbox, or detail modal
                        e.stopPropagation();
                        setLightboxData({
                          restaurantName: restaurant.name,
                          photos: restaurant.photos,
                          currentIndex: 0,
                        });
                      }}
                    >
                      {restaurant.photos.slice(0, 3).map((pUrl, pIdx) => (
                        <div
                          key={pIdx}
                          title="Click to view photo"
                          className="relative w-14 h-11 sm:w-16 sm:h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-2xs hover:scale-105 transition-transform"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pUrl}
                            alt={`${restaurant.name} thumbnail`}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          {pIdx === 2 && restaurant.photos.length > 3 && (
                            <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center text-white text-[10px] font-black">
                              +{restaurant.photos.length - 3}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ZONE 3: View Button (Matching Screenshot) */}
                  <div className="shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRestaurant(restaurant);
                      }}
                      className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 px-3.5 py-1 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. BOTTOM ACTION BAR (MATCHING SCREENSHOT AESTHETIC)     */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
        >
          Top of List
        </button>

        <button
          type="button"
          onClick={() => {
            alert("Restaurant Submission Portal: Open community submission form.");
          }}
          className="px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          <PlusCircle size={13} className="text-orange-400" />
          <span>Suggest Restaurant</span>
        </button>

        <button
          type="button"
          onClick={() => {
            alert("Share Local Food Insights: Community recommendations form.");
          }}
          className="px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
        >
          Share Insights
        </button>

        <button
          type="button"
          onClick={() => {
            alert("Food Photos Submission: Submit restaurant food & venue photos.");
          }}
          className="px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
        >
          Submit Food Photo
        </button>
      </div>

      {/* ======================================================== */}
      {/* 6. DEDICATED RESTAURANT DETAIL MODAL / PAGE              */}
      {/* ======================================================== */}
      {activeRestaurant && (
        <RestaurantDetailModal
          restaurant={activeRestaurant}
          onClose={() => setActiveRestaurant(null)}
          onOpenPhotoLightbox={(photos, startIndex) => {
            setLightboxData({
              restaurantName: activeRestaurant.name,
              photos,
              currentIndex: startIndex,
            });
          }}
        />
      )}

      {/* ======================================================== */}
      {/* 7. FULLSCREEN LIGHTBOX GALLERY MODAL                     */}
      {/* ======================================================== */}
      {lightboxData && (
        <div
          className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setLightboxData(null)}
        >
          {/* Top Bar */}
          <div
            className="w-full max-w-4xl flex items-center justify-between text-white pb-3 px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 className="text-sm sm:text-base font-black uppercase tracking-wider">
                {lightboxData.restaurantName}
              </h4>
              <p className="text-xs text-slate-400">
                Photo {lightboxData.currentIndex + 1} of {lightboxData.photos.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxData(null)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Photo Viewer */}
          <div
            className="relative w-full max-w-4xl max-h-[75vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxData.photos[lightboxData.currentIndex]}
              alt={`${lightboxData.restaurantName} enlarged`}
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl select-none"
            />

            {/* Previous Arrow */}
            {lightboxData.photos.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all cursor-pointer shadow-lg"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Next Arrow */}
            {lightboxData.photos.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all cursor-pointer shadow-lg"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          <div
            className="w-full max-w-4xl flex items-center justify-center gap-2 overflow-x-auto pt-4 px-2 no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxData.photos.map((pUrl, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() =>
                  setLightboxData({
                    ...lightboxData,
                    currentIndex: pIdx,
                  })
                }
                className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  lightboxData.currentIndex === pIdx
                    ? "border-orange-500 scale-105"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pUrl}
                  alt={`thumbnail ${pIdx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
