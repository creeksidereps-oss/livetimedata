"use client";

import { useEffect, useState } from "react";

const LOCK_KEY = "LTD_GLOBAL_UNIT_PREF";

export default function TempUnitToggle({ onChange }: { onChange: (unit: "f" | "c") => void }) {
  const [unit, setUnit] = useState<"f" | "c">("c");

  useEffect(() => {
    // Immediate check of browser memory
    const saved = window.localStorage.getItem(LOCK_KEY) as "f" | "c" | null;
    if (saved) {
      setUnit(saved);
      onChange(saved);
    }
  }, [onChange]);

  const handleToggle = (next: "f" | "c") => {
    setUnit(next);
    window.localStorage.setItem(LOCK_KEY, next);
    onChange(next);
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 p-1 bg-white shadow-sm shrink-0">
      <button
        type="button"
        onClick={() => handleToggle("f")}
        className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase transition-all ${unit === "f" ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
      >
        °F
      </button>
      <button
        type="button"
        onClick={() => handleToggle("c")}
        className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase transition-all ${unit === "c" ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
      >
        °C
      </button>
    </div>
  );
}