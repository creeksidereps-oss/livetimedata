"use client";

import React, { useEffect, useState } from 'react';
import { X, Database, Loader2, Sparkles, Calendar, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface InfoModalProps {
  type: string;
  cityName: string;
  stateName?: string;
  countryName?: string;
  lat: number;
  lng: number;
  onClose: () => void;
  onOpenInsights: () => void;
  onOpenWebcam?: () => void;
}

export default function InfoModal({ type, cityName, stateName, countryName, lat, lng, onClose, onOpenInsights, onOpenWebcam }: InfoModalProps) {
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getIntelligence() {
      try {
        setLoading(true);
        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName, countryName, lat, lng, type }),
        });
        
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
        } else if (data.error) {
          setReport(`### Connection Interrupted\n\nLibrary data connection returned a system notice: ${data.error}`);
        } else {
          setReport("### Notice\n\nReport asset loaded empty from database library storage arrays.");
        }
      } catch (error) {
        console.error("Library connection warning:", error);
        setReport("### System Error\n\nUnable to establish direct communication with the central data archive.");
      } finally {
        setLoading(false);
      }
    }
    getIntelligence();
  }, [cityName, type, lat, lng, stateName]);

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" 
      onClick={onClose} // Exit Method 3: Click-away background overlay mask
    >
      <div 
        className="bg-white w-full md:max-w-[75%] rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[85vh] border-2 border-black relative animate-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()} // Lock operations inside frame container bounds
      >
        
        {/* HEADER BRANDING CONTROL AREA */}
        <div className="p-6 border-b-2 border-black flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl text-white border border-black shadow-sm ${
              type === 'facts' ? 'bg-purple-600' : 
              type === 'on_this_day' ? 'bg-amber-500' :
              type === 'holidays' ? 'bg-rose-500' : 'bg-blue-600'
            }`}>
              {type === 'facts' ? <Sparkles size={18} /> : 
               type === 'on_this_day' ? <Calendar size={18} /> :
               type === 'holidays' ? <Star size={18} /> : <Database size={18} />}
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                {type === 'facts' ? `Fun Facts About ${cityName}${stateName ? `, ${stateName}` : ''}${countryName ? `, ${countryName}` : ''}` : 
                 type === 'on_this_day' ? `On This Day in History ${cityName}${stateName ? `, ${stateName}` : ''}${countryName ? `, ${countryName}` : ''}` :
                 type === 'holidays' ? `Regional Holidays & Customs ${cityName}${stateName ? `, ${stateName}` : ''}${countryName ? `, ${countryName}` : ''}` :
                 `About ${cityName}${stateName ? `, ${stateName}` : ''}${countryName ? `, ${countryName}` : ''}`}
              </h2>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {/* Exit Method 1: Top-Right close button (✕) */}
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-slate-200 rounded-full text-black border border-transparent hover:border-black transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MASTER DISPLAY LAYER FOR DATABASE TEXT CANVAS */}
        <div className="flex-1 overflow-y-auto p-10 bg-white pb-32">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 animate-pulse">
                Consulting the Catalogue
              </p>
            </div>
          ) : (
            <div className="report-content-canvas text-slate-950">
              {/* Pure Markdown Rendering Canvas */}
              <div className="prose prose-slate max-w-none text-slate-950 font-medium">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
        
        {/* FOOTER ACTION CONTROLS */}
        <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', marginTop: 'auto', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {/* Pill Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={onClose} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              BACK TO SITE
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT EVENT
            </button>
            <button type="button" onClick={() => { onClose(); onOpenInsights(); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SHARE INSIGHTS
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT PHOTO
            </button>
            <button type="button" onClick={() => { if (onOpenWebcam) { onOpenWebcam(); } else { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); } }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT WEBCAM
            </button>
          </div>
          
          {/* Ad Space directly underneath pills */}
          <div style={{ width: '100%', height: '60px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ADVERTISEMENT SPACE
            </span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .report-content-canvas h1, .report-content-canvas h2, .report-content-canvas h3 { color: #000000 !important; font-weight: 900 !important; text-transform: uppercase; margin-top: 1.5rem; margin-bottom: 0.75rem; }
        .report-content-canvas h3 { font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .report-content-canvas p, .report-content-canvas li { color: #0f172a !important; font-size: 14px !important; line-height: 1.6 !important; margin-bottom: 1rem; }
        .report-content-canvas ol, .report-content-canvas ul { padding-left: 20px; margin-bottom: 1rem; list-style-type: decimal; }
      `}</style>
    </div>
  );
}