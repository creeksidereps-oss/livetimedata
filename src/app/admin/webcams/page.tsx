"use client";

import React, { useEffect, useState } from "react";
import { X, Video, Plus, Trash2, Eye, Ban, Edit2, Save } from "lucide-react";
import AdPlaceholder from "@/components/AdPlaceholder";

export default function AdminWebcamsPage() {
  const [activeTab, setActiveTab] = useState<"live" | "pending">("live");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    city_name: "",
    state_name: "",
    kind: "standard",
    title: "",
    embed_url: ""
  });

  async function loadWebcams(tab: string = activeTab, query: string = searchQuery) {
    setLoading(true);
    try {
      const url = new URL("/api/admin/webcams", window.location.origin);
      url.searchParams.set("status", tab);
      if (query) url.searchParams.set("q", query);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.webcams) setItems(data.webcams);
    } catch (err) {
      console.error("Failed to load webcams", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadWebcams(activeTab, searchQuery);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [activeTab, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/webcams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsAdding(false);
        setFormData({ city_name: "", state_name: "", kind: "standard", title: "", embed_url: "" });
        loadWebcams();
      } else {
        alert("Failed to add webcam");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webcam?")) return;
    try {
      const res = await fetch(`/api/admin/webcams?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadWebcams();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (item: any) => {
    try {
      const res = await fetch(`/api/admin/webcams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: 'live', city_name: item.city_name, state_name: item.state_name, country: item.country, kind: item.kind, display_order: item.display_order })
      });
      if (res.ok) {
        setEditModeId(null);
        loadWebcams();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (item: any) => {
    try {
      const res = await fetch(`/api/admin/webcams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: 'rejected', city_name: item.city_name, state_name: item.state_name })
      });
      if (res.ok) {
        loadWebcams();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans text-slate-900 relative">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-4">
          <h1 className="text-5xl font-black tracking-tighter uppercase">
            Webcams & Media
          </h1>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-full font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus size={14} /> Add New Feed
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <button 
            onClick={() => setActiveTab("live")}
            className={`px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest cursor-pointer transition-all ${activeTab === 'live' ? 'bg-black text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-200'}`}
          >
            Live Feeds
          </button>
          <button 
            onClick={() => setActiveTab("pending")}
            className={`px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest cursor-pointer transition-all ${activeTab === 'pending' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-200'}`}
          >
            Pending Approval {activeTab === 'pending' && `(${items.length})`}
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="mb-6 flex gap-4 items-center">
          <div className="flex-1 bg-white rounded-2xl shadow-sm border-2 border-slate-200 flex items-center px-4 py-2">
            <input 
              type="text" 
              placeholder="Search by City, State, Country, or Title..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-slate-900 font-bold"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-900">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-[32px] shadow-2xl border-2 border-black overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">City / State</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Title</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center font-black uppercase tracking-widest text-slate-400">Loading feeds...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center font-bold text-slate-300 uppercase tracking-widest">No feeds found</td></tr>
              ) : (
                items.map((item: any, index: number) => {
                  const isEditing = activeTab === 'pending' || editModeId === item.id;
                  
                  return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input 
                            value={item.city_name} 
                            onChange={(e) => updateItem(index, 'city_name', e.target.value)}
                            className="font-black text-slate-900 border-2 border-slate-200 rounded px-2 py-1 w-full text-sm"
                            placeholder="City Name"
                          />
                          <div className="flex gap-2">
                            <input 
                              value={item.state_name} 
                              onChange={(e) => updateItem(index, 'state_name', e.target.value)}
                              className="text-[10px] text-slate-500 font-bold uppercase border-2 border-slate-200 rounded px-2 py-1 w-full"
                              placeholder="State / Region"
                            />
                            <input 
                              value={item.country || ""} 
                              onChange={(e) => updateItem(index, 'country', e.target.value)}
                              className="text-[10px] text-slate-500 font-bold uppercase border-2 border-slate-200 rounded px-2 py-1 w-full"
                              placeholder="Country"
                            />
                          </div>
                          <input
                            type="number"
                            value={item.display_order || 100}
                            onChange={(e) => updateItem(index, 'display_order', e.target.value)}
                            className="text-[10px] text-slate-700 font-bold border-2 border-blue-200 bg-blue-50 rounded px-2 py-1 w-full mt-1"
                            placeholder="Priority (100 = Box 1)"
                            title="Priority Order (Higher number = Earlier Box)"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-black text-slate-900">{item.city_name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">
                            {[item.state_name, item.country].filter(Boolean).join(", ") || "Global"}
                          </div>
                          {item.display_order && <div className="text-[9px] text-blue-900 font-black mt-1 uppercase">Priority: {item.display_order}</div>}
                        </>
                      )}
                    </td>
                    <td className="p-6">
                      <div className="font-bold text-sm text-slate-800">{item.title}</div>
                      <button onClick={() => setPreviewUrl(item.embed_url)} className="text-[10px] text-blue-900 font-black uppercase max-w-xs hover:underline flex items-center gap-1 mt-1 cursor-pointer">
                        <Eye size={12} /> Preview Feed
                      </button>
                    </td>
                    <td className="p-6">
                      {isEditing ? (
                        <select
                          value={item.kind || "wildlife-cam"}
                          onChange={(e) => updateItem(index, 'kind', e.target.value)}
                          className="px-2 py-1 rounded-lg bg-slate-50 text-slate-700 text-[10px] font-black uppercase border-2 border-slate-200 w-full"
                        >
                          <optgroup label="Dynamic Grids">
                            <option value="featured">Main Grid / Themed Collection</option>
                            <option value="global-curated">Global Popular (3rd Row)</option>
                            <option value="360_tour">360° Virtual Tour</option>
                          </optgroup>
                          <optgroup label="Right Rail: Left Column">
                            <option value="weather-cam">Left Column - Box 1</option>
                            <option value="wildlife-cam">Left Column - Box 2</option>
                            <option value="tourist-cam">Left Column - Box 3</option>
                            <option value="popular-cam">Left Column - Box 4</option>
                            <option value="column-a-extra-1">Left Column - Box 5 (Extra)</option>
                            <option value="column-a-extra-2">Left Column - Box 6 (Extra)</option>
                            <option value="column-a-extra-3">Left Column - Box 7 (Extra)</option>
                          </optgroup>
                          <optgroup label="Right Rail: Right Column">
                            <option value="skyline-cam">Right Column - Box 2</option>
                            <option value="airport-cam">Right Column - Box 4</option>
                            <option value="traffic-cam">Right Column - Box 5</option>
                            <option value="local-cam">Right Column - Box 6</option>
                            <option value="column-b-extra-1">Right Column - Box 7 (Extra)</option>
                            <option value="column-b-extra-2">Right Column - Box 8 (Extra)</option>
                            <option value="column-b-extra-3">Right Column - Box 9 (Extra)</option>
                          </optgroup>
                        </select>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[9px] font-black uppercase border border-slate-200">
                          {item.kind || "standard"}
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-right flex justify-end gap-2 items-center h-full">
                      {activeTab === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleApprove(item)}
                            className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-emerald-600 transition-colors cursor-pointer shadow-sm"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleReject(item)}
                            className="bg-slate-200 text-slate-600 px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors cursor-pointer shadow-sm"
                            title="Reject & Blacklist"
                          >
                            <Ban size={14} />
                          </button>
                        </>
                      )}
                      {activeTab === 'live' && (
                        <>
                          {editModeId === item.id ? (
                            <button 
                              onClick={() => handleApprove(item)}
                              className="p-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer shadow-sm"
                              title="Save Changes"
                            >
                              <Save size={16} />
                            </button>
                          ) : (
                            <button 
                              onClick={() => setEditModeId(item.id)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Feed"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Feed"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MODAL */}
      {isAdding && (
        <div 
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4"
          onClick={() => setIsAdding(false)}
        >
          <div 
            className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl border-2 border-black flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsAdding(false)} 
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-black transition-all z-10 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="p-8 border-b-2 border-black bg-slate-50/30">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-black flex items-center gap-2">
                <Video size={24} /> Deploy New Live Feed
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">City Name</label>
                  <input required value={formData.city_name} onChange={e => setFormData({...formData, city_name: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold focus:border-blue-500 focus:outline-none" placeholder="e.g. Seattle" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">State / Region (Optional)</label>
                  <input value={formData.state_name} onChange={e => setFormData({...formData, state_name: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold focus:border-blue-500 focus:outline-none" placeholder="e.g. Washington" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media Type</label>
                <select value={formData.kind} onChange={e => setFormData({...formData, kind: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold focus:border-blue-500 focus:outline-none">
                  <option value="standard">Standard Web Camera</option>
                  <option value="wildlife-cam">Zoo & Wildlife Cam (Right Rail)</option>
                  <option value="weather-cam">Weather & Storm Cam (Right Rail)</option>
                  <option value="skyline-cam">Skyline & Traffic (Right Rail)</option>
                  <option value="360_tour">360° Virtual Tour (Featured Top Row)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Display Title</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold focus:border-blue-500 focus:outline-none" placeholder="e.g. Seattle Zoo Wildlife Cam" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Embed URL (iframe src)</label>
                <input required value={formData.embed_url} onChange={e => setFormData({...formData, embed_url: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-xl font-mono text-xs focus:border-blue-500 focus:outline-none" placeholder="https://www.youtube.com/embed/..." />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 rounded-full font-black text-[11px] uppercase tracking-widest text-slate-500 hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" className="bg-black text-white px-8 py-3 rounded-full font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 cursor-pointer shadow-lg transition-colors">Deploy Feed</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL (STANDARD UI) */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={() => setPreviewUrl(null)}
        >
          <div 
            className="bg-white w-full max-w-5xl rounded-[24px] md:rounded-[32px] shadow-2xl overflow-hidden flex flex-col border-2 border-slate-900 relative animate-in zoom-in-95 duration-200 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER BRANDING CONTROL AREA */}
            <div className="px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center bg-white z-20 shrink-0">
              <div className="flex flex-col pr-4">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter text-slate-900 leading-tight">LIVE FEED PREVIEW</h2>
                <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">ADMINISTRATIVE PERSPECTIVE</span>
              </div>
              
              <button 
                onClick={() => setPreviewUrl(null)} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-all cursor-pointer shrink-0"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            {/* MASTER DISPLAY LAYER */}
            <div className="w-full aspect-video max-h-[70vh] relative bg-black shrink-0 flex items-center justify-center">
              <div className="absolute inset-0 z-10" />
              <iframe 
                src={previewUrl ? (previewUrl.includes('?') ? `${previewUrl}&controls=0&modestbranding=1&rel=0&disablekb=1` : `${previewUrl}?controls=0&modestbranding=1&rel=0&disablekb=1`) : ''}
                className="absolute inset-0 w-full h-full border-none pointer-events-none"
                allowFullScreen 
                allow="autoplay; encrypted-media" 
              />
            </div>

            {/* FOOTER ACTION CONTROLS & AD SLOT */}
            <div className="p-4 bg-slate-50 border-t-2 border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <button 
                onClick={() => setPreviewUrl(null)} 
                className="w-full sm:w-auto bg-slate-900 text-white px-8 py-3.5 rounded-full font-black text-[11px] tracking-[0.2em] uppercase hover:bg-blue-600 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
              >
                Close Preview
              </button>
              
              <div className="w-full sm:w-[320px] shrink-0">
                  <AdPlaceholder />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
