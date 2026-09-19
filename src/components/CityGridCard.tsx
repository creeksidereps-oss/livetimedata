"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Props {
  city: {
    name: string;
    country: string;
    slug: string;
    timezone: string;
    latitude?: number;
    longitude?: number;
    admin1?: string;
    country_code?: string;
  };
  variant?: "dark" | "light";
}

export default function CityGridCard({ city, variant = "light" }: Props) {
  const [timeStr, setTimeStr] = useState("");
  const [weatherStr, setWeatherStr] = useState("--°");
  const cardRef = React.useRef<HTMLAnchorElement>(null);
  const isLight = variant === "light";

  useEffect(() => {
    const updateTime = () => {
      try {
        const str = new Intl.DateTimeFormat("en-US", {
          timeZone: city.timezone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        }).format(new Date());
        setTimeStr(str);
      } catch (e) {
        setTimeStr("");
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [city.timezone]);

  // Lazy-load Weather
  useEffect(() => {
    if (!city.latitude || !city.longitude) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current_weather=true&temperature_unit=fahrenheit`)
            .then(res => res.json())
            .then(data => {
              if (data?.current_weather?.temperature) {
                setWeatherStr(`${Math.round(data.current_weather.temperature)}°`);
              }
            })
            .catch(() => {});
          
          observer.disconnect(); // Only fetch once!
        }
      });
    }, { threshold: 0.1 });

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [city.latitude, city.longitude]);

  const queryParams = new URLSearchParams({
    name: city.name,
    lat: (city.latitude || 0).toString(),
    lon: (city.longitude || 0).toString(),
    timezone: city.timezone || "UTC",
    country: city.country || "",
    ...(city.admin1 && { admin1: city.admin1 }),
    ...(city.country_code && { country_code: city.country_code })
  });
  const href = `/time/${city.slug}?${queryParams.toString()}`;

  return (
    <Link ref={cardRef} href={href} className="group block h-full">
      <div className={`transition-all duration-300 rounded-2xl p-5 h-full flex flex-col justify-between hover:-translate-y-1 shadow-sm ${
        isLight
          ? "bg-white border border-slate-200 hover:border-blue-500 hover:shadow-xl"
          : "bg-[#1A1A1A] border border-white/10 hover:border-white/30 shadow-lg"
      }`}>
        
        <div className="text-center">
          <h3 className={`text-2xl font-black tracking-tight transition-colors ${
            isLight ? "text-slate-900 group-hover:text-blue-600" : "text-white"
          }`}>
            {city.name}
          </h3>
          <p className={`text-xs font-bold tracking-wide mt-1 truncate ${
            isLight ? "text-slate-600" : "text-slate-100"
          }`}>
            {city.admin1 ? `${city.admin1}, ` : ""}{city.country}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-6">
          {/* Time Button */}
          <div className={`flex-1 flex items-center justify-center rounded-xl py-2.5 px-2 transition-colors ${
            isLight 
              ? "bg-slate-50 border border-slate-200 group-hover:bg-blue-50 group-hover:border-blue-200 text-slate-900" 
              : "bg-[#1A1A1A] border border-white/10 text-white shadow-inner"
          }`}>
            <span className="text-xs font-black">
              {timeStr || "Loading..."}
            </span>
          </div>

          {/* Middle Flag */}
          <div className="flex shrink-0 items-center justify-center px-1">
             <img 
               src={`/assets/flags/${city.country.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')}.png`}
               alt={city.country}
               className="h-5 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity rounded-xs shadow-xs"
               onError={(e) => { e.currentTarget.style.display = 'none' }}
             />
          </div>

          {/* Weather Button */}
          <div className={`flex-1 flex items-center justify-center rounded-xl py-2.5 px-2 transition-colors ${
            isLight 
              ? "bg-slate-50 border border-slate-200 group-hover:bg-amber-50 group-hover:border-amber-200 text-slate-900" 
              : "bg-[#1A1A1A] border border-white/10 text-white shadow-inner"
          }`}>
            <span className="text-xs font-black">{weatherStr}</span>
          </div>
        </div>

      </div>
    </Link>
  );
}
