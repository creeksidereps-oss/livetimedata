"use client";

import { useState, useEffect, useMemo } from "react";
// Correcting the import to match your file tree
import PhotoSubmissionModal from "./PhotoSubmissionModal"; 

type PhotoItem = { id: string; title: string; subtitle: string; images: string[]; };
type PhotoReelProps = { cityName: string; };

// RESTORED: The logic that defines your 12 categories and 25-image rotation
function buildDynamicReels(cityName: string): PhotoItem[] {
  const categories = [
    "City View", "Landmarks", "Local Life", "Seasonal Scenes", 
    "Attractions", "Skyline", "Waterfront", "Historic Streets", 
    "Public Squares", "Scenic Views", "Night Lights", "Culture"
  ];

  return categories.map((cat, i) => ({
    id: `reel-${i}`,
    title: `${cityName} ${cat}`,
    subtitle: "Community curated gallery",
    images: Array.from({ length: 25 }, (_, j) => 
      ""
    )
  }));
}

export default function PhotoReel({ cityName }: PhotoReelProps) {
  const [realPhotos, setRealPhotos] = useState<{url: string, order: number, title: string}[]>([]);
  const [stateName, setStateName] = useState("");
  const [countryName, setCountryName] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const admin1 = params.get('admin1');
      const country = params.get('country');
      if (admin1) setStateName(admin1);
      if (country) setCountryName(country);
    }
  }, []);
  
  useEffect(() => {
    const handleOpenModal = (e: CustomEvent) => {
      if (e.detail === 'submit_photo') {
        setIsSubmitModalOpen(true);
      }
    };
    window.addEventListener('openModal', handleOpenModal as EventListener);
    return () => window.removeEventListener('openModal', handleOpenModal as EventListener);
  }, []);
  
  useEffect(() => {
    // Fetch actual photos submitted by users!
    async function fetchPhotos() {
      try {
        const res = await fetch('/api/photos/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName }) 
        });
        console.log(`[PhotoReel] Fetched for ${cityName}, ${stateName}. Status: ${res.status}`);
        const data = await res.json();
        console.log(`[PhotoReel] Data:`, data.photos?.length || 0, `photos returned.`);
        if (data.ok && data.photos) {
          setRealPhotos(data.photos.map((p: any) => ({ url: p.image_url, order: p.display_order || 0, title: p.title })));
        }
      } catch (e) {
        console.error('Failed to fetch real photos', e);
      }
    }
    fetchPhotos();
  }, [cityName, stateName]);

  const reels = useMemo(() => {
    const baseReels = buildDynamicReels(cityName);
    // Inject real photos into the specific reels, distributing them evenly if no order is provided
    if (realPhotos.length > 0) {
      realPhotos.forEach((photo, index) => {
        // Distribute round-robin style if order is missing or 0
        const targetBlock = photo.order ? Math.max(0, Math.min(11, photo.order - 1)) : index % 12;
        // Find the first empty slot in this reel
        const emptySlot = baseReels[targetBlock].images.findIndex(img => img === "");
        if (emptySlot !== -1) {
          baseReels[targetBlock].images[emptySlot] = photo.url;
        } else {
          baseReels[targetBlock].images.unshift(photo.url);
        }
      });
    }
    // Only return reels that have at least one real photo to prevent blank gray boxes
    return baseReels.filter(reel => reel.images.some(img => img !== ""));
  }, [cityName, realPhotos]);
  
  // MODAL STATE
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{url: string, title: string} | null>(null);

  // ROTATION STATES: Independent to break the "magnetic" sync
  const [p1Idx, setP1Idx] = useState(0);
  const [p2Idx, setP2Idx] = useState(7);
  const [p3Idx, setP3Idx] = useState(15);

  useEffect(() => {
    // PHASE 1: Reels 1, 4, 7, 10 (30s)
    const t30 = setInterval(() => setP1Idx((prev) => (prev + 1) % 25), 30000);

    // PHASE 2: Reels 2, 5, 8, 11 (35s)
    const t35 = setInterval(() => setP2Idx((prev) => (prev + 1) % 25), 35000);

    // PHASE 3: Reels 3, 6, 9, 12 (40s)
    const t40 = setInterval(() => setP3Idx((prev) => (prev + 1) % 25), 40000);

    return () => { clearInterval(t30); clearInterval(t35); clearInterval(t40); };
  }, []);

  const getIdx = (idx: number) => {
    if ([0, 3, 6, 9].includes(idx)) return p1Idx;
    if ([1, 4, 7, 10].includes(idx)) return p2Idx;
    return p3Idx;
  };

  return (
    <section style={{ 
      marginTop: "10px", marginBottom: "10px", border: "1.5px solid #e2e8f0", 
      borderRadius: "16px", padding: "16px 20px", background: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1e293b" }}>
          {cityName} Local Photos
        </h2>
        <button 
          onClick={() => setIsSubmitModalOpen(true)}
          style={{ 
            border: "2px solid #000", background: "#fff", color: "#000", borderRadius: "999px", 
            padding: "6px 16px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" 
          }}
        >
          Submit Photo
        </button>
      </div>

      {reels.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "#f8fafc", borderRadius: "12px", border: "2px dashed #cbd5e1" }}>
          <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#64748b" }}>There are currently no local photos for this city.</p>
          <button 
            onClick={() => setIsSubmitModalOpen(true)}
            style={{ background: "#0f172a", color: "#fff", padding: "10px 24px", borderRadius: "999px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer", border: "none" }}
          >
            Be the first to submit!
          </button>
        </div>
      ) : (
        <div className="custom-scrollbar" style={{ display: "flex", gap: "32px", overflowX: "auto", paddingBottom: "16px" }}>
          {reels.map((reel, idx) => {
            const rawIdx = getIdx(idx);
            const actualPhotos = reel.images.filter(img => img !== "");
            const currentImgIdx = actualPhotos.length > 0 ? (rawIdx % actualPhotos.length) : 0;
            const imgSrc = actualPhotos.length > 0 ? actualPhotos[currentImgIdx] : "";
            
            return (
              <div key={reel.id} style={{
                border: "2.5px solid #cbd5e1", borderRadius: "14px", overflow: "hidden", background: "#ffffff",
                width: "210px", minWidth: "210px", display: "flex", flexDirection: "column", height: "118px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.06)", flexShrink: 0
              }}>
                <div 
                  style={{ height: "100%", background: "#f1f5f9", overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                  onClick={() => {
                    if(!imgSrc) return;
                    const realPhotoMatch = realPhotos.find(p => p.url === imgSrc);
                    setActivePhoto({ url: imgSrc, title: realPhotoMatch ? realPhotoMatch.title : reel.title });
                  }}
                >
                  {imgSrc ? (
                    <img 
                      key={`${idx}-${currentImgIdx}`} 
                      src={imgSrc} 
                      alt={reel.title}
                      className="fade-in"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activePhoto && (
        <div 
          className="fixed inset-0 z-[5000] flex items-center justify-center p-2 md:p-3 bg-slate-950/85 backdrop-blur-md"
          onClick={() => setActivePhoto(null)}
        >
          <div 
            className="bg-white w-[96vw] max-w-6xl max-h-[97vh] rounded-[24px] md:rounded-[28px] shadow-2xl overflow-hidden flex flex-col border-2 border-slate-900 relative animate-in zoom-in-95 duration-200 mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER BRANDING CONTROL AREA */}
            <div className="px-6 pt-3.5 pb-2.5 border-b-2 border-slate-200 flex justify-between items-center bg-white z-20 shrink-0">
              <div className="flex flex-col pr-4 min-w-0">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight truncate">
                  {cityName}{stateName ? `, ${stateName}` : ''}
                </h2>
                <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  {countryName || 'UNITED STATES'}
                </span>
              </div>
              
              <button 
                onClick={() => setActivePhoto(null)} 
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-all cursor-pointer shrink-0 ml-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* MASTER DISPLAY LAYER (Cinematic Edge-to-Edge Photo) */}
            <div className="w-full max-h-[64vh] md:max-h-[68vh] relative bg-black shrink-0 flex items-center justify-center overflow-hidden">
              <img 
                src={activePhoto.url} 
                className="w-full h-full object-contain pointer-events-none" 
                style={{ maxHeight: '68vh' }}
                alt="Enlarged view" 
              />
            </div>

            {/* DESCRIPTION/COMMENTARY AREA */}
            <div className="px-6 py-2 bg-white shrink-0 border-b border-slate-100 flex items-center justify-center min-h-[40px]">
              <p className="text-xs md:text-sm font-bold text-slate-700 leading-snug text-center m-0 max-w-3xl">
                {activePhoto.title}
              </p>
            </div>

            {/* FOOTER ACTION CONTROLS & AD SLOT */}
            <div style={{ padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} className="shrink-0">
              {/* Pill Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => setActivePhoto(null)} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  BACK TO SITE
                </button>
                <button type="button" onClick={() => { setActivePhoto(null); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT EVENT
                </button>
                <button type="button" onClick={() => { setActivePhoto(null); window.dispatchEvent(new CustomEvent('openModal', { detail: 'share_insights' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SHARE INSIGHTS
                </button>
                <button onClick={() => { setActivePhoto(null); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT PHOTO
                </button>
                <button type="button" onClick={() => { setActivePhoto(null); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); }} style={{ background: '#0f172a', color: '#fff', padding: '7px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
                  SUBMIT WEBCAM
                </button>
              </div>
              
              {/* Ad Space directly underneath pills */}
              <div style={{ width: '100%', height: '45px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  ADVERTISEMENT SPACE
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <PhotoSubmissionModal 
        isOpen={isSubmitModalOpen} 
        onClose={() => setIsSubmitModalOpen(false)} 
        cityName={cityName} 
      />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        .fade-in { animation: fadeIn 2s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0.1; } to { opacity: 1; } }
      `}</style>
    </section>
  );
}
