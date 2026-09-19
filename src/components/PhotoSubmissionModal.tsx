"use client";

import { useState, useEffect } from "react";
import { ADS_ENABLED } from "@/config/adSlots";

export default function PhotoSubmissionModal({ isOpen, onClose, cityName }: { isOpen: boolean, onClose: () => void, cityName: string }) {
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentCountry, setCurrentCountry] = useState<string>("");
  const [currentState, setCurrentState] = useState<string>("");
  const [ageRange, setAgeRange] = useState<string>("18+");
  const [isDragging, setIsDragging] = useState(false);
  
  // Controlled form state
  const [formData, setFormData] = useState({
    photoCity: "",
    supportingLink: "",
    additionalNotes: "",
    userName: "",
    userEmail: "",
    organization: "",
    parentName: "",
    parentEmail: "",
    teacherCode: "",
    legalAgreed: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const countryParam = params.get("country");
      if (countryParam) setCurrentCountry(countryParam.trim());
      const stateParam = params.get("admin1");
      if (stateParam) setCurrentState(stateParam.trim());
    }
  }, []);

  
  useEffect(() => {
    if (!isOpen) return;
    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('dragover', preventDrag);
    window.addEventListener('drop', preventDrag);
    return () => {
      window.removeEventListener('dragover', preventDrag);
      window.removeEventListener('drop', preventDrag);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardFiles = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
      let newFiles: File[] = [...clipboardFiles];

      if (newFiles.length === 0 && e.clipboardData?.items) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) newFiles.push(file);
          }
        }
      }

      if (newFiles.length > 0) {
        setPhotos(prev => {
          const next = [...prev, ...newFiles].slice(0, 12);
          const acceptedNew = newFiles.slice(0, 12 - prev.length);
          const newPreviews = acceptedNew.map(f => URL.createObjectURL(f));
          setPreviews(prevP => [...prevP, ...newPreviews]);
          return next;
        });
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).slice(0, 12 - photos.length);
      setPhotos(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      alert('Please select, drag, or paste at least one photo before submitting.');
      return;
    }
    setIsSubmitting(true);
    
    try {
      for (const file of photos) {
        // Budget-friendly compression: Resize to max 800px and 70% quality JPEG before saving to Postgres
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const max_size = 800;
              if (width > height && width > max_size) {
                height *= max_size / width;
                width = max_size;
              } else if (height > max_size) {
                width *= max_size / height;
                height = max_size;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if(ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
              } else {
                resolve(event.target?.result as string);
              }
            };
            img.src = event.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await fetch('/api/photos/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cityName: formData.photoCity || cityName,
            stateName: currentState,
            title: file.name || 'User Submitted Photo',
            imageUrl: base64Data,
            source: 'User Submission',
            photographerName: formData.userName,
            rightsReleased: true
          }),
        });
      }
      
      // Optionally submit the rest of formData to user_contributions if needed
      await fetch('/api/admin/submit-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityName: formData.photoCity || cityName,
          stateName: currentState,
          userEmail: formData.userEmail,
          userName: formData.userName,
          organization: formData.organization,
          ageRange: ageRange,
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          content: `Submitted ${photos.length} photos. Link: ${formData.supportingLink}. Notes: ${formData.additionalNotes}`
        }),
      });

      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPhotos([]);
    setPreviews([]);
    setIsSuccess(false);
  };

  if (!isOpen) return null;

  if (isSuccess) {
    return (
      <div 
        className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div 
          className="bg-white w-full max-w-md rounded-[32px] shadow-2xl border-2 border-black flex flex-col p-10 relative animate-in zoom-in-95 duration-200 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* TOP RIGHT CLOSE X */}
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-black transition-all cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>

          <div className="pt-4 pb-16">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-black mb-2">Thank You</h2>
            <p className="text-black font-black text-sm uppercase tracking-wide leading-tight">
              Your photo submission has been successfully received and submitted for review.
            </p>
          </div>

          <div className="flex gap-3 justify-start">
            <button 
              type="button"
              onClick={onClose} 
              className="bg-black text-white px-6 py-2.5 rounded-full font-black text-[10px] tracking-[0.2em] uppercase hover:bg-blue-600 transition-all active:scale-95 cursor-pointer"
            >
              Return to Site
            </button>
            <button 
              type="button"
              onClick={resetForm} 
              className="bg-slate-100 text-slate-800 border border-slate-300 px-6 py-2.5 rounded-full font-black text-[10px] tracking-[0.2em] uppercase hover:bg-slate-200 transition-all active:scale-95 cursor-pointer"
            >
              Submit More
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <>
      {/* BACKDROP */}
      <div 
        onClick={onClose} 
        style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.42)' }}
      />

      {/* MODAL CONTAINER */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="animate-in zoom-in-95 duration-200"
        style={{ position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '800px', height: '90vh', background: '#ffffff', borderRadius: '16px', display: 'flex', flexDirection: 'column', zIndex: 999999, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}
      >
          {/* Header */}
          <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {cityName} {currentState ? `/ ${currentState}` : ''} {currentCountry ? `/ ${currentCountry}` : ''} 
              </h2>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Local Photos Submission</span>
            </div>
            <button onClick={onClose} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }} onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.1)')} onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                
                {/* Upload Zone */}
                <div>
                  <div 
                      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                        const droppedFiles = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
                        if (droppedFiles.length > 0) {
                          setPhotos(prev => {
                            const next = [...prev, ...droppedFiles].slice(0, 12);
                            const acceptedNew = droppedFiles.slice(0, 12 - prev.length);
                            const newPreviews = acceptedNew.map(f => URL.createObjectURL(f));
                            setPreviews(prevP => [...prevP, ...newPreviews]);
                            return next;
                          });
                        }
                      }}
                      style={{ border: `2px dashed ${isDragging ? '#2563eb' : (photos.length > 0 ? '#3b82f6' : '#cbd5e1')}`, borderRadius: '16px', padding: '32px', textAlign: 'center', background: isDragging ? '#dbeafe' : (photos.length > 0 ? '#eff6ff' : '#f8fafc'), cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} id="photo-upload" />
                    
                    {photos.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', pointerEvents: 'none' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>CLICK, DRAG, OR PASTE IMAGES</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>High-res JPG or PNG (Max 12 files)</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '12px', pointerEvents: 'none' }}>
                        {previews.map((src, i) => (
                          <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                          </div>
                        ))}
                        {photos.length < 12 && (
                          <div style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', border: '2px dashed #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#3b82f6', fontSize: '24px', fontWeight: 300 }}>+</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {photos.length > 0 && (
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'right', fontWeight: 600 }}>
                      {photos.length} FILE{photos.length !== 1 ? 'S' : ''} SELECTED
                    </p>
                  )}
                </div>

                {/* Optional Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>What city are these photos from?</label>
                    <input name="photoCity" type="text" value={formData.photoCity} onChange={handleChange} placeholder={`E.g., ${cityName}`} style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Supporting Link / Reference</label>
                    <input name="supportingLink" type="text" value={formData.supportingLink} onChange={handleChange} placeholder="https://" style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Additional Notes (Optional)</label>
                    <input name="additionalNotes" type="text" value={formData.additionalNotes} onChange={handleChange} placeholder="Any context for these photos..." style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />

                {/* 2-Column User Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: "1 / -1", display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Contributor Age Range (Required)</label>
                      <select required value={ageRange} onChange={(e) => setAgeRange(e.target.value)} style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', background: '#fff', cursor: 'pointer', color: '#0f172a', fontWeight: 700 }}>
                        <option value="18+">18 or older</option>
                        <option value="13-17">13 - 17</option>
                        <option value="Under 13">Under 13</option>
                      </select>
                    </div>
                  </div>

                  {ageRange === "Under 13" ? (
                    <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '2px solid #0f172a', padding: '16px', borderRadius: '12px', marginBottom: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>⚠️ COPPA Restriction: You must have a parent/guardian submit this information, or provide an authorized Teacher/Organization code.</p>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Teacher / Organization Code (Required)</label>
                        <input name="teacherCode" type="text" required value={formData.teacherCode || ''} onChange={handleChange} placeholder="Enter school or club code" style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Your Name (Required)</label>
                        <input name="userName" type="text" required value={formData.userName} onChange={handleChange} style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Email Address (Required)</label>
                        <input name="userEmail" type="email" required value={formData.userEmail} onChange={handleChange} style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Organization (Optional)</label>
                        <input name="organization" type="text" value={formData.organization} onChange={handleChange} style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                      </div>
                    </>
                  )}
                </div>

                {ageRange === "13-17" && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #0f172a', marginTop: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Parent/Guardian Name (Required)</label>
                      <input name="parentName" type="text" required value={formData.parentName} onChange={handleChange} style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#1e293b', marginBottom: '6px' }}>Parent/Guardian Email (Required)</label>
                      <input name="parentEmail" type="email" required value={formData.parentEmail} onChange={handleChange} style={{ width: '100%', border: '2px solid #0f172a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', color: '#0f172a', fontWeight: 700 }} />
                    </div>
                  </div>
                )}

                {/* Legal Checkbox Block */}
                {ageRange !== "Under 13" && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input name="legalAgreed" type="checkbox" required id="legal-check" style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: '#0f172a' }} />
                    <label htmlFor="legal-check" style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6, cursor: 'pointer' }}>
                      I certify that I am over 13 years of age (or have parental/guardian permission) and agree to the <button type="button" onClick={() => setShowLegalModal(true)} style={{ color: '#0f172a', fontWeight: 800, textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Submission Terms and Privacy Policy</button>. I grant permission for submitted content to be reviewed, edited, used, shared, or published across our network or partner projects.
                    </label>
                  </div>
                )}

                {/* Submit Buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || photos.length === 0}
                    style={{ flex: 1, background: '#0f172a', color: '#fff', padding: '16px', borderRadius: '12px', fontWeight: 900, textTransform: 'uppercase', fontSize: '13px', cursor: (isSubmitting || photos.length === 0) ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        UPLOADING...
                      </>
                    ) : 'SECURELY SUBMIT PHOTOS'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || photos.length === 0}
                    style={{ flex: 1, background: '#0f172a', color: '#fff', padding: '16px', borderRadius: '12px', fontWeight: 900, textTransform: 'uppercase', fontSize: '13px', cursor: (isSubmitting || photos.length === 0) ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  >
                    SUBMIT & ADD ANOTHER PHOTO
                  </button>
                </div>

              </form>
          </div>

          <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
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

      {/* NESTED LEGAL MODAL - FULL TEXT RESTORED */}
      {showLegalModal && (
        <div 
          onClick={() => setShowLegalModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ background: '#fff', width: '550px', maxWidth: '75%', height: '600px', maxHeight: '75%', borderRadius: '24px', display: 'flex', flexDirection: 'column', position: 'relative', border: '2.5px solid #000' }}
          >
            <button onClick={() => setShowLegalModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#000', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', zIndex: 20 }}>✕</button>
            
            <div style={{ padding: '40px', overflowY: 'auto', flexGrow: 1 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.05em' }}>
                LiveTimeData Content Submission & Release Agreement
              </h2>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
{`1. OWNERSHIP & ELIGIBILITY
You certify that you are at least 18 years of age and have the full legal capacity to enter into this agreement. You certify that you are the sole creator and owner of the photograph and that the submission does not infringe upon any third-party copyrights, trademarks, or privacy rights.

2. BROAD GRANT OF RIGHTS
You grant LiveTimeData a perpetual, irrevocable, worldwide, royalty-free, non-exclusive license to use, reproduce, modify, and display the photograph in any media now known or hereafter developed. This specifically includes, but is not limited to: the LiveTimeData website, mobile applications, social media channels, marketing materials, and third-party partnerships.

3. NO COMPENSATION & MONETIZATION
You acknowledge and agree that your submission is voluntary and that you are not entitled to any form of compensation, royalties, or financial reward for the use of the photograph. You further acknowledge that LiveTimeData may receive monetization or revenue from features where your submission is used, displayed, or situated (e.g., near advertisements or within premium features).

4. MODERATION & REMOVAL
LiveTimeData reserves the absolute right to accept, reject, or remove any submission at any time, for any reason, without notice. We are under no obligation to use or continue using any photo submitted.

5. INDEMNITY & HOLD HARMLESS
You agree to indemnify, defend, and hold harmless LiveTimeData, its owners, employees, agents, and third-party partners from and against any and all claims, damages, liabilities, or expenses (including legal fees) arising from a breach of this agreement or any harm/misuse caused by your submission.

6. THIRD-PARTY MISUSE
You acknowledge that once a photo is live, it may be subject to unauthorized use or "scraping" by unknown third parties. You agree to hold LiveTimeData harmless for any such unauthorized use or misuse of your submission by parties outside of our direct control.

7. GOVERNING LAW & JURISDICTION
This agreement is governed by the laws of the United States and the State of North Carolina. You agree that any legal proceedings related to this agreement shall be conducted exclusively in the courts located in North Carolina.`}
              </div>
            </div>

            <div style={{ padding: '20px 40px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setShowLegalModal(false)} style={{ background: '#000', color: '#fff', padding: '10px 24px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                Back to Form
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}