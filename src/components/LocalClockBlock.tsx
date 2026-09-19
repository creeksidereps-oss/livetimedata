"use client";

import React, { useEffect, useState } from 'react';
import ClockCard from './ClockCard';

export default function LocalClockBlock({ variant = "light" }: { variant?: "dark" | "light" }) {
  const [mounted, setMounted] = useState(false);
  const [tz, setTz] = useState("");
  const [is24h, setIs24h] = useState(false);
  const isLight = variant === "light";

  useEffect(() => {
    // 1. Detect timezone
    try {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTz(detectedTz);
    } catch (e) {
      setTz("UTC");
    }

    // 2. Read saved 12h/24h preference
    const savedPref = localStorage.getItem("timeFormatPref");
    if (savedPref === "24h") {
      setIs24h(true);
    }

    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newVal = !is24h;
    setIs24h(newVal);
    localStorage.setItem("timeFormatPref", newVal ? "24h" : "12h");
  };

  if (!mounted || !tz) {
    return (
      <div className={`w-full max-w-[820px] h-[140px] rounded-3xl animate-pulse mx-auto ${
        isLight ? "bg-slate-100 border border-slate-200" : "bg-[#1A1A1A] border border-white/5"
      }`} />
    );
  }

  const locationName = tz.split('/').pop()?.replace(/_/g, ' ') || tz;

  return (
    <div className="w-full max-w-[820px] mx-auto animate-in fade-in duration-700">
      <div className={`rounded-3xl overflow-hidden shadow-sm ${
        isLight ? "border border-slate-200" : "border border-white/10 shadow-2xl"
      }`}>
        <ClockCard 
          locationLine={`${locationName} (Your Local Time)`}
          tz={tz}
          is24h={is24h}
          onToggle24h={handleToggle}
          variant={variant}
        />
      </div>
    </div>
  );
}
