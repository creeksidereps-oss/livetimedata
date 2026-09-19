"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Camera,
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
  Plus
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

export default function SnapPage() {
  // VIP PIN state
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState("");

  // Location state
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [locating, setLocating] = useState(false);

  // Input Mode: "snap" (camera) or "voice" (text/mic)
  const [mode, setMode] = useState<"snap" | "voice">("snap");

  // Snap Mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice/Text Mode state
  const [textInput, setTextInput] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Parsing & Submission state
  const [isParsing, setIsParsing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Parsed Event Form Fields (Editable)
  const [title, setTitle] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [startTime, setStartTime] = useState("");
  const [eventDates, setEventDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState("");
  const [category, setCategory] = useState("Community & Civic");
  const [details, setDetails] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");

  // Success state
  const [publishedData, setPublishedData] = useState<{
    eventId: number | null;
    eventUrl: string;
    title: string;
    cityName: string;
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

  // Handle Photo selection / camera capture
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      await triggerAIExtraction({ imageBase64: base64 });
    };
    reader.readAsDataURL(file);
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
  async function triggerAIExtraction(params: { imageBase64?: string; text?: string }) {
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

      const ev = data.event;
      if (ev.title) setTitle(ev.title);
      if (ev.venueName) setVenueName(ev.venueName);
      if (ev.venueAddress) setVenueAddress(ev.venueAddress);
      if (ev.cityName) setCity(ev.cityName);
      if (ev.stateName) setState(ev.stateName);
      if (ev.startTime) setStartTime(ev.startTime);
      if (ev.eventDates && ev.eventDates.length > 0) setEventDates(ev.eventDates);
      if (ev.category) setCategory(ev.category);
      if (ev.details) setDetails(ev.details);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to extract details");
    } finally {
      setIsParsing(false);
    }
  }

  // Add date to array
  function handleAddDate() {
    if (!newDateInput) return;
    if (!eventDates.includes(newDateInput)) {
      setEventDates([...eventDates, newDateInput]);
    }
    setNewDateInput("");
  }

  function handleRemoveDate(d: string) {
    setEventDates(eventDates.filter((x) => x !== d));
  }

  // Publish Event Immediately
  async function handlePublish() {
    if (!title || !city || !venueName) {
      setErrorMsg("Title, City, and Venue are required.");
      return;
    }

    if (eventDates.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      setEventDates([today]);
    }

    setIsPublishing(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/events/quick-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          title,
          cityName: city,
          stateName: state,
          venueName,
          venueAddress,
          startTime: startTime || "TBD",
          eventDates: eventDates.length > 0 ? eventDates : [new Date().toISOString().split("T")[0]],
          category,
          details,
          officialInfoUrl: officialUrl,
          flyerBase64: imagePreview
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Publication failed");

      setPublishedData({
        eventId: data.eventId,
        eventUrl: data.eventUrl,
        title: data.title,
        cityName: data.cityName
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to publish event");
    } finally {
      setIsPublishing(false);
    }
  }

  // Reset to snap another
  function handleReset() {
    setImageFile(null);
    setImagePreview(null);
    setTextInput("");
    setTitle("");
    setVenueName("");
    setVenueAddress("");
    setStartTime("");
    setEventDates([]);
    setDetails("");
    setOfficialUrl("");
    setPublishedData(null);
    setErrorMsg("");
  }

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
            Once verified, this phone will stay unlocked for instant publishing.
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
          ⚡ Published Live Instantly
        </span>

        <h1 className="text-2xl font-bold tracking-tight mb-2">Event is Live on Calendar!</h1>
        <p className="text-gray-300 font-medium text-base mb-1">{publishedData.title}</p>
        <p className="text-gray-500 text-xs mb-8">Added to {publishedData.cityName} City Guide & Calendar</p>

        <div className="w-full space-y-3">
          <Link
            href={publishedData.eventUrl}
            target="_blank"
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-colors shadow-lg"
          >
            <span>View Live Event</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors border border-white/10"
          >
            <Plus className="w-4 h-4" />
            <span>Snap Another Event</span>
          </button>
        </div>
      </main>
    );
  }

  // 3. MAIN QUICK-POST INTERFACE
  return (
    <main className="min-h-screen bg-black text-white pb-24 pt-6 px-4 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Quick Event Post</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Unlock className="w-3 h-3" /> VIP Live
            </span>
          </div>
          <p className="text-xs text-gray-400">Post in 15 seconds from your phone</p>
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
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("snap")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            mode === "snap"
              ? "bg-emerald-500 text-black border-emerald-400 shadow-md"
              : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Option A: Snap Flyer</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("voice")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            mode === "voice"
              ? "bg-emerald-500 text-black border-emerald-400 shadow-md"
              : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Option B: Voice / Note</span>
        </button>
      </div>

      {/* Input Area */}
      {mode === "snap" ? (
        <div className="mb-4">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />

          {!imagePreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-2xl py-8 px-4 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 group-hover:scale-105 transition-transform flex items-center justify-center text-emerald-400">
                <Camera className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Tap to Snap Flyer or Poster</p>
                <p className="text-xs text-gray-400 mt-0.5">Point camera at flyer or pick from photos</p>
              </div>
            </button>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black max-h-56 flex items-center justify-center group">
              <img src={imagePreview} alt="Flyer preview" className="w-full h-full object-contain max-h-56" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retake
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Speak or type event details... (e.g. 'Live jazz band this Saturday at D9 Brewing from 7pm to 10pm')"
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
            Gemini 2.5 Flash is reading dates, venue & details...
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

      {/* Editable Fields Summary */}
      {(title || venueName || details || isParsing) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Event Preview (Tap to edit)
            </span>
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Live in 1-Click</span>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Concert Series"
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
            />
          </div>

          {/* Venue & Address */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Venue Name *
              </label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. ESC Park"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Start Time
              </label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="e.g. 7:00 PM"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Venue Address (optional) */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Venue Address
            </label>
            <input
              type="text"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="e.g. 136 North Ave"
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Event Dates */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Event Dates ({eventDates.length})
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {eventDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono"
                >
                  <Calendar className="w-3 h-3" />
                  {d}
                  <button
                    type="button"
                    onClick={() => handleRemoveDate(d)}
                    className="ml-1 text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={newDateInput}
                onChange={(e) => setNewDateInput(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 flex-1"
              />
              <button
                type="button"
                onClick={handleAddDate}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
              >
                + Add Date
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
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
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Admission cost, event description, special notes..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Optional Info/Ticket URL */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Website / Ticket URL (Optional)
            </label>
            <input
              type="url"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Big Action Publish Button (Sticky at Bottom on Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-sm z-50 max-w-lg mx-auto">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing || !title || !venueName}
          className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Publishing Instantly...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>🚀 Publish Live to Calendar</span>
            </>
          )}
        </button>
      </div>
    </main>
  );
}
