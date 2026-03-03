"use client";

import { useEffect, useMemo, useState } from "react";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatTime(date: Date, tz: string, is24h: boolean) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !is24h,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const hour = parts.hour || "00";
  const minute = parts.minute || "00";
  const second = parts.second || "00";
  const dayPeriod = parts.dayPeriod || "";

  return { hour, minute, second, dayPeriod };
}

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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { hour, minute, second, dayPeriod } = useMemo(() => formatTime(now, tz, is24h), [now, tz, is24h]);

  // Use *numeric* parts for clock math
  const hh = Number(hour) % 12;
  const mm = Number(minute);
  const ss = Number(second);

  // Angles
  const secDeg = ss * 6; // 360/60
  const minDeg = (mm + ss / 60) * 6;
  const hourDeg = (hh + mm / 60 + ss / 3600) * 30; // 360/12

  const timeText = is24h ? `${hour}:${minute}:${second}` : `${hour}:${minute}:${second}`;
  const ampmText = is24h ? "" : dayPeriod;

  return (
    <div className="w-full rounded-2xl bg-black text-white p-6">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onToggle24h}
          className="rounded-full border border-white/30 px-3 py-1 text-xs text-white/90 hover:bg-white/10"
          title="Toggle 12h/24h"
        >
          {is24h ? "24h" : "12h"}
        </button>

        <div className="text-xs text-white/60 truncate">{tz}</div>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_170px] items-center gap-6">
        <div className="min-w-0">
          <div className="text-5xl font-semibold leading-none">
            {hour}:{minute}:{second}
          </div>

          {!is24h && <div className="mt-1 text-3xl font-semibold leading-none">{ampmText}</div>}

          <div className="mt-4 text-sm text-white/85 truncate">{locationLine}</div>
          <div className="mt-1 text-xs text-white/55">Live</div>
        </div>

        {/* Clock face (SVG rotate around center using SVG transform, not CSS) */}
        <div className="justify-self-end">
          <svg
            width="170"
            height="170"
            viewBox="0 0 100 100"
            className="block"
            aria-label="Analog clock"
          >
            {/* Outer ring */}
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

            {/* Hour ticks */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = i * 30;
              return (
                <line
                  key={i}
                  x1="50"
                  y1="10"
                  x2="50"
                  y2="16"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.2"
                  transform={`rotate(${a} 50 50)`}
                />
              );
            })}

            {/* Minute ticks (every 5 only, subtle) */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = i * 30 + 15;
              return (
                <line
                  key={`m-${i}`}
                  x1="50"
                  y1="12"
                  x2="50"
                  y2="14"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="0.8"
                  transform={`rotate(${a} 50 50)`}
                />
              );
            })}

            {/* Hour hand */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="28"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="3.2"
              strokeLinecap="round"
              transform={`rotate(${hourDeg} 50 50)`}
            />

            {/* Minute hand */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="20"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="2.2"
              strokeLinecap="round"
              transform={`rotate(${minDeg} 50 50)`}
            />

            {/* Second hand */}
            <line
              x1="50"
              y1="53"
              x2="50"
              y2="16"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="1.2"
              strokeLinecap="round"
              transform={`rotate(${secDeg} 50 50)`}
            />

            {/* Center dot */}
            <circle cx="50" cy="50" r="2.2" fill="white" />
          </svg>
        </div>
      </div>
    </div>
  );
}