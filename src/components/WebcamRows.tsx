"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AdPlaceholder from "./AdPlaceholder";
import { X } from "lucide-react";

type RowItem = { id: string; title: string; subtitle: string; kind: string; slotIndex: number; imageUrl?: string; embedUrl?: string; };
type WebcamRowsProps = { 
  cityName: string; 
  stateName?: string; 
  countryName?: string; 
  scraperVersion?: number; 
  scraperActive?: boolean; 
};

const RowCard = ({ item, onSelect }: { item: RowItem; onSelect: (item: RowItem) => void }) => {
  let displayImage = item.imageUrl;
  
  if (!displayImage && item.embedUrl && (item.embedUrl.includes('youtube.com/embed/') || item.embedUrl.includes('youtu.be/'))) {
    const match = item.embedUrl.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&]+)/);
    if (match && match[1]) {
      displayImage = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
  }

  return (
    <div 
      onClick={() => onSelect(item)}
      style={{
        border: "2.5px solid #cbd5e1", borderRadius: "14px", overflow: "hidden", background: "#ffffff",
        width: "210px", minWidth: "210px", display: "flex", flexDirection: "column", height: "175px", flexShrink: 0,
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)", cursor: "pointer"
      }}
    >
      <div style={{ height: "95px", background: displayImage ? `url(${displayImage}) center/cover no-repeat` : "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)" }} />
      <div style={{ padding: "10px", flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: "10px", fontWeight: 900, marginBottom: "2px", color: "#000", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</div>
        <div style={{ fontSize: "8px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{item.subtitle}</div>
      </div>
    </div>
  );
};

const WebcamRow = ({ title, items, onSeeMore, onSelect }: { title: string; items: RowItem[]; onSeeMore: (title: string, items: RowItem[]) => void; onSelect: (item: RowItem) => void }) => {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: "10px", marginBottom: "10px", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "16px 20px", background: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#1e293b" }}>{title}</h2>
        {items.length > 5 && (
          <button onClick={() => onSeeMore(title, items)} style={{ border: "2px solid #000", background: "#fff", color: "#000", borderRadius: "999px", padding: "6px 16px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" }}>
            See More ({items.length})
          </button>
        )}
      </div>
      <div className="custom-scrollbar" style={{ display: "flex", gap: "36px", overflowX: "auto", paddingBottom: "16px" }}>
        {items.slice(0, 5).map((item, index) => <RowCard key={`${item.id}-${index}`} item={item} onSelect={onSelect} />)}
      </div>
    </section>
  );
};

export default function WebcamRows({ cityName, stateName, countryName, scraperVersion = 0, scraperActive = false }: WebcamRowsProps) {
  const searchParams = useSearchParams();
  const [activeModal, setActiveModal] = useState<{ title: string; items: RowItem[] } | null>(null);
  const [selectedCam, setSelectedCam] = useState<RowItem | null>(null);
  const [liveEmbedUrl, setLiveEmbedUrl] = useState<string | null>(null);
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());
  const [reported, setReported] = useState(false);
  const [dbData, setDbData] = useState<{ local: RowItem[], regional: RowItem[], global: RowItem[], featuredTour: RowItem | null }>({ local: [], regional: [], global: [], featuredTour: null });

  useEffect(() => {
    async function loadWebcams() {
      try {
        const res = await fetch('/api/webcams/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, countryName })
        });
        const data = await res.json();
        
        if (data.ok) {
          const mapToRow = (cam: any, index: number): RowItem => ({
            id: cam.id.toString(),
            title: cam.title,
            subtitle: cam.kind === '360_tour' ? "360° Virtual Tour" : (cam.city_name === cityName ? "Local Perspective" : `${cam.city_name}, ${cam.stateName || cam.country_code || 'Unknown'}`),
            kind: cam.kind || "local",
            slotIndex: index,
            imageUrl: cam.image_url,
            embedUrl: cam.embed_url
          });

          setDbData({
            local: (data.local || []).map(mapToRow),
            regional: (data.regional || []).map(mapToRow),
            global: (data.global || []).map(mapToRow),
            featuredTour: data.featuredTour ? mapToRow(data.featuredTour, 2) : null
          });
        }
      } catch (err) {
        console.error("Failed to load webcams:", err);
      }
    }
    loadWebcams();
  }, [cityName, stateName, countryName, scraperVersion]);

  const rows = useMemo(() => {
    const mergeData = (real: RowItem[], overrides: Record<number, RowItem>) => {
      const merged = [...real];
      const overrideItems = Object.values(overrides);
      const filteredReal = merged.filter(r => !overrideItems.some(o => o.id === r.id));
      
      Object.entries(overrides).forEach(([boxStr, item]) => {
        const idx = parseInt(boxStr) - 1;
        if (idx >= 0 && idx <= filteredReal.length) {
          filteredReal.splice(idx, 0, item);
        } else {
          filteredReal.push(item);
        }
      });
      return filteredReal;
    };

    const localOverrides: Record<number, RowItem> = {};

    if (stateName?.toLowerCase() === "florida") {
      localOverrides[4] = { id: "fl-4", kind: "local", slotIndex: 4, title: "Manatee Underwater Cam", subtitle: "Silver Springs", embedUrl: "https://www.youtube.com/embed/zPqPFZMGTF8" };
      localOverrides[5] = { id: "fl-5", kind: "local", slotIndex: 5, title: "American Barn Owl", subtitle: "Wildlife Ecology", embedUrl: "https://www.youtube.com/embed/RbPzFQiZ-Sc" };
    }

    if (stateName?.toLowerCase() === "minnesota") {
      localOverrides[4] = { id: "mn-4", kind: "local", slotIndex: 4, title: "International Wolf Center", subtitle: "North Camera", embedUrl: "https://www.youtube.com/embed/5e4lsEe4Vew" };
    }

    const themesOverrides: Record<number, RowItem> = {};
    
    const africanCountries = ["kenya", "south africa", "namibia", "botswana", "tanzania", "uganda", "zimbabwe", "zambia", "rwanda", "madagascar", "egypt", "morocco", "nigeria", "ghana", "senegal", "ethiopia"];
    if (countryName && africanCountries.includes(countryName.toLowerCase())) {
      themesOverrides[1] = { id: "afr-1", kind: "theme", slotIndex: 1, title: "Rosie's Pan", subtitle: "Kruger National Park", embedUrl: "https://www.youtube.com/embed/Cq2qCph6Lx8" };
      themesOverrides[2] = { id: "afr-2", kind: "theme", slotIndex: 2, title: "Nkorho Bush Lodge", subtitle: "Africam", embedUrl: "https://www.youtube.com/embed/dIChLG4_WNs" };
      themesOverrides[3] = { id: "afr-3", kind: "theme", slotIndex: 3, title: "Namib Desert Live", subtitle: "Namibia", embedUrl: "https://www.youtube.com/embed/ydYDqZQpim8" };
    }

    if (countryName?.toLowerCase() === "israel") {
      themesOverrides[1] = { id: "isr-1", kind: "theme", slotIndex: 1, title: "Common Kestrel", subtitle: "GAIA Project", embedUrl: "https://www.youtube.com/embed/zXzxcGi9KY4" };
    }

    const globalOverrides: Record<number, RowItem> = {
      3: { id: "global-3", kind: "popular", slotIndex: 3, title: "World Webcams", subtitle: "Global View", embedUrl: "https://www.youtube.com/embed/i10aOLMK76k" },
      4: { id: "global-4", kind: "popular", slotIndex: 4, title: "World Webcams", subtitle: "Global View", embedUrl: "https://www.youtube.com/embed/HfgIFGbdGJ0" },
      5: { id: "global-5", kind: "popular", slotIndex: 5, title: "Global Cam", subtitle: "Live View", embedUrl: "https://www.youtube.com/embed/y0XPkjM9-P4" },
      12: { id: "global-12", kind: "popular", slotIndex: 12, title: "Global Cam", subtitle: "Live View", embedUrl: "https://www.youtube.com/embed/ckq-AO8PMjg" },
    };

    const finalIcon = mergeData(dbData.local, localOverrides);
    
    if (dbData.featuredTour && !localOverrides[3]) {
      finalIcon.splice(2, 0, dbData.featuredTour);
    }

    return { 
      icon: finalIcon, 
      themes: mergeData(dbData.regional, themesOverrides), 
      popular: mergeData(dbData.global, globalOverrides) 
    };
  }, [cityName, dbData]);

  useEffect(() => {
    if (activeModal || selectedCam) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [activeModal, selectedCam]);

  useEffect(() => {
    if (selectedCam && !selectedCam.embedUrl && selectedCam.imageUrl) {
      setRefreshTimestamp(Date.now());
      const interval = setInterval(() => {
        setRefreshTimestamp(Date.now());
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [selectedCam]);

  const closeModal = () => { setActiveModal(null); setSelectedCam(null); setLiveEmbedUrl(null); setReported(false); };
  const closePlayer = () => { setSelectedCam(null); setLiveEmbedUrl(null); setReported(false); };

  const handleSelectCam = async (item: RowItem) => {
    setSelectedCam(item);
    if (item.embedUrl) {
      setLiveEmbedUrl(item.embedUrl);
    } else {
      setLiveEmbedUrl(null);
    }
  };

  return (
    <>
      {scraperActive && dbData.local.length === 0 && dbData.regional.length === 0 && (
        <div style={{ padding: "40px 20px", textAlign: "center", background: "#ffffff", borderRadius: "16px", border: "1.5px dashed #cbd5e1", marginTop: "10px", marginBottom: "10px" }}>
          <div style={{ display: "inline-block", width: "40px", height: "40px", borderRadius: "50%", border: "4px solid #f1f5f9", borderTopColor: "#0f172a", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 900, textTransform: "uppercase", color: "#0f172a", letterSpacing: "1px" }}>AI Scraper Active</h3>
          <p style={{ margin: "8px 0 0", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Searching global satellite feeds and local streams... this may take up to 45 seconds.</p>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <WebcamRow title="Featured Views" items={rows.icon} onSeeMore={(title, items) => setActiveModal({ title, items })} onSelect={handleSelectCam} />
      <WebcamRow title="Themed Collections" items={rows.themes} onSeeMore={(title, items) => setActiveModal({ title, items })} onSelect={handleSelectCam} />
      <WebcamRow title="Global Popular Views" items={rows.popular} onSeeMore={(title, items) => setActiveModal({ title, items })} onSelect={handleSelectCam} />

      {/* SEE MORE LIBRARY MODAL */}
      {activeModal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} className="w-[95%] md:w-[75%] h-[75%] max-w-[1200px] bg-white rounded-[24px] flex flex-col relative shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
            <button onClick={closeModal} style={{ position: 'absolute', top: '20px', right: '20px', background: '#000', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', zIndex: 10 }}>✕</button>
            <div style={{ padding: '30px 40px', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' }}>{activeModal.title} Library</h2>
            </div>
            <div className="custom-scrollbar" style={{ flexGrow: 1, overflowY: 'auto', padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '30px' }}>
              {activeModal.items.map((item, index) => <RowCard key={`${item.id}-${index}`} item={item} onSelect={handleSelectCam} />)}
            </div>
            <div className="p-4 bg-slate-50 border-t-2 border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <button onClick={closeModal} className="w-full sm:w-auto bg-slate-900 text-white px-8 py-3.5 rounded-full font-black text-[11px] tracking-[0.2em] uppercase hover:bg-blue-600 shadow-md transition-all active:scale-95 cursor-pointer shrink-0">Back to Site</button>
              <div className="w-full sm:w-[320px] shrink-0">
                  <AdPlaceholder />
              </div>
            </div>
          </div>
        </div>
      )}

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
                <button type="button" onClick={() => { closePlayer(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT PHOTO
                </button>
                <button type="button" onClick={() => { closePlayer(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT WEBCAM
                </button>
              </div>
              
              {/* Ad Space directly underneath pills */}
              <div style={{ width: '100%', height: '42px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  ADVERTISEMENT SPACE
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}