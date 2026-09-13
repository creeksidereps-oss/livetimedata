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
}

export default function CityGridCard({ city }: Props) {
  const [timeStr, setTimeStr] = useState("");
  const [weatherStr, setWeatherStr] = useState("--°");
  const cardRef = React.useRef<HTMLAnchorElement>(null);

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
      <div className="bg-[#1A1A1A] border border-white/10 hover:border-white/30 transition-all duration-300 rounded-2xl p-5 h-full flex flex-col justify-between hover:-translate-y-1 shadow-lg">
        
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white tracking-tight">{city.name}</h3>
          <p className="text-sm font-semibold text-slate-100 tracking-wide mt-1">{city.name}, {city.country}</p>
        </div>

        <div className="flex items-center justify-center gap-3 mt-8">
          {/* Time Button */}
          <div className="flex-1 flex items-center justify-center bg-[#1A1A1A] border border-white/10 rounded-xl py-3 shadow-inner">
            <span className="text-sm font-bold text-white">
              {timeStr || "Loading..."}
            </span>
          </div>

          {/* Middle Flag */}
          <div className="flex shrink-0 items-center justify-center px-1">
             <img 
               src={`/assets/flags/${city.country.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')}.png`}
               alt={city.country}
               className="h-5 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
               onError={(e) => { e.currentTarget.style.display = 'none' }}
             />
          </div>

          {/* Weather Button */}
          <div className="flex-1 flex items-center justify-center bg-[#1A1A1A] border border-white/10 rounded-xl py-3 shadow-inner">
            <span className="text-sm font-bold text-white">{weatherStr}</span>
          </div>
        </div>

      </div>
    </Link>
  );
}
