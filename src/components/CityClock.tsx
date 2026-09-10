"use client";

import { useEffect, useMemo, useState } from "react";

type CityClockProps = {
  cityName: string;
  timezone: string;
  countryCode?: string;
  onOpenOnThisDay?: () => void;
  onOpenHoliday?: () => void;
};

function formatDateParts(date: Date, timezone: string, hour12: boolean) {
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12,
  });

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const parts = timeFormatter.formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "--";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "--";
  const second = parts.find((p) => p.type === "second")?.value ?? "--";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";

  return {
    hour,
    minute,
    second,
    dayPeriod,
    fullDate: dateFormatter.format(date),
  };
}

function getAnalogAngles(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const second = Number(parts.find((p) => p.type === "second")?.value ?? 0);

  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const minuteAngle = minute * 6 + second * 0.1;
  const secondAngle = second * 6;

  return { hourAngle, minuteAngle, secondAngle };
}

export default function CityClock({ cityName, timezone, countryCode = "US", onOpenOnThisDay, onOpenHoliday }: CityClockProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [hour12, setHour12] = useState(true);
  const [holiday, setHoliday] = useState<string | null>(null);

  useEffect(() => {
    // Dynamic International Holiday Fetching
    const fetchHolidays = async () => {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
        if (res.ok) {
          const text = await res.text();
          if (text) {
            const holidays: any[] = JSON.parse(text);
            
            // Adjust 'today' to the local timezone of the city so it aligns correctly without UTC rollover
            const todayIso = new Intl.DateTimeFormat("en-CA", {
              timeZone: timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date());
            const todayHoliday = holidays.find(h => h.date === todayIso);
            
            if (todayHoliday) {
              setHoliday(todayHoliday.localName);
            } else {
              setHoliday(null);
            }
          }
        } else {
          setHoliday(null);
        }
      } catch (err) {
        // Silently fail if API is unreachable or returns malformed JSON
      }
    };
    fetchHolidays();
  }, [countryCode, timezone]);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const saved = window.localStorage.getItem("ltd-hour12");
    if (saved === "false") setHour12(false);
    if (saved === "true") setHour12(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("ltd-hour12", String(hour12));
  }, [hour12, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [mounted]);

  const display = useMemo(() => {
    if (!now) {
      return {
        hour: "--",
        minute: "--",
        second: "--",
        dayPeriod: "",
        fullDate: "---",
      };
    }

    return formatDateParts(now, timezone, hour12);
  }, [now, timezone, hour12]);

  const analog = useMemo(() => {
    if (!now) {
      return { hourAngle: 0, minuteAngle: 0, secondAngle: 0 };
    }

    return getAnalogAngles(now, timezone);
  }, [now, timezone]);

  const dayName = useMemo(() => {
    if (!now) return "---";
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(now);
  }, [now, timezone]);

  return (
    <section className="bg-black text-white rounded-[14px] py-4 px-4 md:px-9 md:py-5 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1.4fr] items-center gap-3 md:gap-0 shadow-[0_10px_40px_rgba(0,0,0,0.7)] min-h-[110px] mb-2.5 border border-white/10">
      <div className="flex flex-col items-center md:items-start text-center md:text-left">
        <div className="flex items-center gap-2.5 mb-1.5 md:mb-1">
          <span className="text-[10px] md:text-[11px] font-black text-slate-400 tracking-[0.15em]">
            {cityName.toUpperCase()} TIME
          </span>

          <div className="inline-flex border-[1.5px] border-white rounded-full overflow-hidden h-5 md:h-6">
            <button
              onClick={() => setHour12(true)}
              style={{
                border: "none",
                background: hour12 ? "#ffffff" : "transparent",
                color: hour12 ? "#000000" : "#ffffff",
                padding: "0 8px",
                fontSize: "9px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              12H
            </button>
            <button
              onClick={() => setHour12(false)}
              style={{
                border: "none",
                background: !hour12 ? "#ffffff" : "transparent",
                color: !hour12 ? "#000000" : "#ffffff",
                padding: "0 8px",
                fontSize: "9px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              24H
            </button>
          </div>
        </div>

        <div className="text-[40px] md:text-[62px] font-bold leading-[0.9] md:leading-[0.8] tracking-[-0.04em] text-white flex items-end justify-center md:justify-start">
          <span>{display.hour}:{display.minute}</span>
          <span className="text-[16px] md:text-[22px] text-white ml-2 md:ml-2.5 font-medium mb-0.5 md:mb-0">{display.second}</span>
          {hour12 && <span className="text-[14px] md:text-[20px] ml-2 font-medium text-white mb-0.5 md:mb-0">{display.dayPeriod}</span>}
        </div>

        {holiday && (
          <button 
            onClick={() => {
              if (onOpenHoliday) onOpenHoliday();
            }}
            style={{ 
              marginTop: "10px", background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: "15px", fontWeight: 900, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.15em",
              textDecoration: "underline", textUnderlineOffset: "4px"
            }}
            className="md:text-left text-center"
          >
            {holiday}
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5 md:gap-1 mt-1 md:mt-0">
        <div className="text-[14px] md:text-[18px] font-normal text-white uppercase tracking-[0.2em]">{dayName}</div>
        <div className="text-[11px] md:text-[14px] font-bold text-white uppercase tracking-[0.1em] mb-1.5 md:mb-2">{display.fullDate}</div>
        <button
          onClick={() => {
            if (onOpenOnThisDay) onOpenOnThisDay();
          }}
          style={{
            background: "#2563eb",
            color: "white",
            padding: "6px 20px",
            borderRadius: "999px",
            fontSize: "10px",
            fontWeight: 900,
            textTransform: "uppercase",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 0 25px rgba(37, 99, 235, 0.4)"
          }}
        >
          On This Day
        </button>
      </div>

      <div className="hidden md:block justify-self-end relative w-[120px] h-[120px]">
        <div style={{ position: "relative", width: "120px", height: "120px", borderRadius: "50%", border: "2.5px solid #ffffff", background: "#0f172a" }}>
          {[12, 3, 6, 9].map((num) => (
            <span key={num} style={{
              position: "absolute", fontSize: "12px", fontWeight: 900, color: "#ffffff",
              transform: "translate(-50%, -50%)",
              left: num === 3 ? "86%" : num === 9 ? "14%" : "50%",
              top: num === 12 ? "14%" : num === 6 ? "86%" : "50%"
            }}>{num}</span>
          ))}

          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ 
                position: "absolute", left: "50%", top: "50%", 
                width: "2px", height: i % 3 === 0 ? "10px" : "6px", 
                background: i % 3 === 0 ? "#ffffff" : "#94a3b8", 
                transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-48px)`,
                borderRadius: "999px"
              }}
            />
          ))}

          <div style={{ position: "absolute", left: "50%", top: "50%", width: "5px", height: "30px", background: "#ffffff", borderRadius: "999px", transform: `translate(-50%, -100%) rotate(${analog.hourAngle}deg)`, transformOrigin: "bottom center" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: "3px", height: "45px", background: "#cbd5e1", borderRadius: "999px", transform: `translate(-50%, -100%) rotate(${analog.minuteAngle}deg)`, transformOrigin: "bottom center" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: "2px", height: "48px", background: "#38bdf8", borderRadius: "999px", transform: `translate(-50%, -100%) rotate(${analog.secondAngle}deg)`, transformOrigin: "bottom center" }} />
          
          <div style={{ position: "absolute", left: "50%", top: "50%", width: "12px", height: "12px", background: "#ffffff", borderRadius: "50%", transform: "translate(-50%, -50%)", border: "2px solid #000" }} />
        </div>
        
        {/* Timezone Label Added Underneath Analogue Face */}
        <div style={{ 
          marginTop: "8px", 
          textAlign: "center", 
          fontSize: "9px", 
          fontWeight: 900, 
          color: "#94a3b8", 
          textTransform: "uppercase", 
          letterSpacing: "0.1em" 
        }}>
          {timezone.replace(/_/g, ' ')}
        </div>
      </div>
    </section>
  );
}