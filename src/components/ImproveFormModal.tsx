"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { ADS_ENABLED } from "@/config/adSlots";

interface ImproveFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  cityName?: string;
  stateName?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
}

export default function ImproveFormModal({
  isOpen,
  onClose,
  cityName = "",
  stateName = "",
  countryCode = "",
  lat = 0,
  lng = 0
}: ImproveFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [enteredCity, setEnteredCity] = useState(cityName || "");
  const [enteredState, setEnteredState] = useState(stateName || "");

  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [ageRange, setAgeRange] = useState<string>("18+");
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cityName) setEnteredCity(cityName);
    if (stateName) setEnteredState(stateName);
  }, [cityName, stateName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (uploadedPhotos.length + filesArray.length > 12) {
        alert("Maximum limit of 12 images per single submission reached.");
        return;
      }
      setUploadedPhotos((prev) => [...prev, ...filesArray]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const newFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) newFiles.push(file);
        }
      }
      
      if (newFiles.length > 0) {
        setUploadedPhotos(prev => {
          if (prev.length + newFiles.length > 12) {
            alert("Maximum limit of 12 images per single submission reached.");
            return [...prev, ...newFiles].slice(0, 12);
          }
          return [...prev, ...newFiles];
        });
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOpenModal = (e: CustomEvent) => {
      if (e.detail === 'submit_webcam') {
        setTimeout(() => {
          const el = document.getElementById('webcam-question');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }
        }, 150);
      }
    };
    window.addEventListener('openModal', handleOpenModal as EventListener);
    return () => window.removeEventListener('openModal', handleOpenModal as EventListener);
  }, [isOpen]);

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setUploadedDocs((prev) => [...prev, ...filesArray]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const finalCity = cityName || (formData.get("cityName") as string)?.trim() || enteredCity.trim();
    const finalState = stateName || (formData.get("stateName") as string)?.trim() || enteredState.trim();
    const finalCountry = countryCode || (formData.get("countryCode") as string)?.trim() || "";

    if (!finalCity) {
      setErrorMsg("Please enter a city name.");
      setLoading(false);
      return;
    }

    formData.set("cityName", finalCity);
    formData.set("stateName", finalState);
    formData.set("countryCode", finalCountry);
    formData.set("lat", String(lat || 0));
    formData.set("lng", String(lng || 0));
    formData.set("cityPageUrl", typeof window !== "undefined" ? window.location.href : "");

    uploadedPhotos.forEach((file) => formData.append("photos", file));
    uploadedDocs.forEach((file) => formData.append("documents", file));

    try {
      const res = await fetch("/api/admin/submit-contribution", {
        method: "POST",
        body: formData,
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Submission rejected.");
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || "System Busy. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS STATE MODAL: Hard Truths Exit Strategy (X, Pill, Click Outside)
  if (success) {
    const handleSuccessClose = () => {
      setSuccess(false);
      setUploadedPhotos([]);
      setUploadedDocs([]);
      onClose();
    };

    return (
      <div 
        className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
        onClick={handleSuccessClose}
      >
        <div 
          className="bg-white w-full max-w-md rounded-[32px] shadow-2xl border-2 border-black flex flex-col p-10 relative animate-in zoom-in-95 duration-200 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* EXIT 1: TOP RIGHT X */}
          <button 
            onClick={handleSuccessClose} 
            className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-black transition-all cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="pt-4 pb-20">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-black mb-2">Thank You</h2>
            <p className="text-black font-black text-sm uppercase tracking-wide leading-tight">
              Your submission has been successfully received and added to our system.
            </p>
          </div>

          {/* EXIT 2: BOTTOM LEFT PILL */}
          <div className="flex justify-start">
            <button 
              type="button"
              onClick={handleSuccessClose} 
              className="bg-black text-white px-6 py-2.5 rounded-full font-black text-[10px] tracking-[0.2em] uppercase hover:bg-blue-600 transition-all active:scale-95 cursor-pointer"
            >
              Return to Site
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeCity = (cityName || enteredCity).trim();
  const displayCity = activeCity || "this city";

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl border-2 border-black flex flex-col my-8 relative max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-black transition-all z-10 cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="p-8 border-b-2 border-black bg-slate-50/30">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-black">
            Share local insights & webcams
          </h2>
          <p className="text-black font-black text-sm uppercase tracking-wide mt-1">
            {activeCity ? `${activeCity}${stateName || enteredState ? `, ${stateName || enteredState}` : ''}` : "Community Submissions"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 pb-24 text-black">
          {errorMsg && (
            <div className="p-4 rounded-xl border-2 border-black bg-red-50 flex items-center gap-3 text-sm text-black font-bold">
              <ShieldAlert className="shrink-0" size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CITY IDENTIFIER: Prominently asked when coming from Home Page or without pre-selected city */}
          {!cityName && (
            <div className="bg-amber-500/10 border-2 border-black p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                <h3 className="font-black text-xs uppercase tracking-wider text-black">
                  City Identifier (Required)
                </h3>
              </div>
              <p className="text-xs text-slate-700 font-medium">
                Which city, town, or region are you submitting insights, photos, or a webcam for?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-black block">
                    City / Town Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="cityName"
                    type="text"
                    required
                    value={enteredCity}
                    onChange={(e) => setEnteredCity(e.target.value)}
                    placeholder="e.g. Chicago, Paris, Kyoto"
                    className="w-full bg-white border-2 border-black p-3 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-black block">
                    State / Region / Country <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="stateName"
                    type="text"
                    required
                    value={enteredState}
                    onChange={(e) => setEnteredState(e.target.value)}
                    placeholder="e.g. Illinois, France, Japan"
                    className="w-full bg-white border-2 border-black p-3 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-normal block">
              What are the most interesting, unusual, surprising, or unforgettable things about {displayCity}?
            </label>
            <textarea name="question1" rows={3} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-normal block">
              What do locals know about {displayCity} that most visitors miss?
            </label>
            <textarea name="question2" rows={3} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-normal block">
              Please share a story, legend, myth, historical detail, or local tradition connected to {displayCity}.
            </label>
            <textarea name="question3" rows={5} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
            <div className="border-2 border-dashed border-black rounded-xl p-4 text-center bg-slate-50/50">
              <input type="file" ref={docInputRef} onChange={handleDocChange} accept=".pdf,.docx,.txt" multiple className="hidden" />
              <button type="button" onClick={() => docInputRef.current?.click()} className="text-[10px] font-black uppercase tracking-wider hover:text-blue-600 cursor-pointer">
                Drag & Drop or Attach Documents (.PDF, .DOCX, .TXT)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-normal block">
              What places, experiences, attractions, or hidden spots should people discover in {displayCity}?
            </label>
            <textarea name="question4" rows={3} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal block">
              Share your photos of {displayCity}. Selected images may appear across our network, projects, publications, related media, or partner projects.
            </label>
            <div className="border-2 border-dashed border-black rounded-xl p-6 text-center bg-slate-50/50">
              <input type="file" ref={photoInputRef} onChange={handlePhotoChange} accept="image/jpeg,image/png,image/webp" multiple className="hidden" />
              <button type="button" onClick={() => photoInputRef.current?.click()} className="text-[11px] font-black uppercase tracking-widest hover:text-blue-600 cursor-pointer">
                Click to Upload or Paste Gallery Images (Max 12 files) {uploadedPhotos.length > 0 && `(${uploadedPhotos.length} selected)`}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-normal block">
              Know of any public webcams in or around {displayCity}? Share them with us.
            </label>
            <textarea id="webcam-question" name="question6" rows={2} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-normal block">
              Do you have any suggestions, questions, corrections, or removal requests?
            </label>
            <textarea name="question7" rows={2} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-normal block">Supporting Link or Reference URL</label>
            <textarea name="supportingUrl" rows={2} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-normal block">Additional Notes (Optional)</label>
            <textarea name="additionalNotes" rows={2} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold text-sm text-black outline-none focus:border-blue-600" />
          </div>

          {/* IDENTIFICATION SEGMENT */}
          <div className="border-t-2 border-black pt-6">
            <h3 className="font-black text-sm uppercase mb-4">Submitter Information (Private)</h3>
            
            <div className="space-y-1.5 max-w-sm mb-4">
              <label className="text-xs font-normal block">Contributor Age Range (Required)</label>
              <select name="ageRange" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-bold text-sm text-black outline-none cursor-pointer">
                <option value="18+">18 or older</option>
                <option value="13-17">13 - 17</option>
                <option value="Under 13">Under 13</option>
              </select>
            </div>

            {ageRange === "Under 13" ? (
              <div className="bg-red-50 border-2 border-black p-4 rounded-xl mb-4 text-sm font-bold text-black space-y-4">
                <p>⚠️ COPPA Restriction: You must have a parent/guardian submit this information, or provide an authorized Teacher/Organization code.</p>
                <div className="space-y-1.5">
                  <label className="text-xs font-normal block">Teacher / Organization Code (Required)</label>
                  <input name="teacherCode" type="text" required className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-semibold text-sm text-black outline-none" placeholder="Enter school or club code" />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-normal block">Your Name (Required)</label>
                    <input name="userName" type="text" required className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-semibold text-sm text-black outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-normal block">Email Address (Required)</label>
                    <input name="userEmail" type="email" required className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-semibold text-sm text-black outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-normal block">Organization or Group (Optional)</label>
                    <input name="organization" type="text" className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-semibold text-sm text-black outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-normal block">Reference / Promo Code (Optional)</label>
                    <input name="referenceCode" type="text" className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-semibold text-sm text-black outline-none" />
                  </div>
                </div>
              </>
            )}

            {ageRange === "13-17" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border-2 border-black p-4 rounded-xl mb-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-normal block">Parent/Guardian Name (Required)</label>
                  <input name="parentName" type="text" required className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-semibold text-sm text-black outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-normal block">Parent/Guardian Email (Required)</label>
                  <input name="parentEmail" type="email" required className="w-full bg-white border-2 border-black p-2.5 rounded-xl font-semibold text-sm text-black outline-none" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 bg-slate-50 p-4 rounded-2xl border-2 border-black items-start mb-6">
            <input name="legalAgreed" type="checkbox" required id="legalAgreed" className="mt-1 w-4 h-4 shrink-0 border-2 border-black text-black cursor-pointer bg-white accent-black" />
            <label htmlFor="legalAgreed" className="text-[11px] font-normal leading-normal cursor-pointer select-none">
              I certify that I am over 13 years of age (or have parental/guardian permission) and agree to the Submission Terms and Privacy Policy. I grant permission for submitted content to be reviewed, edited, used, shared, or published across our network, projects, publications, related media, or partner media projects.
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '10px' }}>
            <button type="submit" disabled={loading} style={{ background: '#0f172a', color: '#fff', padding: '16px', borderRadius: '14px', fontWeight: 900, textTransform: 'uppercase', fontSize: '13px', cursor: 'pointer', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              {loading ? <Loader2 className="animate-spin" size={14} /> : "SUBMIT"}
            </button>
          </div>

        </form>

        <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {/* Pill Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={onClose} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              BACK TO SITE
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT EVENT
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'share_insights' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SHARE INSIGHTS
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT PHOTO
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); }} style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT WEBCAM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}