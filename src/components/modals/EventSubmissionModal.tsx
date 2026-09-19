"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, Loader2, Sparkles, Zap } from "lucide-react";
import { ADS_ENABLED } from "@/config/adSlots";

interface EventSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCity?: string;
  defaultState?: string;
  defaultCategory?: string;
}

const CATEGORY_ORDER = [
  "Festival / Fair",
  "Music / Concert",
  "Arts / Culture",
  "Sports / Recreation",
  "Food / Drink",
  "Family / Kids",
  "School / Education",
  "Yard Sale / Market",
  "Community / Civic",
  "Nightlife / Social",
  "Other"
];

export default function EventSubmissionModal({
  isOpen,
  onClose,
  defaultCity = "",
  defaultState = "",
  defaultCategory = "School / Education"
}: EventSubmissionModalProps) {
  const [submitStep, setSubmitStep] = useState<"form" | "success">("form");

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formCategories, setFormCategories] = useState<string[]>([defaultCategory]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [formVenueName, setFormVenueName] = useState("");
  const [formVenueAddress, setFormVenueAddress] = useState("");
  const [formCity, setFormCity] = useState(defaultCity);
  const [formState, setFormState] = useState(defaultState);
  const [formTime, setFormTime] = useState("");
  const [formDates, setFormDates] = useState<string[]>([]);
  const [currentDateInput, setCurrentDateInput] = useState("");
  const [formDetails, setFormDetails] = useState("");

  const [formImage, setFormImage] = useState<File | null>(null);
  const [formFlyerBase64, setFormFlyerBase64] = useState<string | null>(null);
  const [formFlyerUrl, setFormFlyerUrl] = useState("");

  const [formInfoUrl, setFormInfoUrl] = useState("");
  const [formSocialUrls, setFormSocialUrls] = useState("");
  const [formTicketUrl, setFormTicketUrl] = useState("");
  const [formVendorUrl, setFormVendorUrl] = useState("");

  const [formHostingEntity, setFormHostingEntity] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");

  const [ageRange, setAgeRange] = useState("18+");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  const [autofillUrl, setAutofillUrl] = useState("");
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  const [formSending, setFormSending] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleAutofill() {
    if (!autofillUrl) return;
    setAutofillLoading(true);
    setAutofillError(null);
    try {
      const res = await fetch("/api/events/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: autofillUrl })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Autofill failed");
      
      if (data.event) {
        if (data.event.title && !formTitle) setFormTitle(data.event.title);
        if (data.event.venueName && !formVenueName) setFormVenueName(data.event.venueName);
        if (data.event.venueAddress && !formVenueAddress) setFormVenueAddress(data.event.venueAddress);
        if (data.event.details && !formDetails) setFormDetails(data.event.details);
        if (data.event.startTime && !formTime) setFormTime(data.event.startTime);
        if (data.event.eventDates && data.event.eventDates.length > 0 && formDates.length === 0) setFormDates(data.event.eventDates);
        if (data.event.categories && data.event.categories.length > 0 && formCategories.length <= 1) setFormCategories(data.event.categories);
        if (data.event.cityName && !formCity) setFormCity(data.event.cityName);
        if (data.event.stateName && !formState) setFormState(data.event.stateName);
      }
    } catch (err: any) {
      setAutofillError(err.message || "Failed to auto-parse event details.");
    } finally {
      setAutofillLoading(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent, isAddAnother: boolean) {
    e.preventDefault();
    setFormSending(true);
    setFormMessage(null);

    const finalDates = [...formDates];
    if (currentDateInput && !formDates.includes(currentDateInput)) {
      finalDates.push(currentDateInput);
      setFormDates(finalDates);
      setCurrentDateInput("");
    }

    try {
      const response = await fetch("/api/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          category: formCategories.join(", ") || "Other",
          venueName: formVenueName,
          venueAddress: formVenueAddress,
          cityName: formCity,
          stateName: formState,
          hostingEntity: formHostingEntity,
          startTime: formTime,
          eventDates: finalDates,
          details: formDetails,
          userEmail: formEmail,
          userName: formName,
          userPhone: formPhone,
          contactEmail: formContactEmail,
          contactPhone: formContactPhone,
          officialInfoUrl: formInfoUrl,
          socialUrls: formSocialUrls,
          ticketUrl: formTicketUrl,
          vendorUrl: formVendorUrl,
          eventFlyerUrl: formFlyerBase64 || formFlyerUrl,
          parentName,
          parentEmail,
          ageRange
        }),
      });

      const data = await response.json();
      if (data.ok) {
        if (isAddAnother) {
          setFormMessage({ type: "success", text: "Event received! Form cleared and ready for your next entry." });
          setFormTitle("");
          setFormCategories(["Other"]);
          setFormTime("");
          setFormDates([]);
          setFormDetails("");
          setFormInfoUrl("");
          setFormSocialUrls("");
          setFormTicketUrl("");
          setFormVendorUrl("");
          setFormImage(null);
          setFormFlyerBase64(null);
          setFormFlyerUrl("");
          setAutofillUrl("");
          document.querySelector('.overflow-y-auto')?.scrollTo(0, 0);
        } else {
          setSubmitStep("success");
          setFormMessage(null);
        }
      } else {
        setFormMessage({ type: "error", text: data.error || "Event submission failed. Verify parameters." });
      }
    } catch (err) {
      setFormMessage({ type: "error", text: "Network connection timeout. Re-establishing secure lines..." });
    } finally {
      setFormSending(false);
    }
  }

  const handleSuccessClose = () => {
    setSubmitStep("form");
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden relative border-2 border-black animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-6 py-5 border-b-2 border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {submitStep === "form" 
                ? (formCity ? `Submit an Event: ${formCity}${formState ? `, ${formState}` : ''}` : "Submit an Event")
                : "Thank You!"}
            </h2>
            {submitStep === "form" && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                School Events, Yard Sales, Festivals & Community Gatherings
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="overflow-y-auto p-6 flex-1 bg-white text-slate-900">
          {submitStep === "form" ? (
            <form 
              onSubmit={(e) => handleFormSubmit(e, false)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="space-y-4"
            >
              {/* Quick Snap Notice for Mobile / Admins */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900 font-semibold shadow-sm">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0 fill-emerald-600" />
                  <span>On mobile? Snap a flyer or speak a note with <b>Quick Snap & Voice (15s)</b>.</span>
                </span>
                <Link
                  href="/snap"
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  <span>Open Quick Snap</span>
                  <span>→</span>
                </Link>
              </div>

              {formMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border ${
                    formMessage.type === "success" 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
                      : "bg-red-50 text-red-800 border-red-300"
                  }`}
                >
                  {formMessage.text}
                </div>
              )}

              {/* AI Auto-Fill Segment */}
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles size={14} className="text-blue-600" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-950">AI Fast-Fill from URL</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={autofillUrl}
                    onChange={(e) => setAutofillUrl(e.target.value)}
                    placeholder="Paste event link (e.g. Facebook, Eventbrite, school webpage)..."
                    className="flex-1 bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleAutofill}
                    disabled={autofillLoading || !autofillUrl}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    {autofillLoading ? <Loader2 className="animate-spin" size={14} /> : "Auto-Fill"}
                  </button>
                </div>
                {autofillError && <p className="text-[10.5px] font-bold text-red-600 mt-1">{autofillError}</p>}
              </div>

              {/* Event Details & Location */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Event Details & Location</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Event Title <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Band Booster Yard Sale, Spring Play"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Category <span className="text-red-600">*</span></label>
                    <div 
                      onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 cursor-pointer flex justify-between items-center"
                    >
                      <span className="truncate">{formCategories.join(", ")}</span>
                      <span className="text-[10px] text-slate-500">▼</span>
                    </div>

                    {isCategoryOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsCategoryOpen(false)} />
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded-xl max-h-56 overflow-y-auto z-50 shadow-xl">
                          {CATEGORY_ORDER.map((cat) => (
                            <label key={cat} className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0">
                              <input 
                                type="checkbox"
                                checked={formCategories.includes(cat)}
                                onChange={(e) => {
                                  if (e.target.checked) setFormCategories(prev => [...prev.filter(c => c !== "Other"), cat]);
                                  else setFormCategories(prev => prev.filter(c => c !== cat).length ? prev.filter(c => c !== cat) : ["Other"]);
                                }}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-900">{cat}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">City <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      required
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="e.g. Denver, London, Austin"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">State / Region <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      required
                      value={formState}
                      onChange={(e) => setFormState(e.target.value)}
                      placeholder="e.g. Colorado, UK, Texas"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Venue / School Name <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      required
                      value={formVenueName}
                      onChange={(e) => setFormVenueName(e.target.value)}
                      placeholder="e.g. Central High School Field, Community Center"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Venue Address <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      required
                      value={formVenueAddress}
                      onChange={(e) => setFormVenueAddress(e.target.value)}
                      placeholder="Street address (Required for GPS navigation)"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Event Date(s) <span className="text-red-600">*</span></label>
                    <div className="flex gap-2 flex-wrap items-center">
                      {formDates.map((date, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs font-bold">
                          {date}
                          <button type="button" onClick={() => setFormDates(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 font-bold ml-1 cursor-pointer">×</button>
                        </div>
                      ))}
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="date"
                          value={currentDateInput}
                          onChange={(e) => setCurrentDateInput(e.target.value)}
                          className="border-2 border-slate-900 p-1.5 rounded-lg text-xs font-bold text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (currentDateInput && !formDates.includes(currentDateInput)) {
                              setFormDates(prev => [...prev, currentDateInput].sort());
                            }
                            setCurrentDateInput("");
                          }}
                          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Start Time</label>
                    <input
                      type="text"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      placeholder="e.g. 9:00 AM - 2:00 PM"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Event Description</label>
                  <textarea
                    rows={3}
                    value={formDetails}
                    onChange={(e) => setFormDetails(e.target.value)}
                    placeholder="Tell visitors about your event, activities, vendors, booster drive items, schedule, or special attractions."
                    className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-blue-600 resize-none"
                  />
                </div>

                {/* Upload Flyer */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Upload Event Flyer (Optional)</label>
                  <label
                    htmlFor="event-flyer-upload"
                    className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-100/60 block cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-xs font-bold text-slate-700">Click to Upload Event Flyer or Poster (JPG, PNG, WEBP)</span>
                    <input
                      type="file"
                      id="event-flyer-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormImage(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setFormFlyerBase64(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {formImage && (
                      <div className="mt-2 text-xs font-black text-emerald-600">
                        Ready to upload: {formImage.name}
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Submitter & Contact Information */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Submitter Information (Private)</h3>
                
                <div className="max-w-xs space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Contributor Age Range <span className="text-red-600">*</span></label>
                  <select 
                    value={ageRange} 
                    onChange={(e) => setAgeRange(e.target.value)} 
                    className="w-full bg-white border-2 border-slate-900 p-2 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="18+">18 or older</option>
                    <option value="13-17">13 - 17</option>
                    <option value="Under 13">Under 13</option>
                  </select>
                </div>

                {ageRange === "Under 13" ? (
                  <div className="bg-red-50 border-2 border-red-500 p-3.5 rounded-xl text-xs font-bold text-red-900 space-y-2">
                    <p>⚠️ COPPA Restriction: You must have a parent/guardian submit this information, or provide an authorized school code.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Your Name <span className="text-red-600">*</span></label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Your Email <span className="text-red-600">*</span></label>
                      <input
                        type="email"
                        required
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Organization / School / Club (Optional)</label>
                    <input
                      type="text"
                      value={formHostingEntity}
                      onChange={(e) => setFormHostingEntity(e.target.value)}
                      placeholder="e.g. Band Boosters, PTA, Garden Club"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Contact Phone (Optional)</label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="(555) 000-0000"
                      className="w-full bg-white border-2 border-slate-900 p-2.5 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Legal Terms Checkbox */}
              <div className="flex gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 items-start">
                <input 
                  name="legalAgreed" 
                  type="checkbox" 
                  required 
                  id="event-legal-agreed" 
                  className="mt-0.5 w-4 h-4 shrink-0 accent-slate-900 cursor-pointer" 
                />
                <label htmlFor="event-legal-agreed" className="text-[11px] font-medium text-slate-700 leading-normal cursor-pointer select-none">
                  I certify that I am at least 13 years of age (or have parental permission) and agree to the Submission Terms. I grant permission for submitted event details to be reviewed, verified, and published across the LiveTimeData network.
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={formSending}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-black p-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {formSending ? <Loader2 className="animate-spin" size={15} /> : "Submit Event"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleFormSubmit(e, true)}
                  disabled={formSending}
                  className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-900 font-black p-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {formSending ? <Loader2 className="animate-spin" size={15} /> : "Submit & Add Another"}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-16 px-4 space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                Thank You!
              </h2>
              <p className="text-xs font-semibold text-slate-600 max-w-sm mx-auto uppercase tracking-wide">
                Your event submission has been successfully received and added to our review queue.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleSuccessClose}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  Return to Site
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS AND AD SPACE */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col items-center gap-3">
          <div className="flex gap-2 flex-wrap justify-center">
            <button 
              onClick={onClose} 
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-full text-[10.5px] font-black uppercase tracking-wider cursor-pointer"
            >
              BACK TO SITE
            </button>
            <button 
              type="button" 
              onClick={() => { 
                onClose(); 
                window.dispatchEvent(new CustomEvent('openModal', { detail: 'share_insights' })); 
              }} 
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-full text-[10.5px] font-black uppercase tracking-wider cursor-pointer"
            >
              SHARE INSIGHTS
            </button>
            <button 
              type="button" 
              onClick={() => { 
                onClose(); 
                window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); 
              }} 
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-full text-[10.5px] font-black uppercase tracking-wider cursor-pointer"
            >
              SUBMIT WEBCAM
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
