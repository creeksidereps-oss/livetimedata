"use client";

import { useEffect, useMemo, useState } from "react";

export default function ClockCard({
  locationLine,
  tz,
  is24h,
  onToggle24h,
}: {
  locationLine: string;
  tz: string;
  is24h: boolean;
  onToggle24h: () => void;
}) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeText = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: !is24h,
      }).format(now);
    } catch {
      return now.toLocaleTimeString();
    }
  }, [now, tz, is24h]);

  const hoursMinutes = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
      return { h, m };
    } catch {
      return { h: now.getHours(), m: now.getMinutes() };
    }
  }, [now, tz]);

  const { h, m } = hoursMinutes;
  const hourAngle = ((h % 12) + m / 60) * 30; // 360/12
  const minuteAngle = m * 6; // 360/60

  return (
    <div className="w-full rounded-2xl bg-black p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onToggle24h}
          className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white/90 hover:bg-white/10"
          title="Toggle 12h / 24h"
        >
          {is24h ? "24h" : "12h"}
        </button>

        <div className="text-xs text-white/70">{tz}</div>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_120px] items-center gap-4">
        <div className="min-w-0">
          <div className="text-5xl font-semibold leading-none">{timeText}</div>
          <div className="mt-3 truncate text-sm text-white/80">{locationLine}</div>
          <div className="mt-1 text-xs text-white/60">Live</div>
        </div>

        <div className="flex justify-end">
          <div className="relative h-[110px] w-[110px] rounded-full border border-white/20">
            {/* ticks */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 h-[2px] w-[6px] -translate-x-1/2 -translate-y-1/2 bg-white/40"
                style={{ transform: `translate(-50%, -50%) rotate(${i * 30}deg) translate(46px)` }}
              />
            ))}

            {/* hour hand */}
            <div
              className="absolute left-1/2 top-1/2 h-[32px] w-[3px] -translate-x-1/2 -translate-y-[28px] origin-bottom rounded bg-white/90"
              style={{ transform: `translate(-50%, -100%) rotate(${hourAngle}deg)` }}
            />

            {/* minute hand */}
            <div
              className="absolute left-1/2 top-1/2 h-[44px] w-[2px] -translate-x-1/2 -translate-y-[40px] origin-bottom rounded bg-white/70"
              style={{ transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)` }}
            />

            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}