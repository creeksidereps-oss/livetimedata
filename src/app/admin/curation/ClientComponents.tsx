'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptAction, needsAttentionAction, stealthLegalHoldAction, hardTrashAction, editItemAction, trustSourceAction, massReleaseAction, adminOverrideMassPublishAction, cloneEventAction } from './actions';
import PremiumEventModal from '@/components/PremiumEventModal';

function formatEventTime(dateString: string | null, status: string) {
  if (!dateString) return "UNKNOWN";
  const date = new Date(dateString);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  if (status.includes("approved")) {
    return `APPROVED: ${formatted}`;
  }
  return `SUBMITTED: ${formatted}`;
}


export function AIEventProcessor() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const processInput = async () => {
    setLoading(true);
    setResult(null);
    try {
      if (imageFile) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const res = await fetch("/api/events/autofill-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64 })
          });
          const data = await res.json();
          setResult(data.event || data.error);
          setLoading(false);
        };
        reader.readAsDataURL(imageFile);
      } else if (input) {
        const res = await fetch("/api/events/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: input })
        });
        const data = await res.json();
        setResult(data.event || data.error);
        setLoading(false);
      }
    } catch (err: any) {
      setResult({ error: err.message });
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg shadow hover:shadow-lg transition-all text-sm uppercase tracking-wider mb-4"
      >
        ✨ Open AI Event Processor
      </button>
    );
  }

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 shadow-xl mb-8 relative">
      <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold">
        ✕
      </button>
      <h2 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-wider">✨ Internal AI Processor</h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Upload Flyer Image</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
        <div className="text-xs font-bold text-gray-400 uppercase text-center">- OR -</div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Paste URL or Press Release</label>
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full border border-gray-300 rounded p-3 text-sm"
            rows={3}
          />
        </div>
        <button 
          onClick={processInput}
          disabled={loading || (!input && !imageFile)}
          className="bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Extract Event Data"}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Extracted Data (JSON)</h3>
            <pre className="text-[10px] text-slate-700">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

import CitySearch from '@/components/CitySearch';

export function ScraperControl() {
  const [cityName, setCityName] = useState("");
  const [stateName, setStateName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGovProcessing, setIsGovProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runScraper = async (city?: string, state?: string) => {
    const targetCity = city || cityName;
    const targetState = state || stateName;
    if (!targetCity) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/scraper/webcams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityName: targetCity, stateName: targetState })
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ ok: false, error: err.message });
    }
    setIsProcessing(false);
  };

  const handleCitySelect = (city: any) => {
    setCityName(city.name);
    setStateName(city.admin1 || city.country_name || "");
    // Automatically run the scraper when they select a city
    runScraper(city.name, city.admin1 || city.country_name || "");
  };

  const handleGovSync = async () => {
    setIsGovProcessing(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/scraper/government', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ ok: false, error: err.message });
    }
    setIsGovProcessing(false);
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 mb-1 uppercase tracking-wider">📡 Webcam Aggregation Engine</h2>
          <p className="text-xs text-slate-500 font-bold uppercase">Search for a city to automatically trigger the YouTube scraper.</p>
        </div>
        <button 
          onClick={handleGovSync}
          disabled={isGovProcessing}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-lg shadow-sm border ${isGovProcessing ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'}`}
        >
          {isGovProcessing ? 'Syncing...' : 'Sync Gov Cams'}
        </button>
      </div>
      
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md relative z-[300]">
          <CitySearch onSelectOverride={handleCitySelect} />
        </div>
        {cityName && (
          <div className="text-sm font-bold uppercase text-slate-700">
            Target: {cityName}, {stateName}
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="mt-4 p-3 text-xs font-bold uppercase rounded border bg-blue-50 text-blue-800 border-blue-200">
          Scraping YouTube for {cityName}... Please wait.
        </div>
      )}

      {result && !isProcessing && !isGovProcessing && (
        <div className={`mt-4 p-3 text-xs font-bold uppercase rounded border ${result.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {result.message || result.error || JSON.stringify(result)}
        </div>
      )}
    </div>
  );
}

export function DashboardControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentTab = searchParams.get('tab') || 'events';
  const currentFilter = searchParams.get('filter') || 'pending';

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="mb-6 space-y-4">
      <AIEventProcessor />
      {currentTab === 'webcams' && <ScraperControl />}
      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 pb-2">
        {['events', 'webcams', 'photos', 'franchises'].map((tab) => (
          <button
            key={tab}
            onClick={() => updateParams('tab', tab)}
            className={`px-4 py-2 text-sm font-bold uppercase rounded-t-lg ${
              currentTab === tab ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex space-x-2 flex-wrap gap-y-2">
        <button
          onClick={() => updateParams('filter', 'pending')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-full border ${
            currentFilter === 'pending' ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          Needs Review
        </button>
        <button
          onClick={() => updateParams('filter', 'ai_approved')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-full border ${
            currentFilter === 'ai_approved' ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          AI Pre-Approved
        </button>
        <button
          onClick={() => updateParams('filter', 'approved')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-full border ${
            currentFilter === 'approved' ? 'bg-green-100 border-green-400 text-green-800' : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          Approved & Active
        </button>
        {currentTab === 'webcams' && (
          <button
            onClick={() => updateParams('filter', 'government')}
            className={`px-4 py-2 text-xs font-bold uppercase rounded-full border ${
              currentFilter === 'government' ? 'bg-indigo-100 border-indigo-400 text-indigo-800 shadow-sm' : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            🏛️ Government Feeds
          </button>
        )}
        <button
          onClick={() => updateParams('filter', 'historical')}
          className={`px-4 py-2 text-xs font-bold uppercase rounded-full border ${
            currentFilter === 'historical' ? 'bg-gray-200 border-gray-400 text-gray-800' : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          Historical Archive
        </button>
      </div>
    </div>
  );
}

export function MassReleaseButton({ items }: { items: any[] }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const handleMassRelease = async () => {
    setIsProcessing(true);
    await massReleaseAction(items);
    setIsProcessing(false);
    router.refresh();
  };

  return (
    <div className="mb-4 bg-purple-50 border border-purple-200 p-4 rounded-xl flex justify-between items-center">
      <div>
        <h3 className="font-bold text-purple-900">Ready for Mass Release</h3>
        <p className="text-sm text-purple-700">These {items.length} events have been scanned by AI and flagged as clean.</p>
      </div>
      <button 
        onClick={handleMassRelease}
        disabled={isProcessing}
        className="bg-purple-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-purple-700 uppercase"
      >
        {isProcessing ? "Releasing..." : "Release All to Live"}
      </button>
    </div>
  );
}

export function FranchiseBuilder({ items }: { items: any[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [locations, setLocations] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<number | null>(null);
  const [franchiseLocs, setFranchiseLocs] = useState<any[]>([]);
  const [appendLocs, setAppendLocs] = useState('');
  
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const { createFranchiseAction } = await import('./actions');
    await createFranchiseAction(name, email, locations);
    setName('');
    setEmail('');
    setLocations('');
    setIsProcessing(false);
    router.refresh();
  };

  const handleManage = async (id: number) => {
    if (selectedFranchiseId === id) {
      setSelectedFranchiseId(null);
      return;
    }
    setIsProcessing(true);
    const { getFranchiseLocationsAction } = await import('./actions');
    const res = await getFranchiseLocationsAction(id);
    if (res.success) {
      setFranchiseLocs(res.locations || []);
      setSelectedFranchiseId(id);
    } else {
      alert("Error: " + res.error);
    }
    setIsProcessing(false);
  };

  const handleDeleteLoc = async (locId: number) => {
    setIsProcessing(true);
    const { deleteFranchiseLocationAction } = await import('./actions');
    await deleteFranchiseLocationAction(locId);
    setFranchiseLocs(prev => prev.filter(l => l.id !== locId));
    setIsProcessing(false);
    router.refresh();
  };

  const handleAppendLocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseId) return;
    setIsProcessing(true);
    const { appendFranchiseLocationsAction, getFranchiseLocationsAction } = await import('./actions');
    await appendFranchiseLocationsAction(selectedFranchiseId, appendLocs);
    setAppendLocs('');
    
    // Refresh the list
    const res = await getFranchiseLocationsAction(selectedFranchiseId);
    if (res.success) setFranchiseLocs(res.locations || []);
    
    setIsProcessing(false);
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 mb-4 uppercase">Create Franchise Library</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Franchise Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bass Pro Shops" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Corporate Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. corporate@basspro.com" className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Paste Location List (City, State)</label>
            <textarea required value={locations} onChange={e => setLocations(e.target.value)} placeholder="Charlotte NC, Raleigh NC..." rows={6} className="w-full p-2 border rounded text-sm" />
          </div>
          <button disabled={isProcessing} type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg uppercase">
            {isProcessing ? 'Building Library...' : 'Build Franchise Library'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 mb-4 uppercase">Existing Libraries</h2>
        <div className="space-y-3 max-h-[700px] overflow-y-auto">
          {items.map(f => (
            <div key={f.id} className="p-3 border rounded bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">{f.name}</h3>
                  <p className="text-xs text-gray-500">{f.corporate_email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    {f.location_count || 0} Locations
                  </span>
                  <button 
                    onClick={() => handleManage(f.id)} 
                    disabled={isProcessing}
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-800 px-2 py-0.5 rounded font-bold uppercase transition"
                  >
                    {selectedFranchiseId === f.id ? 'Close' : 'Manage'}
                  </button>
                </div>
              </div>
              
              {selectedFranchiseId === f.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-bold uppercase text-slate-700 mb-2">Locations List</h4>
                  <div className="max-h-[200px] overflow-y-auto border rounded bg-white p-2 text-xs mb-3">
                    {franchiseLocs.length === 0 ? <p className="text-gray-400 italic">No locations found.</p> : (
                      franchiseLocs.map(loc => (
                        <div key={loc.id} className="flex justify-between items-center py-1 border-b last:border-0 hover:bg-gray-50">
                          <span className="truncate pr-2">{loc.city_name}, {loc.state_name} <span className="text-gray-400">({loc.local_address})</span></span>
                          <button onClick={() => handleDeleteLoc(loc.id)} disabled={isProcessing} className="text-red-600 hover:text-red-800 font-bold px-1">X</button>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <form onSubmit={handleAppendLocs} className="space-y-2 border-t pt-3">
                    <label className="block text-[10px] font-bold text-gray-700 uppercase">Append More Locations</label>
                    <textarea required value={appendLocs} onChange={e => setAppendLocs(e.target.value)} placeholder="Paste new locations here..." rows={3} className="w-full p-2 border rounded text-xs" />
                    <button disabled={isProcessing} type="submit" className="w-full bg-blue-600 text-white font-bold py-1.5 rounded text-xs uppercase">
                      Add to Library
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-500">No franchises added yet.</p>}
        </div>
      </div>
    </div>
  );
}

export function RowCard({ item, type }: { item: any; type: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editData, setEditData] = useState({ 
    title: item.title, category: item.category, venue: item.venue, details: item.details,
    city_name: item.city_name, state_name: item.state_name, venue_address: item.venue_address || '',
    hosting_entity: item.hosting_entity || '', contact_email: item.contact_email || '', contact_phone: item.contact_phone || '',
    start_time: item.start_time, event_date: item.event_date ? new Date(item.event_date).toISOString().split('T')[0] : '',
    social_urls: item.social_urls || '', official_info_url: item.official_info_url || '',
    affiliate_url: item.affiliate_url || '', registration_url: item.registration_url || '',
    event_flyer_url: item.event_flyer_url || '', display_order: item.display_order || 0
  });

  const isNeedsAttention = item.status === 'needs_attention';

  const handleAction = async (actionFn: Function, ...args: any[]) => {
    setIsProcessing(true);
    try {
      const res = await actionFn(...args);
      if (res && res.success === false) {
        alert("Action failed: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setIsProcessing(false);
  };

  const handleEditSave = async () => {
    await handleAction(editItemAction, item.id, type, editData);
    setIsEditing(false);
  };

  return (
    <div className={`p-4 mb-4 border rounded-xl shadow-sm bg-white ${isNeedsAttention ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-grow">
          {isEditing ? (
            <div className="space-y-2 mb-3">
              {type === 'photo' ? (
                <div className="flex flex-col gap-3">
                  {item.image_url && <img src={item.image_url} className="max-h-64 object-contain rounded border border-gray-300 self-start" alt="Submission preview" />}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">Title / Caption</label>
                      <input type="text" value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900" placeholder="Title" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">Block Placement (1-12)</label>
                      <select value={editData.display_order || 1} onChange={e => setEditData({...editData, display_order: parseInt(e.target.value) || 1})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900 cursor-pointer">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                          <option key={num} value={num}>Block {num}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">City</label>
                      <input type="text" value={editData.city_name || ''} onChange={e => setEditData({...editData, city_name: e.target.value})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900" placeholder="City" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">State</label>
                      <input type="text" value={editData.state_name || ''} onChange={e => setEditData({...editData, state_name: e.target.value})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900" placeholder="State" />
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-2">
                    <button onClick={handleEditSave} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider">Save Changes</button>
                    <button onClick={async () => {
                      setIsProcessing(true);
                      const { clonePhotoAction } = await import('./actions');
                      const res = await clonePhotoAction({...editData, image_url: item.image_url});
                      setIsProcessing(false);
                      if (res.success) {
                        alert("Photo Successfully Copied! The new copy is now at the top of your pending list.");
                        setIsEditing(false);
                      } else {
                        alert("Copy Failed: " + res.error);
                      }
                    }} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider">Save As New Copy (Other City / Block)</button>
                    <button onClick={() => setIsEditing(false)} className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider">Cancel</button>
                  </div>
                </div>
              ) : type === 'webcam' ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">Title</label>
                      <input type="text" value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900" placeholder="Title" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">Block Placement (1-12)</label>
                      <select value={editData.display_order || 1} onChange={e => setEditData({...editData, display_order: parseInt(e.target.value) || 1})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900 cursor-pointer">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                          <option key={num} value={num}>Block {num}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">City</label>
                      <input type="text" value={editData.city_name || ''} onChange={e => setEditData({...editData, city_name: e.target.value})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900" placeholder="City" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 uppercase">State</label>
                      <input type="text" value={editData.state_name || ''} onChange={e => setEditData({...editData, state_name: e.target.value})} className="w-full p-2.5 border-2 border-slate-500 rounded-lg text-sm font-bold bg-white text-slate-900" placeholder="State" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button onClick={handleEditSave} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider">Save Changes</button>
                    <button onClick={async () => {
                      setIsProcessing(true);
                      const { cloneWebcamAction } = await import('./actions');
                      const res = await cloneWebcamAction({
                        title: editData.title,
                        city_name: editData.city_name,
                        state_name: editData.state_name,
                        embed_url: item.embed_url,
                        image_url: item.image_url,
                        kind: item.kind,
                        source: item.source,
                        display_order: editData.display_order
                      });
                      setIsProcessing(false);
                      if (res.success) {
                        alert(`Webcam Successfully Copied to ${editData.city_name || 'new city'}! It is now active.`);
                        setIsEditing(false);
                      } else {
                        alert("Copy Failed: " + res.error);
                      }
                    }} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider">Save As New Copy (Other City / Block)</button>
                    <button onClick={async () => {
                      const inputCities = prompt("Enter comma-separated cities to copy this webcam to (e.g., Wrangell, Ketchikan, Juneau, Anchorage):", "Wrangell, Ketchikan");
                      if (!inputCities) return;
                      const cities = inputCities.split(',').map(c => c.trim()).filter(Boolean);
                      if (cities.length === 0) return;
                      setIsProcessing(true);
                      const { syndicateWebcamToCitiesAction } = await import('./actions');
                      const res = await syndicateWebcamToCitiesAction({
                        title: editData.title,
                        state_name: editData.state_name,
                        embed_url: item.embed_url,
                        image_url: item.image_url,
                        kind: item.kind,
                        source: item.source,
                        display_order: editData.display_order
                      }, cities);
                      setIsProcessing(false);
                      if (res.success) {
                        alert(`Successfully syndicated this webcam to: ${cities.join(', ')}!`);
                        setIsEditing(false);
                      } else {
                        alert("Syndication Failed: " + res.error);
                      }
                    }} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider">Distribute Across Multiple Cities</button>
                    <button onClick={() => setIsEditing(false)} className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="w-full p-2 border rounded text-sm font-bold" placeholder="Title" />
                    <input type="text" value={editData.category || ''} onChange={e => setEditData({...editData, category: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Category" />
                    <input type="text" value={editData.venue || ''} onChange={e => setEditData({...editData, venue: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Venue Name" />
                    <input type="text" value={editData.venue_address || ''} onChange={e => setEditData({...editData, venue_address: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Venue Address" />
                    <div className="flex gap-2">
                      <input type="text" value={editData.city_name || ''} onChange={e => setEditData({...editData, city_name: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="City" />
                      <input type="text" value={editData.state_name || ''} onChange={e => setEditData({...editData, state_name: e.target.value})} className="w-24 p-2 border rounded text-sm" placeholder="State" />
                    </div>
                    <input type="number" value={editData.display_order || 0} onChange={e => setEditData({...editData, display_order: parseInt(e.target.value) || 1})} className="w-full p-2 border rounded text-sm" placeholder="Block Placement (1-12)" />
                    <input type="text" value={editData.hosting_entity || ''} onChange={e => setEditData({...editData, hosting_entity: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Hosting Entity / Sponsor" />
                    <input type="date" value={editData.event_date || ''} onChange={e => setEditData({...editData, event_date: e.target.value})} className="w-full p-2 border rounded text-sm" />
                    <input type="text" value={editData.start_time || ''} onChange={e => setEditData({...editData, start_time: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Start Time" />
                    <input type="email" value={editData.contact_email || ''} onChange={e => setEditData({...editData, contact_email: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Contact Email" />
                    <input type="text" value={editData.contact_phone || ''} onChange={e => setEditData({...editData, contact_phone: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Contact Phone" />
                    <input type="text" value={editData.official_info_url || ''} onChange={e => setEditData({...editData, official_info_url: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Official Info URL" />
                    <input type="text" value={editData.social_urls || ''} onChange={e => setEditData({...editData, social_urls: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Social URLs" />
                    <input type="text" value={editData.affiliate_url || ''} onChange={e => setEditData({...editData, affiliate_url: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Ticket URL" />
                    <input type="text" value={editData.registration_url || ''} onChange={e => setEditData({...editData, registration_url: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Vendor URL" />
                    <input type="text" value={editData.event_flyer_url || ''} onChange={e => setEditData({...editData, event_flyer_url: e.target.value})} className="w-full p-2 border rounded text-sm col-span-2" placeholder="Event Flyer URL" />
                  </div>
                  <textarea value={editData.details || ''} onChange={e => setEditData({...editData, details: e.target.value})} className="w-full p-2 border rounded text-sm mt-2" placeholder="Details" rows={3} />
                  <div className="flex space-x-2 mt-2">
                    <button onClick={handleEditSave} disabled={isProcessing} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold">Save Changes</button>
                    <button onClick={async () => {
                      setIsProcessing(true);
                      const res = await cloneEventAction(editData);
                      setIsProcessing(false);
                      if (res.success) setIsEditing(false);
                    }} disabled={isProcessing} className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold">Clone to New Date</button>
                    <button onClick={() => setIsEditing(false)} className="bg-gray-400 text-white px-4 py-2 rounded text-xs font-bold">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-gray-900">{item.title}</h3>
                {item.event_date && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    {new Date(item.event_date).toLocaleDateString()} @ {item.start_time || 'TBD'}
                  </span>
                )}
              </div>
              <div className="flex gap-2 text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">
                <span className="bg-gray-100 px-2 py-0.5 rounded">{formatEventTime(item.created_at, item.status)}</span>
                {item.updated_at && item.updated_at !== item.created_at && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Status Changed: {new Date(item.updated_at).toLocaleDateString()}</span>
                )}
              </div>
              <p className="text-xs font-bold text-gray-500 mt-1">
                {item.venue} • {item.city_name}, {item.state_name} • {item.category}
                {item.hosting_entity && <span className="text-purple-600"> • Hosted by: {item.hosting_entity}</span>}
              </p>
              <p className="text-xs text-gray-700 mt-2 line-clamp-3 bg-white p-2 border border-gray-100 rounded">{item.details}</p>
              
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {type === 'photo' && item.image_url && (
                  <div className="col-span-full border p-2 rounded bg-gray-50 flex flex-col gap-2">
                    <span className="font-bold text-xs uppercase text-gray-500">Submitted Photo</span>
                    <img src={item.image_url} alt="Submission" className="w-full max-w-sm rounded object-contain max-h-64 border border-gray-300" />
                  </div>
                )}
                {type === 'webcam' && (item.embed_url || item.image_url) && (
                  <div className="col-span-full border p-2 rounded bg-gray-50 flex flex-col gap-2">
                    <span className="font-bold text-xs uppercase text-gray-500">Live Camera Feed</span>
                    {item.embed_url ? (
                      <iframe
                        src={item.embed_url}
                        title={item.title}
                        className="w-full max-w-lg aspect-video rounded border border-gray-300 shadow-sm"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <img src={item.image_url} alt={item.title} className="w-full max-w-sm rounded object-cover max-h-64 border border-gray-300" />
                    )}
                  </div>
                )}
                {item.official_info_url && (
                  <div className="text-[10px] bg-blue-50 border border-blue-100 p-1.5 rounded">
                    <span className="font-bold text-blue-800 uppercase mr-1">Official Web:</span>
                    <a href={item.official_info_url} target="_blank" className="text-blue-600 truncate inline-block max-w-[200px] align-bottom hover:underline">{item.official_info_url}</a>
                  </div>
                )}
                {item.social_urls && (
                  <div className="text-[10px] bg-indigo-50 border border-indigo-100 p-1.5 rounded">
                    <span className="font-bold text-indigo-800 uppercase mr-1">Social:</span>
                    <span className="text-indigo-600 truncate inline-block max-w-[200px] align-bottom">{item.social_urls}</span>
                  </div>
                )}
                {item.affiliate_url && (
                  <div className="text-[10px] bg-green-50 border border-green-100 p-1.5 rounded">
                    <span className="font-bold text-green-800 uppercase mr-1">Tickets:</span>
                    <a href={item.affiliate_url} target="_blank" className="text-green-600 truncate inline-block max-w-[200px] align-bottom hover:underline">{item.affiliate_url}</a>
                  </div>
                )}
                {item.registration_url && (
                  <div className="text-[10px] bg-orange-50 border border-orange-100 p-1.5 rounded">
                    <span className="font-bold text-orange-800 uppercase mr-1">Vendor:</span>
                    <a href={item.registration_url} target="_blank" className="text-orange-600 truncate inline-block max-w-[200px] align-bottom hover:underline">{item.registration_url}</a>
                  </div>
                )}
                {item.event_flyer_url && (
                  <div className="text-[10px] bg-pink-50 border border-pink-100 p-1.5 rounded col-span-full">
                    <span className="font-bold text-pink-800 uppercase mr-1">Event Flyer:</span>
                    <a href={item.event_flyer_url} target="_blank" className="text-pink-600 hover:underline">{item.event_flyer_url}</a>
                  </div>
                )}
              </div>

              <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-100 flex justify-between items-center">
                <p className="text-[11px] text-gray-600">
                  <span className="font-bold">Submitter:</span> {item.user_name} ({item.user_email})
                  {item.contact_email && <span> | <span className="font-bold">Contact:</span> {item.contact_email}</span>}
                </p>
                <button 
                  onClick={() => handleAction(trustSourceAction, item.user_email)}
                  disabled={isProcessing}
                  className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded font-bold uppercase transition"
                >
                  Trust Source
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="ml-4 flex flex-col space-y-2">
          {!isEditing && (
            <div className="flex gap-2 w-full">
              <button onClick={() => setIsEditing(true)} className="flex-1 px-3 py-1 border border-gray-300 rounded text-xs font-bold bg-white text-gray-700 text-center">Edit</button>
              {type === 'event' && (
                <button onClick={() => setIsPreviewing(true)} className="flex-1 px-3 py-1 border border-indigo-200 rounded text-xs font-bold bg-indigo-50 text-indigo-700 text-center hover:bg-indigo-100">Preview</button>
              )}
            </div>
          )}
          <button 
            disabled={isProcessing}
            onClick={() => handleAction(acceptAction, item.id, type, item.user_email, item.title)} 
            className="px-3 py-1 bg-green-600 rounded text-xs font-bold text-white uppercase"
          >
            Accept
          </button>
          <button 
            disabled={isProcessing}
            onClick={() => handleAction(needsAttentionAction, item.id, type)} 
            className="px-3 py-1 bg-yellow-500 rounded text-xs font-bold text-white uppercase"
          >
            Attention
          </button>
          {item.status === 'franchise_pending' && item.franchise_id && (
            <button 
              disabled={isProcessing}
              onClick={() => handleAction(adminOverrideMassPublishAction, item.id, item.franchise_id)} 
              className="px-3 py-1 bg-purple-600 rounded text-xs font-bold text-white uppercase mt-2 shadow-sm border border-purple-800"
            >
              Override & Mass Publish
            </button>
          )}
          <button 
            disabled={isProcessing}
            onClick={() => handleAction(stealthLegalHoldAction, item.id, type, item.user_email || 'unknown', JSON.stringify(item))} 
            className="px-3 py-1 bg-slate-800 rounded text-xs font-bold text-white uppercase"
          >
            Legal Hold
          </button>
          <button 
            disabled={isProcessing}
            onClick={() => handleAction(hardTrashAction, item.id, type)} 
            className="px-3 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase"
          >
            Trash
          </button>
        </div>
      </div>

      {isPreviewing && (
        <PremiumEventModal 
          event={{
            id: item.id.toString(),
            title: item.title,
            time: item.start_time,
            eventDate: item.event_date ? new Date(item.event_date).toISOString() : '',
            categories: [item.category],
            venue: item.venue,
            details: item.details,
            affiliateUrl: item.affiliate_url,
            event_flyer_url: item.event_flyer_url,
            registration_url: item.registration_url,
            official_info_url: item.official_info_url,
            social_urls: item.social_urls,
            source: item.source || "User Submission"
          }}
          citySegment={item.city_name || "City"}
          stateSegment={item.state_name || "State"}
          onClose={() => setIsPreviewing(false)}
        />
      )}
    </div>
  );
}

export function GovCameraCard({ item }: { item: any }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const { hardTrashAction } = await import('./actions');
      await hardTrashAction(item.id, 'webcam');
      router.refresh();
    } catch (e) {
      alert("Error deleting camera");
    }
    setIsProcessing(false);
  };

  return (
    <div className="p-4 mb-4 border border-indigo-100 rounded-xl shadow-sm bg-indigo-50/30 flex gap-4 items-center">
      <div className="w-48 h-32 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 relative">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
        ) : item.embed_url ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-white">Video Stream</div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-white">No Feed</div>
        )}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
          {item.source}
        </div>
      </div>
      
      <div className="flex-grow">
        <h3 className="text-sm font-black text-gray-900 mb-1">{item.title}</h3>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {item.city_name}, {item.state_name}
        </p>
        <div className="flex gap-2">
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            Status: {item.status}
          </span>
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            Views: {item.view_count || 0}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 ml-4">
        <button 
          onClick={handleDelete}
          disabled={isProcessing}
          className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 rounded text-xs font-bold uppercase transition"
        >
          {isProcessing ? '...' : 'Remove'}
        </button>
      </div>
    </div>
  );
}
