"use client";

import React, { useEffect, useState } from 'react';
import ClockCard from './ClockCard';

export default function LocalClockBlock() {
  const [mounted, setMounted] = useState(false);
  const [tz, setTz] = useState("");
  const [is24h, setIs24h] = useState(false);

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
      <div className="w-full max-w-[820px] h-[140px] rounded-3xl bg-[#1A1A1A] animate-pulse border border-white/5 mx-auto"></div>
    );
  }

  const locationName = tz.split('/').pop()?.replace(/_/g, ' ') || tz;

  return (
    <div className="w-full max-w-[820px] mx-auto animate-in fade-in duration-700">
      <div className="border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <ClockCard 
          locationLine={`${locationName} (Detected)`}
          tz={tz}
          is24h={is24h}
          onToggle24h={handleToggle}
        />
      </div>
    </div>
  );
}
