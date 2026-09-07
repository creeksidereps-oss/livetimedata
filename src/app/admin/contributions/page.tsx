"use client";

import React, { useEffect, useState } from "react";
import { X, ShieldAlert, Sparkles, Image, Video, CheckCircle } from "lucide-react";

export default function AdminContributionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewItem, setReviewItem] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/get-contributions");
        const data = await res.json();
        if (data.contributions) setItems(data.contributions);
      } catch (err) {
        console.error("Dashboard Load Error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-20 text-center font-black uppercase tracking-widest text-slate-400">
        Loading Queue...
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans text-slate-900 relative">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-black tracking-tighter uppercase mb-6">
          User Intelligence Queue
        </h1>
        
        <div className="bg-white rounded-[32px] shadow-2xl border-2 border-black overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">City/User</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Notes / Setup</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-6">
                    <div className="font-black text-slate-900">{item.city_name}, {item.state_name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{item.user_email || "Anonymous"}</div>
                  </td>
                  <td className="p-6">
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase border border-blue-100">
                      {item.contribution_type || "Insight"}
                    </span>
                  </td>
                  <td className="p-6 text-xs text-slate-600 font-medium max-w-xs truncate">
                    {item.administrative_notes || "No notes attached"}
                  </td>
                  <td className="p-6 text-right">
                    <button 
                      onClick={() => setReviewItem(item)}
                      className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 cursor-pointer transition-colors"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-20 text-center font-bold text-slate-300 uppercase tracking-widest">
              No submissions yet
            </div>
          )}
        </div>
      </div>

      {/* COMPONENT MODAL OVERLAY: Hard Truths Exit Strategy Applied Completely */}
      {reviewItem && (
        <div 
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4"
          onClick={() => setReviewItem(null)}
        >
          <div 
            className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl border-2 border-black flex flex-col h-[85vh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* EXIT STRATEGY 1: TOP RIGHT X BUTTON */}
            <button 
              onClick={() => setReviewItem(null)} 
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-black transition-all z-10 cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* HEADER METADATA AREA */}
            <div className="p-8 border-b-2 border-black bg-slate-50/30">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-black">
                Review Submission
              </h2>
              <p className="text-black font-black text-xs uppercase tracking-wide mt-1">
                {reviewItem.city_name}, {reviewItem.state_name} • From: {reviewItem.user_email || "Anonymous"}
              </p>
            </div>

            {/* SUBMISSION LINES DISPLAY */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-black pb-36">
              <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-black/10">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Contributor Metadata</span>
                <p className="text-xs font-semibold text-slate-700 leading-normal">
                  <strong>Age Status:</strong> {reviewItem.age_compliance_status || "Standard"}<br />
                  <strong>Reference Code:</strong> {reviewItem.promo_reference_code || "None"}<br />
                  <strong>Context Log:</strong> {reviewItem.administrative_notes || "N/A"}
                </p>
              </div>

              {reviewItem.interesting_insights && (
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">1. Interesting & Unusual Traits</h3>
                  <p className="text-sm font-semibold text-slate-800 bg-slate-50/30 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">{reviewItem.interesting_insights}</p>
                </div>
              )}

              {reviewItem.local_knowledge && (
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">2. Local Secret Knowledge</h3>
                  <p className="text-sm font-semibold text-slate-800 bg-slate-50/30 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">{reviewItem.local_knowledge}</p>
                </div>
              )}

              {reviewItem.points_of_interest && (
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">3. Places & Hidden Discoveries</h3>
                  <p className="text-sm font-semibold text-slate-800 bg-slate-50/30 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">{reviewItem.points_of_interest}</p>
                </div>
              )}

              {reviewItem.webcam_links && (
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">4. Submitted Public Webcams</h3>
                  <p className="text-sm font-semibold text-blue-600 bg-blue-50/20 p-3 rounded-lg border border-blue-100 font-mono whitespace-pre-wrap">{reviewItem.webcam_links}</p>
                </div>
              )}

              {reviewItem.suggestions_corrections && (
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">5. Suggestions or Corrections</h3>
                  <p className="text-sm font-semibold text-slate-800 bg-slate-50/30 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">{reviewItem.suggestions_corrections}</p>
                </div>
              )}

              {reviewItem.additional_notes && (
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">6. Additional Notes</h3>
                  <p className="text-sm font-semibold text-slate-800 bg-slate-50/30 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">{reviewItem.additional_notes}</p>
                </div>
              )}
            </div>

            {/* ACTION PIPELINE CONTROLS HUD */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-slate-900 border-t-2 border-black flex items-center justify-between gap-4">
              {/* EXIT STRATEGY 2: BOTTOM LEFT RETURN PILL */}
              <button 
                type="button"
                onClick={() => setReviewItem(null)}
                className="bg-white text-black px-6 py-2.5 rounded-full font-black text-[10px] tracking-[0.2em] uppercase hover:bg-slate-200 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Return to Site
              </button>

              {/* ACTION BUTTON WRAPPER */}
              <div className="flex gap-2">
                <button 
                  onClick={() => alert("Pipeline Action: Forward link to public camera player arrays.")}
                  className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Video size={12} /> Live Webcam
                </button>
                <button 
                  onClick={() => alert("Pipeline Action: Route selected media attachments to server storage assets.")}
                  className="bg-purple-600 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-purple-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Image size={12} /> Accept Photos
                </button>
                <button 
                  onClick={() => alert(`Pipeline Action: Compile text payload and trigger OpenAI update for ${reviewItem.city_name} context entries.`)}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles size={12} /> AI Rewrite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}