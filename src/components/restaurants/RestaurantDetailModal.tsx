"use client";

import React, { useState } from "react";
import { 
  X, 
  MapPin, 
  Phone, 
  ExternalLink, 
  ShoppingBag, 
  Utensils, 
  Calendar, 
  Heart, 
  Navigation, 
  Star, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  Check, 
  Share2, 
  Globe 
} from "lucide-react";
import { RestaurantItem } from "./types";

type RestaurantDetailModalProps = {
  restaurant: RestaurantItem;
  onClose: () => void;
  onOpenPhotoLightbox: (photos: string[], startIndex: number) => void;
};

export default function RestaurantDetailModal({
  restaurant,
  onClose,
  onOpenPhotoLightbox,
}: RestaurantDetailModalProps) {
  const [isSavedToBucketList, setIsSavedToBucketList] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Generate .ics calendar invite for dining
  const handleAddToCalendar = () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const title = `Dining at ${restaurant.name}`;
    const location = `${restaurant.address}`;
    const details = `${restaurant.tagline || ""}\nPhone: ${restaurant.phone || "N/A"}\nMenu: ${restaurant.menuUrl || "N/A"}`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${title}
DTSTART;VALUE=DATE:${today}
LOCATION:${location}
DESCRIPTION:${details.replace(/\n/g, "\\n")}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${restaurant.name.replace(/[^a-zA-Z0-9]/g, "_")}_dining.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${restaurant.name} ${restaurant.address}`
  )}`;

  const googleReviewsUrl =
    restaurant.googleReviewsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${restaurant.name} ${restaurant.address}`
    )}`;

  const hasPhotos = restaurant.photos && restaurant.photos.length > 0;
  const isNearby = (restaurant.distanceMiles || 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* MODAL HEADER                                             */}
        {/* ======================================================== */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {restaurant.isSponsored && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                  <Sparkles size={11} />
                  Featured Spotlight
                </span>
              )}
              {isNearby && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-500/20">
                  <Navigation size={10} />
                  {restaurant.cityName} · {restaurant.distanceMiles} mi away
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-black uppercase tracking-wider">
                {restaurant.primaryCuisine}
              </span>
              {restaurant.priceRange && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
                  {restaurant.priceRange}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">
              {restaurant.name}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Share link button */}
            <button
              type="button"
              onClick={handleShare}
              title="Share restaurant"
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              {copiedLink ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MODAL BODY (Scrollable)                                  */}
        {/* ======================================================== */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* 1. HERO PHOTO REEL (Clickable to Enlarge in Lightbox) */}
          {hasPhotos && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-0.5">
                <span className="uppercase tracking-wider text-[11px] font-bold">
                  Photo Gallery ({restaurant.photos.length})
                </span>
                <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">
                  Click any photo to enlarge
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {restaurant.photos.slice(0, 4).map((pUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenPhotoLightbox(restaurant.photos, idx)}
                    className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer group shadow-2xs hover:shadow-md transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pUrl}
                      alt={`${restaurant.name} photo ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />

                    {idx === 3 && restaurant.photos.length > 4 && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-2xs flex items-center justify-center text-white font-black text-sm">
                        +{restaurant.photos.length - 4} More
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. TAGLINE & ABOUT */}
          <div className="space-y-2">
            {restaurant.tagline && (
              <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 italic border-l-3 border-orange-500 pl-3 py-0.5">
                "{restaurant.tagline}"
              </p>
            )}

            {restaurant.description && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {restaurant.description}
              </p>
            )}
          </div>

          {/* 3. KEY METRICS & REVIEWS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            {/* Google Ratings & Reviews Button */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-1.5 text-amber-500">
                <Star size={18} className="fill-amber-400" />
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {restaurant.rating || "4.8"}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  ({restaurant.reviewCount || 120} reviews)
                </span>
              </div>

              <a
                href={googleReviewsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 ml-auto sm:ml-2"
              >
                <span>Google Reviews</span>
                <ExternalLink size={11} />
              </a>
            </div>

            {/* Operating Hours */}
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 sm:justify-end">
              <Clock size={14} className="text-slate-400 shrink-0" />
              <span className="font-medium">{restaurant.hours || "Open Daily"}</span>
            </div>
          </div>

          {/* 4. ADDRESS & CONTACT INFO */}
          <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5">
              <MapPin size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <span>{restaurant.address}</span>
            </div>

            {restaurant.phone && (
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="text-slate-400 shrink-0" />
                <a
                  href={`tel:${restaurant.phone.replace(/[^0-9]/g, "")}`}
                  className="hover:text-orange-500 transition-colors font-semibold"
                >
                  {restaurant.phone}
                </a>
              </div>
            )}
          </div>

          {/* 5. CUISINE / HIGHLIGHT TAGS */}
          {restaurant.cuisines.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {restaurant.cuisines.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                >
                  #{c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* MODAL ACTION TOOLBAR                                     */}
        {/* ======================================================== */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center gap-2">
          {/* Order Now (Affiliate / Delivery) */}
          {restaurant.orderUrl && (
            <a
              href={restaurant.orderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs"
            >
              <ShoppingBag size={14} />
              <span>Order Now</span>
            </a>
          )}

          {/* View Menu */}
          {restaurant.menuUrl && (
            <a
              href={restaurant.menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs"
            >
              <Utensils size={13} className="text-orange-500" />
              <span>View Menu</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          )}

          {/* Reserve a Table (OpenTable / Resy) */}
          {restaurant.reservationUrl && (
            <a
              href={restaurant.reservationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Calendar size={13} />
              <span>Reserve Table</span>
              <ExternalLink size={11} className="opacity-70" />
            </a>
          )}

          {/* Get Directions (Google Maps from user location) */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all"
          >
            <Navigation size={13} className="text-blue-500" />
            <span>Map & Directions</span>
          </a>

          {/* Add to Bucket List (Interactive Toggle) */}
          <button
            type="button"
            onClick={() => setIsSavedToBucketList(!isSavedToBucketList)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isSavedToBucketList
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            <Heart
              size={13}
              className={isSavedToBucketList ? "fill-rose-500 text-rose-500" : "text-slate-400"}
            />
            <span>{isSavedToBucketList ? "Saved in Bucket List ❤️" : "Add to Bucket List"}</span>
          </button>

          {/* Add to Calendar */}
          <button
            type="button"
            onClick={handleAddToCalendar}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <Calendar size={13} className="text-slate-400" />
            <span>Add to Calendar</span>
          </button>

          {/* Official Website */}
          {restaurant.websiteUrl && (
            <a
              href={restaurant.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-medium transition-all ml-auto"
            >
              <Globe size={13} />
              <span>Website</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
