// src/components/AdSlot.tsx
"use client";

import React from "react";
import { ADS_ENABLED, AdSlotKey } from "@/config/adSlots";

interface AdSlotProps {
  slot: string;
  className?: string;
  format?: "auto" | "horizontal" | "rectangle" | "vertical";
}

export default function AdSlot({ slot, className = "", format = "auto" }: AdSlotProps) {
  // Never render placeholder boxes or unfinished ad units while awaiting review
  if (!ADS_ENABLED) {
    return null;
  }

  return (
    <div className={`w-full overflow-hidden flex items-center justify-center my-4 ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-client="ca-pub-8921617153359907"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
