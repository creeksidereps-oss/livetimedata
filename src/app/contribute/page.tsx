"use client";

import React, { useState } from 'react';
import { Send, CheckCircle2, MapPin } from 'lucide-react';

export default function ContributePage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const data = {
      cityName: formData.get('cityName'),
      stateName: formData.get('stateName'),
      type: formData.get('type'),
      content: formData.get('content'),
      email: formData.get('email'),
    };

    try {
      const res = await fetch('/api/admin/submit-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) setSubmitted(true);
    } catch (err) {
      alert("System Busy. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 text-center max-w-md animate-in fade-in zoom-in duration-300">
          <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-4">Intelligence Logged</h1>
          <p className="text-slate-500 font-bold text-sm mb-8 uppercase tracking-wide">Your contribution has been added to the review queue.</p>
          <button onClick={() => window.location.href = '/'} className="bg-slate-900 text-white px-8 py-3 rounded-full font-black text-[10px] tracking-[0.2em] uppercase hover:bg-blue-600 transition-all">Return to Site</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">Contribute Intelligence</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Challenge data or provide local insights for the library.</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white rounded-[32px] shadow-2xl border border-slate-200 p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">City Name</label>
              <input name="cityName" required className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="e.g. Statesville" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">State / Region</label>
              <input name="stateName" required className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="e.g. North Carolina" />
            </div>
          </div>

          <div className="mb-8 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Submission Type</label>
            <select name="type" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none">
              <option value="addition">Add Local Information</option>
              <option value="challenge">Challenge Existing Data</option>
              <option value="report">Full Report Submission</option>
            </select>
          </div>

          <div className="mb-8 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Content</label>
            <textarea name="content" required rows={6} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="Describe the information or correction here..." />
          </div>

          <div className="mb-10 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Email (Optional)</label>
            <input name="email" type="email" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="your@email.com" />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white p-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-3 disabled:bg-slate-300"
          >
            {loading ? "Cataloging..." : <><Send size={16} /> Send to Archive</>}
          </button>
        </form>
      </div>
    </div>
  );
}