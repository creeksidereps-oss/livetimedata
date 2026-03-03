"use client";

import { useEffect, useState } from "react";

const KEY = "tempUnit"; // "f" | "c"

export default function TempUnitToggle({
  onChange,
}: {
  onChange: (unit: "f" | "c") => void;
}) {
  const [unit, setUnit] = useState<"f" | "c">("f");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as "f" | "c" | null) ?? null;
    if (saved === "f" || saved === "c") {
      setUnit(saved);
      onChange(saved);
    } else {
      // Default to Fahrenheit for US audience (safe Phase 1 default)
      localStorage.setItem(KEY, "f");
      onChange("f");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAndSave(next: "f" | "c") {
    setUnit(next);
    localStorage.setItem(KEY, next);
    onChange(next);
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border p-1 text-sm">
      <button
        type="button"
        onClick={() => setAndSave("f")}
        className={`rounded-md px-2 py-1 ${
          unit === "f" ? "bg-black text-white" : "hover:bg-black/5"
        }`}
        aria-pressed={unit === "f"}
      >
        °F
      </button>
      <button
        type="button"
        onClick={() => setAndSave("c")}
        className={`rounded-md px-2 py-1 ${
          unit === "c" ? "bg-black text-white" : "hover:bg-black/5"
        }`}
        aria-pressed={unit === "c"}
      >
        °C
      </button>
    </div>
  );
}