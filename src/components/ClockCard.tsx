"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  locationLine: string;
  tz: string;
  is24h: boolean;
  onToggle24h: () => void;
  variant?: "dark" | "light";
};

function getTimePartsInTz(tz: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { h: get("hour"), m: get("minute"), s: get("second") };
}

function formatDigital(tz: string, is24h: boolean, date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: !is24h,
  }).format(date);
}

function formatMonthDay(tz: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDayOfWeek(tz: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
  }).format(date);
}

function formatFullDate(tz: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export default function ClockCard({ locationLine, tz, is24h, onToggle24h, variant = "dark" }: Props) {
  const [now, setNow] = useState(() => new Date());
  const isLight = variant === "light";

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const digital = useMemo(() => formatDigital(tz, is24h, now), [tz, is24h, now]);
  const dateStrShort = useMemo(() => formatMonthDay(tz, now), [tz, now]);
  const dayName = useMemo(() => formatDayOfWeek(tz, now), [tz, now]);
  const fullDateStr = useMemo(() => formatFullDate(tz, now), [tz, now]);
  const { h, m, s } = useMemo(() => getTimePartsInTz(tz, now), [tz, now]);

  // analog angles
  const hour = h % 12;
  const hourAngle = (hour + m / 60 + s / 3600) * 30;
  const minAngle = (m + s / 60) * 6;
  const secAngle = s * 6;

  return (
    <div className={`w-full max-w-[820px] overflow-hidden rounded-3xl transition-all ${
      isLight 
        ? "bg-white text-slate-900 border border-slate-200/80 shadow-md" 
        : "bg-black text-white shadow-sm"
    }`}>
      <div className="flex items-center justify-between px-5 pt-3.5">
        
        {/* Real Toggle UI */}
        <div className={`flex rounded-full p-[2px] border ${
          isLight 
            ? "bg-slate-100 border-slate-200" 
            : "bg-white/10 border-white/10"
        }`}>
          <button 
            type="button"
            onClick={onToggle24h} 
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              !is24h 
                ? (isLight ? "bg-white text-slate-950 shadow-xs" : "bg-white text-black shadow-sm") 
                : (isLight ? "text-slate-500 hover:text-slate-900" : "text-white/50 hover:text-white")
            }`}
          >
            12h
          </button>
          <button 
            type="button"
            onClick={onToggle24h} 
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              is24h 
                ? (isLight ? "bg-white text-slate-950 shadow-xs" : "bg-white text-black shadow-sm") 
                : (isLight ? "text-slate-500 hover:text-slate-900" : "text-white/50 hover:text-white")
            }`}
          >
            24h
          </button>
        </div>

        <div className={`text-xs font-bold tracking-wider uppercase ${isLight ? "text-slate-400" : "text-white/40"}`}>
          {tz}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-6 pb-5 pt-2">
        <div className="min-w-0 text-center md:text-left">
          <div className={`text-4xl md:text-5xl font-black tracking-tight ${isLight ? "text-slate-950" : "text-white"}`}>
            {digital}
          </div>
          <div className={`mt-1 truncate text-sm font-bold ${isLight ? "text-slate-700" : "text-white/80"}`}>
            {locationLine}
          </div>
          <div className="mt-1">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isLight 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                : "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live Time
            </span>
          </div>
        </div>

        {/* Center: Day & Date */}
        <div className="flex flex-col items-center justify-center text-center md:-mt-2">
          <div className={`text-2xl tracking-[0.25em] font-black uppercase ${isLight ? "text-amber-600" : "text-white/90"}`}>
            {dayName}
          </div>
          <div className={`text-xl font-extrabold uppercase mt-1 tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
            {fullDateStr}
          </div>
        </div>

        <div className="shrink-0">
          <svg width="112" height="112" viewBox="0 0 120 120" aria-label="Analog clock">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={isLight ? "#0f172a" : "#ffffff"}
              strokeWidth="2.5"
            />

            <circle cx="60" cy="60" r="3.2" fill={isLight ? "#0f172a" : "#ffffff"} />

            {/* Clock Numbers */}
            <text x="60" y="20" textAnchor="middle" fill={isLight ? "#0f172a" : "#ffffff"} fontSize="12" fontWeight="900">12</text>
            <text x="106" y="64" textAnchor="middle" fill={isLight ? "#0f172a" : "#ffffff"} fontSize="12" fontWeight="900">3</text>
            <text x="60" y="108" textAnchor="middle" fill={isLight ? "#0f172a" : "#ffffff"} fontSize="12" fontWeight="900">6</text>
            <text x="14" y="64" textAnchor="middle" fill={isLight ? "#0f172a" : "#ffffff"} fontSize="12" fontWeight="900">9</text>

            {Array.from({ length: 12 }).map((_, i) => {
              if (i % 3 === 0) return null; // Skip drawing tick marks where the numbers 12, 3, 6, 9 are
              
              const a = (i * 30 * Math.PI) / 180;
              const x1 = 60 + Math.sin(a) * 45;
              const y1 = 60 - Math.cos(a) * 45;
              const x2 = 60 + Math.sin(a) * 52;
              const y2 = 60 - Math.cos(a) * 52;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isLight ? "#64748b" : "#ffffff"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity={isLight ? "0.6" : "0.9"}
                />
              );
            })}

            <g transform={`rotate(${hourAngle} 60 60)`}>
              <line
                x1="60"
                y1="60"
                x2="60"
                y2="34"
                stroke={isLight ? "#0f172a" : "white"}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.95"
              />
            </g>

            <g transform={`rotate(${minAngle} 60 60)`}>
              <line
                x1="60"
                y1="60"
                x2="60"
                y2="26"
                stroke={isLight ? "#1e293b" : "white"}
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.9"
              />
            </g>

            <g transform={`rotate(${secAngle} 60 60)`}>
              <line
                x1="60"
                y1="62"
                x2="60"
                y2="22"
                stroke={isLight ? "#f59e0b" : "rgba(255,255,255,0.7)"}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}