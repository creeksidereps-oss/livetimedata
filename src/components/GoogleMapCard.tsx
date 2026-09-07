"use client";

import React from "react";

interface GoogleMapCardProps {
  cityName: string;
}

export default function GoogleMapCard({ cityName }: GoogleMapCardProps) {
  if (!cityName) {
    return (
      <div style={{ height: "116px", backgroundColor: "#0f172a" }} />
    );
  }

  // Secure HTTPS formatting to display the interactive satellite view cleanly
  const encodedLocation = encodeURIComponent(cityName);
  const embedUrl = `https://maps.google.com/maps?q=${encodedLocation}&output=embed&t=k`;

  return (
    <div 
      style={{ 
        width: "100%", 
        height: "116px", 
        overflow: "hidden", 
        background: "#000",
        position: "relative" 
      }}
    >
      {/* Shield Overlay Layer: Caps internal link hijacking and forces the browser 
        to execute our native modal click trigger cleanly 
      */}
      <div 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 10,
          background: "transparent"
        }}
      />
      <iframe
        title={`${cityName} Satellite Map`}
        width="100%"
        height="116px"
        style={{ border: 0 }}
        loading="lazy"
        src={embedUrl}
      />
    </div>
  );
}