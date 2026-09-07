"use client";

import React, { useEffect, useState } from 'react';

interface CityReport {
  id: number;
  city_name: string;
  state_name: string;
  lat: number;
  lng: number;
  report_type: string;
  content: string;
  created_at: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<CityReport[]>([]);
  const [loading, setLoading] = useState(true);

  // We fetch the data on the client side to allow the button to work
  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/admin/get-reports'); // We will create this simple helper next
        const data = await res.json();
        if (data.reports) setReports(data.reports);
      } catch (err) {
        console.error("Failed to load library:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  const handleView = (content: string) => {
    const preview = content.substring(0, 1500);
    alert(`CITY INTELLIGENCE ARCHIVE:\n\n${preview}${content.length > 1500 ? '...' : ''}`);
  };

  if (loading) return <div className="p-20 text-center font-black uppercase tracking-widest text-slate-400">Loading Library...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">
            City Intelligence Catalogue
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-wide text-xs">
            Viewing archived city intelligence stored in the LiveTimeData Library.
          </p>
        </header>

        <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Location</th>
                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Type</th>
                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Coordinates</th>
                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Archived</th>
                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="p-8">
                    <span className="font-black text-lg tracking-tight">
                      {report.city_name}, {report.state_name}
                    </span>
                  </td>
                  <td className="p-8 text-center">
                    <span className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter border ${
                      report.report_type?.toLowerCase() === 'facts' 
                        ? 'bg-purple-50 text-purple-600 border-purple-100' 
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {report.report_type || 'About'}
                    </span>
                  </td>
                  <td className="p-8">
                    <span className="font-mono text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md">
                      {report.lat}, {report.lng}
                    </span>
                  </td>
                  <td className="p-8 text-slate-500 font-bold text-sm">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-8 text-right">
                    <button 
                      onClick={() => handleView(report.content)}
                      className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95"
                    >
                      View Intelligence
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {reports.length === 0 && (
            <div className="p-32 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-sm">
              Library Empty
            </div>
          )}
        </div>
      </div>
    </div>
  );
}