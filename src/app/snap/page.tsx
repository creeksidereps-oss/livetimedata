"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Camera,
  Image as ImageIcon,
  Clipboard,
  Globe,
  Mic,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Lock,
  Unlock,
  Calendar,
  Clock,
  Building,
  Tag,
  FileText,
  ArrowRight,
  RefreshCw,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2
} from "lucide-react";

const CATEGORIES = [
  "Concerts",
  "Festivals",
  "Arts",
  "Sports",
  "Community & Civic",
  "Yard / Garage Sales",
  "Kids",
  "Holiday",
  "Nightlife",
  "Comedy",
  "Lectures",
  "Tours",
  "Clubs / Groups",
  "Other"
];

interface ExtractedEvent {
  id: string;
  selected: boolean;
  title: string;
  venueName: string;
  venueAddress: string;
  cityName: string;
  stateName: string;
  startTime: string;
  eventDates: string[];
  category: string;
  details: string;
  performers: string[];
  officialInfoUrl: string;
}

export default function SnapPage() {
  // VIP PIN state
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState("");

  // Location state
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [locating, setLocating] = useState(false);

  // Input Mode: "snap" (camera/screenshot), "url" (web link), "voice" (note/mic)
  const [mode, setMode] = useState<"snap" | "url" | "voice">("snap");

  // Snap Mode state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL Mode state
  const [webUrl, setWebUrl] = useState("");

  // Voice/Text Mode state
  const [textInput, setTextInput] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Parsing & Submission state
  const [isParsing, setIsParsing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Extracted Events Array (supports single or multi-event flyers/schedules)
  const [parsedEvents, setParsedEvents] = useState<ExtractedEvent[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Success state
  const [publishedData, setPublishedData] = useState<{
    count: number;
    events: Array<{ id: number; title: string; cityName: string; eventUrl: string }>;
  } | null>(null);

  // Load saved PIN on mount
  useEffect(() => {
    const savedPin = localStorage.getItem("ltd_quick_pin");
    if (savedPin === "0059") {
      setPin("0059");
      setIsUnlocked(true);
    }
  }, []);

  // Try auto-GPS on mount if unlocked
  useEffect(() => {
    if (isUnlocked && !city) {
      handleGetLocation();
    }
  }, [isUnlocked]);

  // Global Clipboard Paste Listener (Ctrl+V or mobile paste)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            readAndProcessImageFile(blob);
            break;
          }
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [city, state]);

  function handleUnlockPin(enteredPin: string) {
    setPin(enteredPin);
    if (enteredPin === "0059") {
      localStorage.setItem("ltd_quick_pin", "0059");
      setIsUnlocked(true);
      setPinError("");
      if (!city) handleGetLocation();
    } else if (enteredPin.length >= 4) {
      setPinError("Invalid Passcode. Enter 0059.");
    }
  }

  function handleLogoutPin() {
    localStorage.removeItem("ltd_quick_pin");
    setPin("");
    setIsUnlocked(false);
  }

  // GPS Location handler
  async function handleGetLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
          const data = await res.json();
          if (data.ok && data.city) {
            setCity(data.city);
            setState(data.state || "");
          }
        } catch (e) {
          console.warn("GPS lookup failed:", e);
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  // Helper to read and process image blob/file
  function readAndProcessImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      await triggerAIExtraction({ imageBase64: base64 });
    };
    reader.readAsDataURL(file);
  }

  // Handle Photo selection from camera or gallery
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readAndProcessImageFile(file);
  }

  // Handle Paste from Clipboard button
  async function handleClipboardPaste() {
    try {
      if (!navigator.clipboard?.read) {
        alert("Clipboard access not supported. Use Ctrl+V or paste directly into the box.");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "screenshot.png", { type: imageType });
          readAndProcessImageFile(file);
          return;
        }
      }
      alert("No image found on your clipboard. Take a screenshot, copy it, and try again!");
    } catch (err) {
      console.warn("Clipboard paste error:", err);
      alert("Please paste your screenshot using Ctrl+V or upload it from your photos.");
    }
  }

  // Handle Voice-to-Text via Web Speech API
  function toggleSpeechRecognition() {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser. You can type or use your mobile keyboard microphone directly!");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTextInput((prev) => (prev ? prev + " " + transcript : transcript));
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  }

  // Trigger Gemini 2.5 Flash Quick Parse
  async function triggerAIExtraction(params: { imageBase64?: string; text?: string; url?: string }) {
    setIsParsing(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/events/quick-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          defaultCity: city,
          defaultState: state
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Extraction failed");

      const rawList: any[] = Array.isArray(data.events) ? data.events : [];
      if (rawList.length === 0) {
        throw new Error("No event details could be found. Please check the image or link.");
      }

      const formatted: ExtractedEvent[] = rawList.map((ev, idx) => ({
        id: `ev_${Date.now()}_${idx}`,
        selected: true,
        title: ev.title || "Untitled Event",
        venueName: ev.venueName || "Local Venue",
        venueAddress: ev.venueAddress || "",
        cityName: ev.cityName || city || "",
        stateName: ev.stateName || state || "",
        startTime: ev.startTime || "TBD",
        eventDates: Array.isArray(ev.eventDates) && ev.eventDates.length > 0 ? ev.eventDates : [new Date().toISOString().split("T")[0]],
        category: ev.category || "Community & Civic",
        details: ev.details || "",
        performers: Array.isArray(ev.performers) ? ev.performers : [],
        officialInfoUrl: ev.officialInfoUrl || ""
      }));

      setParsedEvents(formatted);
      if (formatted.length > 0) {
        setExpandedEventId(formatted[0].id);
        if (formatted[0].cityName && !city) setCity(formatted[0].cityName);
        if (formatted[0].stateName && !state) setState(formatted[0].stateName);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to extract details");
    } finally {
      setIsParsing(false);
    }
  }

  // Event field updater
  function updateEventField(id: string, field: keyof ExtractedEvent, value: any) {
    setParsedEvents((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  // Toggle event selection
  function toggleEventSelection(id: string) {
    setParsedEvents((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  }

  // Delete event from batch
  function deleteEvent(id: string) {
    setParsedEvents((prev) => prev.filter((item) => item.id !== id));
  }

  // Add date to specific event
  function handleAddDate(eventId: string, dateStr: string) {
    if (!dateStr) return;
    setParsedEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId && !ev.eventDates.includes(dateStr)) {
          return { ...ev, eventDates: [...ev.eventDates, dateStr] };
        }
        return ev;
      })
    );
  }

  // Remove date from specific event
  function handleRemoveDate(eventId: string, dateStr: string) {
    setParsedEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          return { ...ev, eventDates: ev.eventDates.filter((d) => d !== dateStr) };
        }
        return ev;
      })
    );
  }

  // Publish Selected Events Immediately
  async function handlePublish() {
    const selectedList = parsedEvents.filter((ev) => ev.selected);
    if (selectedList.length === 0) {
      setErrorMsg("Please select at least one event to publish.");
      return;
    }

    setIsPublishing(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/events/quick-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          cityName: city,
          stateName: state,
          flyerBase64: imagePreview,
          events: selectedList.map((ev) => ({
            title: ev.title,
            cityName: ev.cityName || city,
            stateName: ev.stateName || state,
            venueName: ev.venueName,
            venueAddress: ev.venueAddress,
            startTime: ev.startTime || "TBD",
            eventDates: ev.eventDates,
            category: ev.category,
            details: ev.details,
            performers: ev.performers,
            officialInfoUrl: ev.officialInfoUrl
          }))
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Publication failed");

      setPublishedData({
        count: data.count || selectedList.length,
        events: data.events || []
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to publish events");
    } finally {
      setIsPublishing(false);
    }
  }

  // Reset to snap another
  function handleReset() {
    setImagePreview(null);
    setTextInput("");
    setWebUrl("");
    setParsedEvents([]);
    setExpandedEventId(null);
    setPublishedData(null);
    setErrorMsg("");
  }

  const selectedCount = parsedEvents.filter((ev) => ev.selected).length;

  // 1. PIN LOCK SCREEN
  if (!isUnlocked) {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-12 flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-center">Mobile Quick-Post</h1>
        <p className="text-gray-400 text-sm text-center mt-2 mb-8">
          Enter your VIP Passcode to unlock instant mobile publishing on LiveTimeData.
        </p>

        <div className="w-full space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 text-center">
              4-Digit Passcode
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => handleUnlockPin(e.target.value)}
              placeholder="••••"
              autoFocus
              className="w-full text-center text-3xl font-mono tracking-widest py-3 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white"
            />
          </div>

          {pinError && (
            <p className="text-red-400 text-xs text-center font-medium flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {pinError}
            </p>
          )}

          <p className="text-xs text-gray-500 text-center pt-4">
            Once verified, this device will stay permanently unlocked.
          </p>
        </div>
      </main>
    );
  }

  // 2. SUCCESS SCREEN
  if (publishedData) {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-10 flex flex-col items-center justify-center max-w-md mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3">
          ⚡ {publishedData.count} Event{publishedData.count > 1 ? "s" : ""} Published Live Instantly
        </span>

        <h1 className="text-2xl font-bold tracking-tight mb-2">Live on Calendar & Guide!</h1>
        <p className="text-gray-400 text-xs mb-6">
          Venues & artists added to automated spider scrape schedule.
        </p>

        {/* List of Published Events */}
        <div className="w-full space-y-2 mb-8 text-left max-h-60 overflow-y-auto pr-1">
          {publishedData.events.map((item) => (
            <Link
              key={item.id}
              href={item.eventUrl}
              target="_blank"
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-xs font-bold text-white truncate">{item.title}</p>
                <p className="text-[10px] text-gray-400">{item.cityName}</p>
              </div>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
                View <span>→</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Snap or Ingest Another Event</span>
          </button>
        </div>
      </main>
    );
  }

  // 3. MAIN INTERFACE
  return (
    <main className="min-h-screen bg-black text-white pb-28 pt-6 px-4 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Quick Event Post</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Unlock className="w-3 h-3" /> VIP Live
            </span>
          </div>
          <p className="text-xs text-gray-400">Snap, screenshot, or link • Live in 15 seconds</p>
        </div>

        <button
          onClick={handleLogoutPin}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
          title="Lock / Change PIN"
        >
          Lock
        </button>
      </header>

      {/* GPS Location Bar */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex gap-2 text-xs flex-1">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (e.g. Statesville)"
              className="bg-transparent border-b border-white/20 focus:border-emerald-400 focus:outline-none text-white font-semibold w-28 text-xs placeholder:text-gray-500"
            />
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State (NC)"
              className="bg-transparent border-b border-white/20 focus:border-emerald-400 focus:outline-none text-white font-semibold w-16 text-xs placeholder:text-gray-500 uppercase"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGetLocation}
          disabled={locating}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-gray-300 transition-colors"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>{locating ? "GPS..." : "Auto GPS"}</span>
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("snap")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            mode === "snap"
              ? "bg-emerald-500 text-black border-emerald-400 shadow-md"
              : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Snap / Image</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            mode === "url"
              ? "bg-emerald-500 text-black border-emerald-400 shadow-md"
              : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Web Link</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("voice")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            mode === "voice"
              ? "bg-emerald-500 text-black border-emerald-400 shadow-md"
              : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Voice / Note</span>
        </button>
      </div>

      {/* MODE 1: SNAP / SCREENSHOT / IMAGE */}
      {mode === "snap" && (
        <div className="mb-4 space-y-2.5">
          {/* Hidden Inputs */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {!imagePreview ? (
            <div className="space-y-2">
              {/* Camera Button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full py-4 px-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border-2 border-dashed border-emerald-500/40 text-emerald-400 font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                <span>Take Camera Photo (Poster / Flyer)</span>
              </button>

              {/* Screenshot / Gallery & Clipboard Row */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>Upload Screenshot</span>
                </button>

                <button
                  type="button"
                  onClick={handleClipboardPaste}
                  className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Clipboard className="w-4 h-4 text-emerald-400" />
                  <span>Paste Screenshot</span>
                </button>
              </div>

              <p className="text-[11px] text-gray-500 text-center">
                Tip: Screenshots from Instagram, Facebook Events, or photos from your gallery work instantly.
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black max-h-56 flex items-center justify-center group">
              <img src={imagePreview} alt="Screenshot/flyer preview" className="w-full h-full object-contain max-h-56" />
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-black/80 backdrop-blur border border-white/20 text-xs font-semibold text-white flex items-center gap-1 shadow"
                >
                  <RefreshCw className="w-3 h-3" /> Change
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: WEB URL LINK */}
      {mode === "url" && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <input
              type="url"
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              placeholder="Paste event link (e.g. facebook.com/events/..., eventbrite.com/...)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-3.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={() => triggerAIExtraction({ url: webUrl })}
            disabled={!webUrl.trim() || isParsing}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isParsing ? "Scraping & Analyzing..." : "Scrape & Extract with AI"}</span>
          </button>
        </div>
      )}

      {/* MODE 3: VOICE / NOTE */}
      {mode === "voice" && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Speak or type event details... (e.g. 'Concert lineup at ESC Park: Friday Acoustic 7pm, Saturday Rock 8pm')"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none pr-12"
            />
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
              title="Voice dictation"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => triggerAIExtraction({ text: textInput })}
            disabled={!textInput.trim() || isParsing}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isParsing ? "Gemini is analyzing..." : "Extract Details with AI"}</span>
          </button>
        </div>
      )}

      {/* AI Extraction Loading State */}
      {isParsing && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 mb-4 animate-pulse">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <p className="text-xs text-emerald-300 font-medium">
            Gemini 2.5 Flash is extracting all distinct events, venues & performers...
          </p>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 mb-4 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MULTI-EVENT LIST & EDITABLE PREVIEW */}
      {parsedEvents.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Found {parsedEvents.length} Event{parsedEvents.length > 1 ? "s" : ""} on Schedule
              </span>
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              {selectedCount} selected for live publish
            </span>
          </div>

          {parsedEvents.map((ev, index) => {
            const isExpanded = expandedEventId === ev.id;

            return (
              <div
                key={ev.id}
                className={`rounded-2xl border transition-colors ${
                  ev.selected
                    ? "bg-white/5 border-white/20"
                    : "bg-white/[0.02] border-white/5 opacity-60"
                }`}
              >
                {/* Header Summary Row */}
                <div className="p-3.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleEventSelection(ev.id)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                      ev.selected
                        ? "bg-emerald-500 border-emerald-400 text-black"
                        : "bg-black/50 border-white/30 text-transparent"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </button>

                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                  >
                    <p className="text-xs font-bold text-white truncate">{ev.title}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                      <span>{ev.eventDates.join(", ") || "Date TBD"}</span>
                      <span>•</span>
                      <span>{ev.venueName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                      className="p-1 text-gray-400 hover:text-white"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {parsedEvents.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteEvent(ev.id)}
                        className="p-1 text-gray-500 hover:text-red-400"
                        title="Remove event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Edit Card */}
                {isExpanded && (
                  <div className="p-3.5 pt-0 border-t border-white/10 space-y-2.5 mt-1">
                    {/* Title */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={ev.title}
                        onChange={(e) => updateEventField(ev.id, "title", e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                      />
                    </div>

                    {/* Venue & Time */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Venue
                        </label>
                        <input
                          type="text"
                          value={ev.venueName}
                          onChange={(e) => updateEventField(ev.id, "venueName", e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Time
                        </label>
                        <input
                          type="text"
                          value={ev.startTime}
                          onChange={(e) => updateEventField(ev.id, "startTime", e.target.value)}
                          placeholder="e.g. 7:00 PM"
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Dates */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                        Dates
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {ev.eventDates.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono"
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            {d}
                            <button
                              type="button"
                              onClick={() => handleRemoveDate(ev.id, d)}
                              className="ml-1 text-gray-400 hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                        Category
                      </label>
                      <select
                        value={ev.category}
                        onChange={(e) => updateEventField(ev.id, "category", e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat} className="bg-neutral-900 text-white">
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Details */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                        Description / Admission
                      </label>
                      <textarea
                        rows={2}
                        value={ev.details}
                        onChange={(e) => updateEventField(ev.id, "details", e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-sm z-50 max-w-lg mx-auto">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing || selectedCount === 0}
          className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Publishing & Seeding Lifecycle...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>
                🚀 Publish {selectedCount > 1 ? `All ${selectedCount} Events` : "Live to Calendar"}
              </span>
            </>
          )}
        </button>
      </div>
    </main>
  );
}
