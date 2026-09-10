"use client";

import React, { useState } from 'react';
import { UploadCloud, Mail, Sparkles, CheckCircle, AlertCircle, Calendar } from 'lucide-react';

export default function EventIngestionUI() {
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file && !text) {
      setError("Please provide an image or text payload.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      if (file && activeTab === 'image') formData.append('image', file);
      if (text && activeTab === 'text') formData.append('text', text);

      const res = await fetch('/api/admin/events/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process event.');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600" />
            AI Event Ingestion
          </h1>
          <p className="text-slate-500 mt-2 text-base font-medium">
            Upload a flyer or paste a forwarded email to instantly extract event details.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6 border border-gray-200">
              <button
                onClick={() => setActiveTab('image')}
                className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'image' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                Flyer Upload
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email Text
              </button>
            </div>

            {activeTab === 'image' ? (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-slate-50/60 hover:border-blue-500 hover:bg-blue-50/20 transition-colors">
                <UploadCloud className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-1">Drag & Drop Flyer</h3>
                <p className="text-slate-400 text-sm mb-6 font-medium">Supports JPG, PNG, WEBP</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-black file:uppercase file:tracking-wider file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                />
                {file && <p className="mt-4 text-emerald-600 font-bold text-sm">Selected: {file.name}</p>}
              </div>
            ) : (
              <div className="flex flex-col h-[300px]">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the raw text of the forwarded email or event description here..."
                  className="w-full flex-1 bg-white border border-gray-300 rounded-xl p-4 text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-medium text-sm leading-relaxed"
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || (activeTab === 'image' && !file) || (activeTab === 'text' && !text)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/10 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze with Gemini AI
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col relative overflow-hidden">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-slate-900">
              <Calendar className="w-5 h-5 text-blue-600" />
              Extraction Results
            </h2>

            {!result && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-slate-400" />
                </div>
                <p className="font-semibold text-sm">Upload a flyer or paste text to see AI results.</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-blue-600 py-12">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p className="animate-pulse font-bold text-sm text-slate-700">Gemini is analyzing the event data...</p>
              </div>
            )}

            {result && (
              <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className={`p-4 rounded-xl border flex items-center gap-4 ${result.aiConfidence >= 90 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                  {result.aiConfidence >= 90 ? <CheckCircle className="w-7 h-7 text-emerald-600 shrink-0" /> : <AlertCircle className="w-7 h-7 text-amber-600 shrink-0" />}
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wide">Confidence Score: {result.aiConfidence}%</h3>
                    <p className="text-xs font-semibold opacity-90 mt-0.5">
                      {result.event.status === 'live' ? 'High confidence. Event is now live on the calendar!' : 'Missing details. Event routed to pending_review queue.'}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50/70 border border-gray-200 rounded-xl p-5 space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black block mb-1">Event Title</label>
                    <p className="text-base font-black text-slate-900">{result.event.title}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black block mb-1">Date</label>
                      <p className="font-bold text-slate-800 text-sm">{new Date(result.event.eventDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black block mb-1">Time</label>
                      <p className="font-bold text-slate-800 text-sm">{result.event.startTime}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black block mb-1">Venue</label>
                      <p className="font-bold text-slate-800 text-sm">{result.event.venue}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black block mb-1">City</label>
                      <p className="font-bold text-slate-800 text-sm">{result.event.cityName}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black block mb-1">Category</label>
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-black uppercase tracking-wider border border-blue-200">
                      {result.event.category}
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black block mb-1">Details</label>
                    <p className="text-sm text-slate-700 leading-relaxed bg-white p-3.5 rounded-lg border border-gray-200">
                      {result.event.details}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
