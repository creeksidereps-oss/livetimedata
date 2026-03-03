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
    const id = window.setInterval(() => setNow(new Date()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Get time parts in the target timezone (reliable across browsers)
  const parts = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: !is24h,
    });

    // Use formatToParts to avoid locale string parsing issues
    const p = fmt.formatToParts(now);
    const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
    const hourStr = get("hour");
    const minuteStr = get("minute");
    const secondStr = get("second");
    const dayPeriod = get("dayPeriod");

    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const second = Number(secondStr);

    return { hour, minute, second, dayPeriod };
  }, [now, tz, is24h]);

  // For analog clock math we want 0-23 hours in the tz
  const analogParts = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const p = fmt.formatToParts(now);
    const get = (type: string) => p.find((x) => x.type === type)?.value ?? "0";
    const h24 = Number(get("hour"));
    const m = Number(get("minute"));
    const s = Number(get("second"));
    return { h24, m, s };
  }, [now, tz]);

  const hour12 = ((analogParts.h24 % 12) + 12) % 12;

  // Smooth, correct hand angles
  const secondDeg = analogParts.s * 6; // 360/60
  const minuteDeg = (analogParts.m + analogParts.s / 60) * 6;
  const hourDeg = (hour12 + analogParts.m / 60 + analogParts.s / 3600) * 30; // 360/12

  const timeLine = useMemo(() => {
    // Digital time line displayed
    const h = String(parts.hour).padStart(2, "0");
    const m = String(parts.minute).padStart(2, "0");
    const s = String(parts.second).padStart(2, "0");
    const suffix = !is24h && parts.dayPeriod ? ` ${parts.dayPeriod.toUpperCase()}` : "";
    return `${h}:${m}:${s}${suffix}`;
  }, [parts, is24h]);

  return (
    <div className="w-full">
      <div className="rounded-2xl bg-black p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onToggle24h}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/90 hover:bg-white/10"
            title="Toggle 12/24 hour"
          >
            {is24h ? "24h" : "12h"}
          </button>

          <div className="text-xs text-white/70 truncate">{tz}</div>
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_140px] md:items-center">
          <div className="min-w-0">
            <div className="text-4xl font-semibold leading-none">{timeLine}</div>
            <div className="mt-2 text-sm text-white/85 truncate">{locationLine}</div>
            <div className="mt-1 text-xs text-white/60">Live</div>
          </div>

          {/* Analog */}
          <div className="relative mx-auto h-[140px] w-[140px] shrink-0">
            {/* Face */}
            <div className="absolute inset-0 rounded-full border border-white/20" />
            <div className="absolute inset-[10px] rounded-full border border-white/10" />

            {/* Ticks */}
            {Array.from({ length: 12 }).map((_, i) => {
              const rot = i * 30;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 h-[54px] w-[2px] -translate-x-1/2 -translate-y-full"
                  style={{ transform: `translate(-50%, -100%) rotate(${rot}deg) translateY(-8px)` }}
                >
                  <div className="h-[10px] w-[2px] rounded bg-white/35" />
                </div>
              );
            })}

            {/* Hands (IMPORTANT: transform-origin is bottom center, so no skew) */}
            <div className="absolute left-1/2 top-1/2 h-[44px] w-[4px] -translate-x-1/2 -translate-y-full">
              <div
                className="h-full w-full rounded bg-white/85"
                style={{
                  transformOrigin: "50% 100%",
                  transform: `rotate(${hourDeg}deg)`,
                }}
              />
            </div>

            <div className="absolute left-1/2 top-1/2 h-[58px] w-[3px] -translate-x-1/2 -translate-y-full">
              <div
                className="h-full w-full rounded bg-white/70"
                style={{
                  transformOrigin: "50% 100%",
                  transform: `rotate(${minuteDeg}deg)`,
                }}
              />
            </div>

            <div className="absolute left-1/2 top-1/2 h-[62px] w-[2px] -translate-x-1/2 -translate-y-full">
              <div
                className="h-full w-full rounded bg-white"
                style={{
                  transformOrigin: "50% 100%",
                  transform: `rotate(${secondDeg}deg)`,
                }}
              />
            </div>

            {/* Center cap */}
            <div className="absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}