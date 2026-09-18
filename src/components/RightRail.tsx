"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import FlagVideoCard from "./FlagVideoCard";
import GoogleMapCard from "./GoogleMapCard";
import AdPlaceholder from "./AdPlaceholder";
import { ADS_ENABLED } from "@/config/adSlots";
import FeaturedFactCard from "./FeaturedFactCard";

import ExchangeRateCard from "./ExchangeRateCard";

type RightRailProps = {
  cityName: string;
  stateName?: string;
  countryName?: string;
  flagAtBottom?: boolean;
};

type RailCard = {
  id: string;
  title: string;
  subtitle: string;
};

const RailAdSlot = ({ id }: { id: string }) => {
  if (!ADS_ENABLED) return null;
  return (
    <div 
      className="w-full bg-gray-50/50 border border-dashed border-gray-200 rounded flex items-center justify-center text-[9px] font-black uppercase text-gray-400 tracking-tighter h-[36px]" 
      style={{ marginTop: "10px" }}
    >
      {id}
    </div>
  );
};

function buildRail(cityName: string) {
  const columnA: RailCard[] = [
    { id: "flag-cam", title: "National Identity", subtitle: "" },
    { id: "weather-cam", title: `${cityName} Weather Cam`, subtitle: "" },
    { id: "wildlife-cam", title: `${cityName} Zoo / Wildlife Cam`, subtitle: "" },
    { id: "tourist-cam", title: `${cityName} Tourist Attraction Cam`, subtitle: "" },
    { id: "popular-cam", title: `${cityName} Popular Nearby Cam`, subtitle: "" },
    { id: "column-a-extra-1", title: `${cityName} Extra Featured Cam`, subtitle: "" },
    { id: "column-a-extra-2", title: `${cityName} Extra Nearby Cam`, subtitle: "" },
    { id: "column-a-extra-3", title: `${cityName} Extra Utility Cam`, subtitle: "" },
    { id: "column-a-extra-4", title: `${cityName} Extra Context Cam`, subtitle: "" },
    { id: "column-a-extra-5", title: `${cityName} Extra Scenic Cam`, subtitle: "" },
  ];

  const columnB: RailCard[] = [
    { id: "map-slot", title: `${cityName} Satellite / Map`, subtitle: "" },
    { id: "exchange-rate", title: "Exchange Rate Calculator", subtitle: "" },
    { id: "skyline-cam", title: `${cityName} Skyline Cam`, subtitle: "" },
    { id: "airport-cam", title: `${cityName} Airport Cam`, subtitle: "" },
    { id: "traffic-cam", title: `${cityName} Traffic Cam`, subtitle: "" },
    { id: "local-cam", title: `${cityName} Additional Local Cam`, subtitle: "" },
    { id: "column-b-extra-1", title: `${cityName} Extra Utility Cam`, subtitle: "" },
    { id: "column-b-extra-2", title: `${cityName} Extra Context Cam`, subtitle: "" },
    { id: "column-b-extra-3", title: `${cityName} Extra Visual Cam`, subtitle: "" },
    { id: "column-b-extra-4", title: `${cityName} Extra Local Cam`, subtitle: "" },
  ];

  return { columnA, columnB };
}

interface RailCardViewProps {
  card: RailCard;
  detectedCountry: string;
  cityName: string;
  railCams: any[];
  onMapClick: () => void;
  onSelectCam: (cam: any) => void;
}

function RailCardView({ card, detectedCountry, cityName, liveCam, onMapClick, onSelectCam }: RailCardViewProps & { liveCam?: any }) {
  const getLocalFlagPath = (country: string) => {
    if (!country) return null;
    
    let cleanCountry = country
      .toLowerCase()
      .trim()
      .replace(/[\s\-\,]+/g, "_")
      .replace(/[\(\)]/g, "");

    // Core alignment logic to bridge the Republic of Türkiye dropdown language barrier
    if (cleanCountry.includes("turk") || cleanCountry.includes("türk")) {
      return "/assets/flags/turkey.png";
    }

    if (cleanCountry === "united_kingdom") cleanCountry = "united_kingdom";
    if (cleanCountry === "myanmar") cleanCountry = "myanmar_burma";
    if (cleanCountry === "burma") cleanCountry = "myanmar_burma";
    if (cleanCountry === "congo") cleanCountry = "congo_brazzaville";
    if (cleanCountry === "east_timor") cleanCountry = "timor_leste";

    return `/assets/flags/${cleanCountry}.png`;
  };

  const localFlag = getLocalFlagPath(detectedCountry);
  const finalTitle = card.id === "flag-cam" ? detectedCountry : (liveCam?.title || card.title);

  if (card.id !== "flag-cam" && card.id !== "map-slot" && card.id !== "exchange-rate" && !liveCam) {
    return null;
  }

  // Extracts URL state parameter context on the client side to provide location details for wide-capture alerts
  const handleWideCaptureAlert = () => {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const stateParam = urlParams.get("admin1") || "System State Context";
      
      fetch("/api/admin/flag-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityName: cityName,
          stateName: stateParam
        })
      });
    } catch (err) {
      console.error("Failed to route wide-capture fallback alert:", err);
    }
  };
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
      }}
    >
      {card.id === "flag-cam" ? (
        localFlag ? (
          <div style={{ position: "relative", width: "100%", height: "116px", overflow: "hidden", background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }}>
            <img
              src={localFlag}
              alt={`${detectedCountry} Identity Asset`}
              onError={(e) => {
                const target = e.target as HTMLElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `<img src="https://i.postimg.cc/vmsQgYn5/brand-placeholder.png" alt="LiveTimeData" style="width:100%;height:100%;object-fit:cover;object-position:center;" />`;
                }
                // UNHINDERED WIDE CAPTURE TRIGGER: Fires data log instantly when asset presentation fails
                handleWideCaptureAlert();
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
            />
          </div>
        ) : (
          <FlagVideoCard countryName={detectedCountry} />
        )
      ) : card.id === "map-slot" ? (
        <div onClick={onMapClick} style={{ cursor: "pointer", position: "relative" }}>
          <GoogleMapCard cityName={cityName} />
        </div>
      ) : liveCam ? (
        <div style={{ position: "relative", width: "100%", height: "116px", background: "#f1f5f9", cursor: "pointer", overflow: "hidden" }} onClick={() => onSelectCam(liveCam)}>
          <div className="absolute top-2 right-2 z-20 bg-black/70 text-white px-2 py-1 rounded-[4px] text-[8px] font-black tracking-wider flex items-center">
            <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse" />
            LIVE
          </div>
          <img 
            src={
              liveCam.image_url || 
              (liveCam.embed_url && liveCam.embed_url.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&]+)/) 
                ? `https://img.youtube.com/vi/${liveCam.embed_url.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&]+)/)[1]}/hqdefault.jpg` 
                : "https://i.postimg.cc/vmsQgYn5/brand-placeholder.png")
            }
            width="100%" 
            height="100%" 
            style={{ objectFit: "cover", objectPosition: "center" }}
            alt={liveCam.title || "Live Webcam"}
            onError={(e) => {
              const target = e.target as HTMLElement;
              const parent = target.closest('div[style*="background: #f1f5f9"]');
              if (parent) {
                (parent as HTMLElement).style.display = 'none';
              }
            }}
          />
        </div>
      ) : null}

      {(card.id === "flag-cam" || card.id === "map-slot" || liveCam) && (
        <div style={{ padding: "12px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#111827",
              textTransform: "uppercase",
              lineHeight: "1.2",
            }}
          >
            {finalTitle}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RightRail({ cityName, stateName, countryName, flagAtBottom = false }: RightRailProps) {
  const { columnA, columnB } = buildRail(cityName);
  const [currentCountry, setCurrentCountry] = useState<string>(countryName || "United States");
  const [currentCountryCode, setCurrentCountryCode] = useState<string>("US");
  const [currentState, setCurrentState] = useState<string>(stateName || "");
  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [railCams, setRailCams] = useState<any[]>([]);
  const [selectedCam, setSelectedCam] = useState<any>(null);
  const [liveEmbedUrl, setLiveEmbedUrl] = useState<string | null>(null);
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());

  const handleSelectCam = (cam: any) => {
    setSelectedCam(cam);
    setLiveEmbedUrl(cam.embed_url || null);
    setRefreshTimestamp(Date.now());
  };

  const closePlayer = () => {
    setSelectedCam(null);
    setLiveEmbedUrl(null);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let attempts = 0;

    async function fetchRailCams() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const stateParam = urlParams.get("admin1") || "";
        const countryParam = urlParams.get("country") || "";
        
        const res = await fetch('/api/webcams/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName: stateParam, countryName: countryParam })
        });
        const data = await res.json();
        if (data.ok && data.rightRailCams && data.rightRailCams.length > 0) {
          setRailCams(data.rightRailCams);
        }

        // Multi-stage auto-polling: If fewer than 5 webcams are found, retry up to 3 times (at 3.5s intervals)
        // so streams discovered in the background display seamlessly without requiring a manual page refresh.
        const camCount = (data.ok && data.rightRailCams) ? data.rightRailCams.length : 0;
        if (camCount < 5 && attempts < 3) {
          attempts++;
          timer = setTimeout(() => {
            fetchRailCams();
          }, 3500);
        }
      } catch (err) {
        console.error("Failed to load right rail cams", err);
      }
    }

    fetchRailCams();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cityName]);

  useEffect(() => {
    if (stateName) setCurrentState(stateName);
  }, [stateName]);

  useEffect(() => {
    if (countryName) setCurrentCountry(countryName);
  }, [countryName]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const countryParam = params.get("country");
      if (countryParam) {
        setCurrentCountry(countryParam.trim());
      }
      const codeParam = params.get("country_code");
      if (codeParam) {
        setCurrentCountryCode(codeParam.trim());
      }
      const stateParam = params.get("admin1");
      if (stateParam) {
        setCurrentState(stateParam.trim());
      }
    }
  }, []);

  const displayA = columnA.slice(0, 10);
  const displayB = columnB.slice(0, 10);

  // Helper to extract a unique stream fingerprint (YouTube ID, stream URL, or normalized title)
  const getCamKey = (c: any): string => {
    if (!c) return "";
    const embed = c.embed_url || "";
    const ytMatch = embed.match(/(?:youtube\.com\/embed\/|youtu\.be\/|v=)([^?&]+)/i);
    if (ytMatch) return `yt:${ytMatch[1].toLowerCase()}`;
    const cleanUrl = (c.embed_url || c.image_url || "").trim().toLowerCase();
    if (cleanUrl) return cleanUrl;
    return (c.title || "").trim().toLowerCase();
  };

  // Top-to-bottom slot order for filling available webcams
  // Col A Slot 0 is Flag. Col B Slot 0 is Map, Slot 1 is Exchange Calculator.
  const webcamSlotOrder = [
    { cardId: "weather-cam" },        // Col A Slot 1 (directly under Flag!)
    { cardId: "skyline-cam" },        // Col B Slot 2 (directly under Exchange Calculator!)
    { cardId: "wildlife-cam" },       // Col A Slot 2
    { cardId: "airport-cam" },        // Col B Slot 3
    { cardId: "tourist-cam" },        // Col A Slot 3
    { cardId: "traffic-cam" },        // Col B Slot 4
    { cardId: "popular-cam" },        // Col A Slot 4
    { cardId: "local-cam" },          // Col B Slot 5
    { cardId: "column-a-extra-1" },   // Col A Slot 5
    { cardId: "column-b-extra-1" },   // Col B Slot 6
    { cardId: "column-a-extra-2" },   // Col A Slot 6
    { cardId: "column-b-extra-2" },   // Col B Slot 7
    { cardId: "column-a-extra-3" },   // Col A Slot 7
    { cardId: "column-b-extra-3" },   // Col B Slot 8
  ];

  // Compute Assignments
  const assignedCams: Record<string, any> = {};
  const seenKeys = new Set<string>();
  const uniqueCams: any[] = [];

  for (const c of railCams) {
    const key = getCamKey(c);
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueCams.push(c);
    }
  }

  // Populate the highest priority spots first!
  for (let i = 0; i < uniqueCams.length && i < webcamSlotOrder.length; i++) {
    const slot = webcamSlotOrder[i];
    assignedCams[slot.cardId] = uniqueCams[i];
  }

  const modalMapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(cityName)}&output=embed&t=k`;

  // Count active cards in each column
  const activeCardsA = displayA.filter(card => (flagAtBottom ? card.id !== "flag-cam" : card.id === "flag-cam") || Boolean(assignedCams[card.id]));
  const activeCardsB = displayB.filter(card => card.id === "map-slot" || card.id === "exchange-rate" || Boolean(assignedCams[card.id]));

  return (
    <>
      <FeaturedFactCard 
        cityName={cityName} 
        stateName={stateName || currentState} 
        countryName={countryName || currentCountry} 
      />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {displayA.map((card, index) => {
            if (flagAtBottom && card.id === "flag-cam") return null;
            const isCore = card.id === "flag-cam";
            if (!isCore && !assignedCams[card.id]) return null;
            return (
              <React.Fragment key={card.id}>
                <RailCardView card={card} detectedCountry={currentCountry} cityName={cityName} liveCam={assignedCams[card.id]} onMapClick={() => setIsMapModalOpen(true)} onSelectCam={handleSelectCam} railCams={[]} />
                {index === 4 && activeCardsA.length >= 4 && <RailAdSlot id="RAIL AD LEFT" />}
              </React.Fragment>
            );
          })}
          {activeCardsA.length > 0 && <RailAdSlot id="RAIL AD LEFT BOTTOM" />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {displayB.map((card, index) => {
            const isCore = card.id === "map-slot" || card.id === "exchange-rate";
            if (!isCore && !assignedCams[card.id]) return null;
            return (
              <React.Fragment key={card.id}>
                {card.id === "exchange-rate" ? (
                  <ExchangeRateCard countryCode={currentCountryCode} />
                ) : (
                  <RailCardView card={card} detectedCountry={currentCountry} cityName={cityName} liveCam={assignedCams[card.id]} onMapClick={() => setIsMapModalOpen(true)} onSelectCam={handleSelectCam} railCams={[]} />
                )}
                {index === 4 && activeCardsB.length >= 4 && <RailAdSlot id="RAIL AD RIGHT" />}
              </React.Fragment>
            );
          })}
          {activeCardsB.length > 0 && <RailAdSlot id="RAIL AD RIGHT BOTTOM" />}
        </div>

        {flagAtBottom && (
          <div className="col-span-1 md:col-span-2">
            <RailCardView 
              card={{ id: "flag-cam", title: "National Identity", subtitle: "" }} 
              detectedCountry={currentCountry} 
              cityName={cityName} 
              liveCam={undefined} 
              onMapClick={() => setIsMapModalOpen(true)} 
              onSelectCam={handleSelectCam} 
              railCams={[]} 
            />
          </div>
        )}
      </section>
      {/* LIVE CAMERA PLAYER MODAL */}
      {selectedCam && (
        <div 
          className="fixed inset-0 z-[5000] flex items-center justify-center p-2 md:p-3 bg-slate-950/85 backdrop-blur-md"
          onClick={closePlayer}
        >
          <div 
            className="bg-white w-[96vw] max-w-6xl max-h-[97vh] rounded-[24px] md:rounded-[28px] shadow-2xl overflow-hidden flex flex-col border-2 border-slate-900 relative animate-in zoom-in-95 duration-200 mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER BRANDING CONTROL AREA */}
            <div className="px-6 pt-3.5 pb-2.5 border-b-2 border-slate-200 flex justify-between items-center bg-white z-20 shrink-0">
              <div className="flex flex-col pr-4 min-w-0">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">
                  {selectedCam.title}
                </h2>
                <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  {selectedCam.subtitle || "LIVE FEED"}
                </span>
              </div>
              
              <button 
                onClick={closePlayer} 
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-all cursor-pointer shrink-0 ml-2"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            {/* MASTER DISPLAY LAYER (Cinematic Edge-to-Edge Video) */}
            <div className="w-full aspect-video max-h-[66vh] md:max-h-[70vh] relative bg-black shrink-0 flex items-center justify-center">
              {liveEmbedUrl ? (
                <>
                  <iframe 
                    src={liveEmbedUrl.includes('?') ? `${liveEmbedUrl}&controls=0&modestbranding=1&rel=0&disablekb=1&autoplay=1&mute=1&playsinline=1&iv_load_policy=3` : `${liveEmbedUrl}?controls=0&modestbranding=1&rel=0&disablekb=1&autoplay=1&mute=1&playsinline=1&iv_load_policy=3`} 
                    className="absolute inset-0 w-full h-full border-none pointer-events-none"
                    allowFullScreen 
                    allow="autoplay; encrypted-media" 
                  />
                </>
              ) : selectedCam?.imageUrl ? (
                <div className="relative w-full h-full">
                  <img 
                    src={`${selectedCam.imageUrl}${selectedCam.imageUrl.includes('?') ? '&' : '?'}t=${refreshTimestamp}`}
                    className="w-full h-full object-contain"
                    alt="Live Camera Snapshot"
                  />
                  <div className="absolute top-3 right-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider">
                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                    LIVE SNAPSHOT (60S)
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-[13px] font-bold uppercase tracking-wider">
                  Live Video Stream Connection Pending
                </div>
              )}
            </div>

            {/* FOOTER ACTION CONTROLS & AD SLOT */}
            <div style={{ padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} className="shrink-0">
              {/* Pill Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={closePlayer} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  BACK TO SITE
                </button>
                <button type="button" onClick={() => { closePlayer(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT EVENT
                </button>
                <button type="button" onClick={() => { closePlayer(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'share_insights' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SHARE INSIGHTS
                </button>
                <button type="button" onClick={() => { closePlayer(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT PHOTO
                </button>
                <button type="button" onClick={() => { closePlayer(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT WEBCAM
                </button>
              </div>
              
              {/* Ad Space directly underneath pills */}
              {ADS_ENABLED && (
                <div style={{ width: '100%', height: '45px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    ADVERTISEMENT SPACE
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isMapModalOpen && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setIsMapModalOpen(false)}
        >
          <div 
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "850px",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              padding: "24px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#111827", textTransform: "uppercase", letterSpacing: "0.025em" }}>
                {cityName} Satellite Space Exploration
              </h3>
              <button 
                onClick={() => setIsMapModalOpen(false)}
                style={{ cursor: "pointer", background: "none", border: "none", fontSize: "20px", fontWeight: 600, color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div style={{ width: "100%", height: "400px", borderRadius: "14px", overflow: "hidden", background: "#e2e8f0", border: "1px solid #e2e8f0" }}>
              <iframe
                title={`${cityName} Extended Map`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                src={modalMapEmbedUrl}
              />
            </div>

            {/* FOOTER ACTIONS AND AD SPACE */}
            <div style={{ paddingTop: '20px', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              {/* Pill Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => setIsMapModalOpen(false)} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  BACK TO SITE
                </button>
                <button type="button" onClick={() => { setIsMapModalOpen(false); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT EVENT
                </button>
                <button type="button" onClick={() => { setIsMapModalOpen(false); window.dispatchEvent(new CustomEvent('openModal', { detail: 'share_insights' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SHARE INSIGHTS
                </button>
                <button type="button" onClick={() => { setIsMapModalOpen(false); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT PHOTO
                </button>
                <button type="button" onClick={() => { setIsMapModalOpen(false); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT WEBCAM
                </button>
              </div>
              
              {/* Ad Space directly underneath pills */}
              {ADS_ENABLED && (
                <div style={{ width: '100%', height: '60px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    ADVERTISEMENT SPACE
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}