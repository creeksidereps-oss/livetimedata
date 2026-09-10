"use client";

import { useEffect, useMemo, useState } from "react";

type WeatherPanelsProps = {
  current: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  } | null;
  daily: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  } | null;
  unitPreference?: "f" | "c";
  onUnitChange?: (unit: "f" | "c") => void;
};

function cToF(c: number) { return (c * 9) / 5 + 32; }

function weatherLabel(code: number | undefined) {
  if (code === undefined || code === null) return "Unknown";
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if (code === 95) return "Thunderstorm";
  return "Unknown";
}

function weatherSymbol(code: number | undefined) {
  if (code === undefined || code === null) return "";
  if (code === 0) return "☀️"; 
  if ([1, 2].includes(code)) return "⛅"; 
  if (code === 3) return "☁️"; 
  if ([45, 48].includes(code)) return "🌫️";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "💧"; 
  if ([71, 73, 75, 85, 86].includes(code)) return "❄️"; 
  if (code === 95) return "⚡"; 
  return "";
}

function getIconColor(code: number | undefined) {
  if (code === undefined || code === null) return "#000000";
  if (code === 0) return "#f59e0b";
  if ([1, 2].includes(code)) return "#f59e0b"; 
  if (code === 3) return "#64748b"; 
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "#3b82f6"; 
  return "#000000";
}

function formatDayLabel(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function formatDateLabel(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function fmtTemp(val: number | undefined, unit: "c" | "f") {
  if (val === undefined || val === null) return "--";
  return `${Math.round(unit === "c" ? val : cToF(val))}°`;
}

function filterForecastFromToday(daily: WeatherPanelsProps["daily"]) {
  if (!daily?.time || !daily?.weather_code || !daily?.temperature_2m_max || !daily?.temperature_2m_min) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let startIndex = daily.time.findIndex((dateString) => {
    const date = new Date(`${dateString}T00:00:00`);
    return date >= today;
  });
  if (startIndex < 0) startIndex = 0;
  return {
    time: daily.time.slice(startIndex),
    weather_code: daily.weather_code.slice(startIndex),
    temperature_2m_max: daily.temperature_2m_max.slice(startIndex),
    temperature_2m_min: daily.temperature_2m_min.slice(startIndex),
  };
}

export default function WeatherPanels({ current, daily, unitPreference, onUnitChange }: WeatherPanelsProps) {
  const [internalUnit, setInternalUnit] = useState<"c" | "f">("c");
  const [forecastOpen, setForecastOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("ltd-temp-unit");
    if (saved === "f" || saved === "c") {
      setInternalUnit(saved);
      if (onUnitChange) onUnitChange(saved);
    }
  }, [onUnitChange]);

  const unit = unitPreference || internalUnit;
  const setUnit = (u: "c" | "f") => {
    setInternalUnit(u);
    if (onUnitChange) onUnitChange(u);
    window.localStorage.setItem("ltd-temp-unit", u);
  };

  const filteredDaily = useMemo(() => filterForecastFromToday(daily), [daily]);
  const canRenderForecast = useMemo(() => !!filteredDaily?.time && !!filteredDaily?.weather_code, [filteredDaily]);

  const panelStyle: React.CSSProperties = {
    border: "2px solid #cbd5e1", borderRadius: "12px", padding: "4px 14px", // Squeezed padding
    background: "#ffffff", boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
    minHeight: "58px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center"
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col sm:flex-row gap-2">
        <section style={panelStyle}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Temperature</h2>
              <div className="text-3xl font-black text-black leading-none">{fmtTemp(current?.temperature_2m, unit)}{unit.toUpperCase()}</div>
            </div>
            <div className="inline-flex border-2 border-black rounded-full overflow-hidden h-7 shrink-0">
              <button onClick={() => setUnit(unit === "c" ? "f" : "c")} className={`px-4 text-[11px] font-black cursor-pointer ${unit === 'f' ? 'bg-black text-white' : 'bg-white text-black'}`}>°F</button>
              <button onClick={() => setUnit(unit === "c" ? "f" : "c")} className={`px-4 text-[11px] font-black cursor-pointer ${unit === 'c' ? 'bg-black text-white' : 'bg-white text-black'}`}>°C</button>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '32px', color: getIconColor(current?.weather_code), fontWeight: 'bold' }}>
                {weatherSymbol(current?.weather_code)}
              </span>
              <div>
                <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Conditions</h2>
                <span className="text-sm font-black text-gray-800 tabular-nums tracking-tighter">{weatherLabel(current?.weather_code)}</span>
              </div>
            </div>
            <div className="flex gap-4 sm:gap-5 pl-4 sm:pl-5 border-l-2 border-slate-200 shrink-0">
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-600 uppercase">Wind</p>
                <p className="text-[12px] font-black text-black">{current?.wind_speed_10m} <span className="text-[9px]">km/h</span></p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-600 uppercase">Hum</p>
                <p className="text-[12px] font-black text-black">{current?.relative_humidity_2m}%</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white border-2 border-slate-300 rounded-xl px-4 py-2 shadow-md relative transition-all">
        <button
          type="button"
          onClick={() => setForecastOpen((prev) => !prev)}
          className="w-full flex justify-between items-center cursor-pointer py-1 group select-none text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
              {forecastOpen ? "10-Day Forecast" : "Click for 10-Day Forecast"}
            </span>
            {!forecastOpen && (
              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Tap to Expand
              </span>
            )}
          </div>
          <span className="text-xs font-black text-slate-500 group-hover:text-black transition-transform">
            {forecastOpen ? "▲ Close" : "▼ Open"}
          </span>
        </button>

        {forecastOpen && (
          <div className="mt-2 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
            {canRenderForecast ? (
              <div 
                className="grid grid-flow-col auto-cols-[calc(50%-8px)] sm:auto-cols-[calc(33.333%-8px)] md:auto-cols-[calc(20%-8px)] gap-2 overflow-x-auto pb-2 scroll-smooth custom-scrollbar"
              >
                {filteredDaily!.time!.map((dateString, idx) => (
                  <div key={dateString} className="bg-slate-50 border-2 border-slate-200 rounded-lg p-2 text-center flex flex-col items-center min-w-0">
                    <div className="text-[11px] font-black text-black uppercase border-b-2 border-slate-300 w-full pb-1 mb-1">{formatDayLabel(dateString)}</div>
                    <div className="text-[9px] font-black text-slate-700 uppercase mb-1">{formatDateLabel(dateString)}</div>
                    <span style={{ fontSize: '28px', margin: '2px 0', color: getIconColor(filteredDaily!.weather_code![idx]) }}>
                       {weatherSymbol(filteredDaily!.weather_code![idx])}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-[12px] font-black text-gray-800 text-center tracking-tighter tabular-nums mt-0.5 whitespace-nowrap">
                        {unit === "f" ? Math.round(cToF(filteredDaily!.temperature_2m_max![idx])) : Math.round(filteredDaily!.temperature_2m_max![idx])}°{unit.toUpperCase()} <span className="text-[10px] font-bold text-gray-400">/ {unit === "f" ? Math.round(cToF(filteredDaily!.temperature_2m_min![idx])) : Math.round(filteredDaily!.temperature_2m_min![idx])}°</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-[11px] font-black text-slate-900 py-3 text-center">Syncing data...</p>}
          </div>
        )}
        
        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar { height: 6px; } /* Shorter Scrollbar */
          .custom-scrollbar::-webkit-scrollbar-track { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #000000; border-radius: 10px; }
        `}</style>
      </section>
    </div>
  );
}