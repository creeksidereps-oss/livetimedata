"use client";

import React, { useEffect, useState } from "react";

interface FlagVideoCardProps {
  countryName: string;
}

export default function FlagVideoCard({ countryName }: FlagVideoCardProps) {
  const [flagPath, setFlagPath] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchFlagAsset() {
      if (!countryName) return;
      
      try {
        setLoading(true);
        // Explicit network pass targeting our verified, local api endpoint
        const response = await fetch(`/api/flags?countryName=${encodeURIComponent(countryName)}`);
        const data = await response.json();

        if (data.success && data.videoUrl) {
          setFlagPath(data.videoUrl);
        } else {
          console.warn(`Asset system fallback: ${data.error || 'Unknown endpoint status'}`);
          setFlagPath(null);
        }
      } catch (err) {
        console.error("Network interface pipeline failure:", err);
        setFlagPath(null);
      } finally {
        setLoading(false);
      }
    }

    fetchFlagAsset();
  }, [countryName]);

  if (loading) {
    return (
      <div 
        className="w-full bg-slate-900 animate-pulse flex items-center justify-center text-xs text-slate-500 font-medium" 
        style={{ height: "116px" }}
      >
        Connecting...
      </div>
    );
  }

  // If database layer returns a clean asset file, mount it instantly into the layout canvas wrapper
  if (flagPath) {
    return (
      <div style={{ position: "relative", width: "100%", height: "116px", overflow: "hidden", background: "#000" }}>
        <img
          src={flagPath}
          alt={`${countryName} Identity Flag`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center"
          }}
        />
      </div>
    );
  }

  // Default clean interface fallback state
  return (
    <div
      style={{
        height: "116px",
        backgroundColor: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Flag unavailable
      </span>
    </div>
  );
}