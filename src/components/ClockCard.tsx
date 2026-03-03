"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  locationLine: string;
  tz: string;
  is24h: boolean;
  onToggle24h: () => void;
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

export default function ClockCard({ locationLine, tz, is24h, onToggle24h }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const digital = useMemo(() => formatDigital(tz, is24h, now), [tz, is24h, now]);
  const { h, m, s } = useMemo(() => getTimePartsInTz(tz, now), [tz, now]);

  // analog angles
  const hour = h % 12;
  const hourAngle = (hour + m / 60 + s / 3600) * 30;
  const minAngle = (m + s / 60) * 6;
  const secAngle = s * 6;

  return (
    <div className="w-full max-w-[820px] overflow-hidden rounded-3xl bg-black text-white shadow-sm">
      {/* Header row (no overlap) */}
      <div className="flex items-center justify-between px-5 pt-4">
        <button
          type="button"
          onClick={onToggle24h}
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15"
          aria-label="Toggle 12/24 hour format"
          title="Toggle 12/24"
        >
          {is24h ? "24h" : "12h"}
        </button>

        <div className="text-xs text-white/60">{tz}</div>
      </div>

      {/* Main content */}
      <div className="flex items-center justify-between gap-6 px-5 pb-5 pt-3">
        <div className="min-w-0">
          <div className="text-5xl font-semibold tracking-tight">{digital}</div>
          <div className="mt-2 truncate text-sm text-white/80">{locationLine}</div>
          <div className="mt-1 text-xs text-white/60">Live</div>
        </div>

        <div className="shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-label="Analog clock">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="2"
            />
            <circle cx="60" cy="60" r="2.8" fill="white" opacity="0.9" />

            {Array.from({ length: 12 }).map((_, i) => {
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
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              );
            })}

            <g transform={`rotate(${hourAngle} 60 60)`}>
              <line
                x1="60"
                y1="60"
                x2="60"
                y2="34"
                stroke="white"
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
                stroke="white"
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
                stroke="rgba(255,255,255,0.7)"
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