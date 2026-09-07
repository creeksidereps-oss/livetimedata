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
    <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-400" />
            AI Event Ingestion
          </h1>
          <p className="text-neutral-400 mt-2 text-lg">
            Upload a flyer or paste a forwarded email to instantly extract event details.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex bg-neutral-950 p-1 rounded-xl mb-6 border border-neutral-800">
              <button
                onClick={() => setActiveTab('image')}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'image' ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-500 hover:text-white'
                }`}
              >
                <UploadCloud className="w-5 h-5" />
                Flyer Upload
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'text' ? 'bg-emerald-600/20 text-emerald-400' : 'text-neutral-500 hover:text-white'
                }`}
              >
                <Mail className="w-5 h-5" />
                Email Text
              </button>
            </div>

            {activeTab === 'image' ? (
              <div className="border-2 border-dashed border-neutral-700 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-neutral-950/50 hover:border-blue-500/50 transition-colors">
                <UploadCloud className="w-12 h-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Drag & Drop Flyer</h3>
                <p className="text-neutral-500 mb-6">Supports JPG, PNG, WEBP</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 cursor-pointer"
                />
                {file && <p className="mt-4 text-emerald-400 font-medium">{file.name}</p>}
              </div>
            ) : (
              <div className="flex flex-col h-[300px]">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the raw text of the forwarded email here..."
                  className="w-full flex-1 bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || (activeTab === 'image' && !file) || (activeTab === 'text' && !text)}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Analyze with Gemini AI
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-4 bg-red-950/50 border border-red-900 rounded-xl flex items-start gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl flex flex-col relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
            
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-neutral-200">
              <Calendar className="w-6 h-6" />
              Extraction Results
            </h2>

            {!result && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-neutral-600" />
                </div>
                <p>Submit a payload to see AI results.</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center text-blue-400">
                <div className="w-12 h-12 border-4 border-blue-900 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="animate-pulse">Gemini is analyzing the data...</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className={`p-4 rounded-xl border flex items-center gap-4 ${result.aiConfidence >= 90 ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-amber-950/30 border-amber-900/50 text-amber-400'}`}>
                  {result.aiConfidence >= 90 ? <CheckCircle className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                  <div>
                    <h3 className="font-bold text-lg">Confidence Score: {result.aiConfidence}%</h3>
                    <p className="text-sm opacity-80">
                      {result.event.status === 'live' ? 'High confidence. Event is now live on the calendar!' : 'Missing details. Event routed to pending_review queue.'}
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Event Title</label>
                    <p className="text-lg font-medium">{result.event.title}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Date</label>
                      <p>{new Date(result.event.eventDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Time</label>
                      <p>{result.event.startTime}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Venue</label>
                      <p>{result.event.venue}</p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">City</label>
                      <p>{result.event.cityName}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Category</label>
                    <span className="px-3 py-1 bg-blue-900/40 text-blue-300 rounded-full text-sm font-medium border border-blue-800/50">
                      {result.event.category}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Details</label>
                    <p className="text-sm text-neutral-400 leading-relaxed bg-neutral-900 p-3 rounded-lg border border-neutral-800">
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
          background-color: #3f3f46;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
