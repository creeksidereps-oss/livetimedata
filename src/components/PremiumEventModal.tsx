import React, { useState, useEffect } from "react";
import AddToCalendarButton from "./AddToCalendarButton";
import ShareButton from "./ShareButton";
import { OverlayModal } from "./EventsBlock";
import { EventItem } from "./EventsBlock";

interface PremiumEventModalProps {
  event: EventItem;
  citySegment: string;
  stateSegment: string;
  onClose: () => void;
}

export default function PremiumEventModal({ event, citySegment, stateSegment, onClose }: PremiumEventModalProps) {
  const [fallbackGraphic, setFallbackGraphic] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const [flyerError, setFlyerError] = useState(false);

  useEffect(() => {
    // keeping the fallback graphic logic for backwards compatibility if needed, but the main logic will prioritize flyer or official url
    if (!event.event_flyer_url && event.official_info_url) {
      fetch(`/api/og-preview?url=${encodeURIComponent(event.official_info_url)}`)
        .then(res => res.json())
        .then(data => {
          if (data.image) setFallbackGraphic(data.image);
        })
        .catch(console.error);
    }
  }, [event.event_flyer_url, event.official_info_url]);

  const slug = `${citySegment.toLowerCase().replace(/\s+/g, '-')}${stateSegment && stateSegment !== 'N/A' ? `-${stateSegment.toLowerCase().replace(/\s+/g, '-')}` : ''}`;
  const shareUrl = `https://livetimedata.com/city-dashboard?slug=${slug}&eventId=${event.id}`;
  const displayDate = new Date(event.eventDate || Date.now()).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const allFooterActions = (
    <>
      {event.affiliateUrl ? (
        <button
          type="button"
          onClick={() => setIframeUrl(event.affiliateUrl!)}
          style={{ background: "#4f46e5", color: "white", padding: "9px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", cursor: "pointer", textTransform: "uppercase" }}
        >
          Tickets
        </button>
      ) : (
        <button type="button" disabled style={{ background: "#e5e7eb", color: "#9ca3af", padding: "9px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", textTransform: "uppercase" }}>Tickets</button>
      )}

      {event.registration_url ? (
        <button
          type="button"
          onClick={() => setIframeUrl(event.registration_url!)}
          style={{ background: "#059669", color: "white", padding: "9px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", cursor: "pointer", textTransform: "uppercase" }}
        >
          Vendor Reg
        </button>
      ) : (
        <button type="button" disabled style={{ background: "#e5e7eb", color: "#9ca3af", padding: "9px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", textTransform: "uppercase" }}>Vendor Reg</button>
      )}


      <AddToCalendarButton 
        event={{
          title: event.title,
          details: event.details,
          venue: event.venue || '',
          eventDate: event.eventDate || '',
          startTime: event.time || ''
        }} 
      />
      <ShareButton 
        className=""
        style={{ background: "#a855f7", color: "white", padding: "9px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", cursor: "pointer", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
        title={event.title} 
        text={`Check out ${event.title} in ${citySegment}!`} 
        url={shareUrl} 
      />
      <button
        type="button"
        style={{ border: "none", background: "#111827", color: "#fff", borderRadius: "999px", padding: "9px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}
      >
        Submit Photo
      </button>
    </>
  );

  return (
    <>
      <OverlayModal
        title={event.title}
        subtitle={`${displayDate} · ${event.time || "Time TBA"} · ${event.venue}`}
        onClose={onClose}
        footerActions={allFooterActions}
      >
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "24px" }}>

          <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
             <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "8px" }}>About this Event</div>
             <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
               {event.details}
             </div>
          </div>

          {event.event_flyer_url && !flyerError ? (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Event Flyer</div>
              <img 
                src={event.event_flyer_url} 
                onError={() => setFlyerError(true)} 
                alt="Flyer" 
                style={{ maxWidth: "100%", borderRadius: "12px", border: "1px solid #e2e8f0" }} 
              />
            </div>
          ) : fallbackGraphic ? (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Event Flyer</div>
              <img src={fallbackGraphic} alt="Flyer" style={{ maxWidth: "100%", borderRadius: "12px", border: "1px solid #e2e8f0" }} />
            </div>
          ) : null}
        </div>
      </OverlayModal>

      {/* Secure Iframe Viewer */}
      {iframeUrl && (
        <OverlayModal
          title="External Portal"
          onClose={() => setIframeUrl(null)}
          footerActions={allFooterActions}
          noScroll={true}
          noPadding={true}
        >
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <iframe
              src={iframeUrl.startsWith("http") ? iframeUrl : `https://${iframeUrl}`}
              sandbox="allow-same-origin allow-scripts allow-popups"
              style={{ width: "100%", height: "100%", minHeight: "50vh", border: "none", borderRadius: "8px" }}
              onError={() => {
                fetch("/api/alerts/iframe-failure", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ eventId: event.id || "unknown", failedUrl: iframeUrl }),
                }).catch(() => {});
              }}
            />
          </div>
        </OverlayModal>
      )}
    </>
  );
}
