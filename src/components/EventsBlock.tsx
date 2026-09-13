// src/components/EventsBlock.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AddToCalendarButton from "./AddToCalendarButton";
import PremiumEventModal from "./PremiumEventModal";
import ShareButton from "./ShareButton";
import { getLocalizedCategoryLabel } from "@/lib/locale-categories";

type EventsBlockProps = {
  cityName: string;
  stateName?: string;
  showNearby?: boolean;
  countryCode?: string;
  lat?: number;
  lon?: number;
};

type CategoryKey =
  | "Festivals"
  | "Concerts"
  | "Sports"
  | "Venues"
  | "Food Trucks"
  | "Yard / Garage Sales"
  | "Tours"
  | "Lectures"
  | "Classes"
  | "Local"
  | "Clubs / Groups"
  | "Fundraisers"
  | "Conventions"
  | "Holiday"
  | "Arts"
  | "Kids"
  | "Seniors"
  | "Parades"
  | "Auditions"
  | "Comedy"
  | "Nightlife"
  | "Other";

type DBEventItem = {
  id: string;
  title: string;
  category: string;
  venue: string;
  source: string;
  startTime: string;
  eventDate: string;
  details: string;
  affiliateUrl: string | null;
  venue_address?: string;
  hosting_entity?: string;
  contact_email?: string;
  contact_phone?: string;
  official_info_url?: string;
  social_urls?: string;
  registration_url?: string;
  event_flyer_url?: string;
  cityName?: string;
};

export type EventItem = {
  id: string;
  title: string;
  source: string;
  time: string;
  venue: string;
  categories: CategoryKey[];
  details: string;
  affiliateUrl: string | null;
  venue_address?: string;
  hosting_entity?: string;
  contact_email?: string;
  contact_phone?: string;
  official_info_url?: string;
  social_urls?: string;
  registration_url?: string;
  event_flyer_url?: string;
  eventDate?: string;
  cityName?: string;
};

type DayBucket = {
  iso: string;
  dayLabel: string;
  dateLabel: string;
  categories: {
    key: CategoryKey;
    items: EventItem[];
  }[];
};

const CATEGORY_ORDER: CategoryKey[] = [
  "Festivals",
  "Concerts",
  "Sports",
  "Venues",
  "Food Trucks",
  "Yard / Garage Sales",
  "Tours",
  "Lectures",
  "Classes",
  "Local",
  "Clubs / Groups",
  "Fundraisers",
  "Conventions",
  "Holiday",
  "Arts",
  "Kids",
  "Seniors",
  "Parades",
  "Auditions",
  "Comedy",
  "Nightlife",
  "Other",
];

function formatMonthDay(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  return next;
}

function makeIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeCategories(dbCategory: string): CategoryKey[] {
  if (!dbCategory) return ["Other"];
  const parts = dbCategory.split(/[,;]+/).map(s => s.trim());
  const matched: CategoryKey[] = [];

  for (const p of parts) {
    const pLow = p.toLowerCase();

    // Food Trucks
    if (
      pLow.includes("food truck") ||
      pLow.includes("mobile food") ||
      pLow.includes("street food") ||
      pLow.includes("food van") ||
      pLow.includes("food trailer") ||
      pLow.includes("mobile_street_food")
    ) {
      if (!matched.includes("Food Trucks")) matched.push("Food Trucks");
    }

    // Yard & Garage Sales
    if (
      pLow.includes("yard") ||
      pLow.includes("garage sale") ||
      pLow.includes("estate sale") ||
      pLow.includes("car boot") ||
      pLow.includes("rummage") ||
      pLow.includes("tag sale") ||
      pLow.includes("moving sale") ||
      pLow.includes("yard_estate_sales")
    ) {
      if (!matched.includes("Yard / Garage Sales")) matched.push("Yard / Garage Sales");
    }

    // Kids / Family
    if (
      pLow.includes("kid") ||
      pLow.includes("child") ||
      pLow.includes("toddler") ||
      pLow.includes("youth") ||
      pLow.includes("preschool") ||
      pLow.includes("family") ||
      pLow.includes("teen")
    ) {
      if (!matched.includes("Kids")) matched.push("Kids");
    }

    // Arts & Crafts
    if (
      pLow.includes("art") ||
      pLow.includes("craft") ||
      pLow.includes("paint") ||
      pLow.includes("creative") ||
      pLow.includes("studio") ||
      pLow.includes("drawing") ||
      pLow.includes("pottery") ||
      pLow.includes("gallery") ||
      pLow.includes("exhibit")
    ) {
      if (!matched.includes("Arts")) matched.push("Arts");
    }

    // Concerts / Music
    if (
      pLow.includes("concert") ||
      pLow.includes("music") ||
      pLow.includes("band") ||
      pLow.includes("live music") ||
      pLow.includes("symphon") ||
      pLow.includes("acoustic") ||
      pLow.includes("orchestra") ||
      pLow.includes("singer")
    ) {
      if (!matched.includes("Concerts")) matched.push("Concerts");
    }

    // Festivals
    if (
      pLow.includes("fest") ||
      pLow.includes("fair") ||
      pLow.includes("carnival") ||
      pLow.includes("fiesta")
    ) {
      if (!matched.includes("Festivals")) matched.push("Festivals");
    }

    // Sports
    if (
      pLow.includes("sport") ||
      pLow.includes("game") ||
      pLow.includes("soccer") ||
      pLow.includes("football") ||
      pLow.includes("baseball") ||
      pLow.includes("basketball") ||
      pLow.includes("nascar") ||
      pLow.includes("racing") ||
      pLow.includes("run") ||
      pLow.includes("5k") ||
      pLow.includes("marathon")
    ) {
      if (!matched.includes("Sports")) matched.push("Sports");
    }

    // Clubs / Groups
    if (
      pLow.includes("club") ||
      pLow.includes("group") ||
      pLow.includes("meetup") ||
      pLow.includes("society") ||
      pLow.includes("guild") ||
      pLow.includes("league") ||
      pLow.includes("rotary")
    ) {
      if (!matched.includes("Clubs / Groups")) matched.push("Clubs / Groups");
    }

    // Fundraisers & Nonprofits
    if (
      pLow.includes("fundrais") ||
      pLow.includes("charity") ||
      pLow.includes("benefit") ||
      pLow.includes("501c") ||
      pLow.includes("gala") ||
      pLow.includes("auction") ||
      pLow.includes("raffle") ||
      pLow.includes("nonprofit") ||
      pLow.includes("donation") ||
      pLow.includes("spirit night")
    ) {
      if (!matched.includes("Fundraisers")) matched.push("Fundraisers");
    }

    // Classes / Workshops / Education
    if (
      pLow.includes("class") ||
      pLow.includes("workshop") ||
      pLow.includes("training") ||
      pLow.includes("canva") ||
      pLow.includes("course") ||
      pLow.includes("seminar") ||
      pLow.includes("tutorial") ||
      pLow.includes("learn") ||
      pLow.includes("certification") ||
      pLow.includes("instruction") ||
      pLow.includes("lesson")
    ) {
      if (!matched.includes("Classes")) matched.push("Classes");
    }

    // Lectures / Books / Literature
    if (
      pLow.includes("lecture") ||
      pLow.includes("talk") ||
      pLow.includes("author") ||
      pLow.includes("book") ||
      pLow.includes("literature") ||
      pLow.includes("conference")
    ) {
      if (!matched.includes("Lectures")) matched.push("Lectures");
    }

    // Comedy
    if (
      pLow.includes("comedy") ||
      pLow.includes("standup") ||
      pLow.includes("improv")
    ) {
      if (!matched.includes("Comedy")) matched.push("Comedy");
    }

    // Nightlife
    if (
      pLow.includes("nightlife") ||
      pLow.includes("trivia") ||
      pLow.includes("karaoke") ||
      pLow.includes("dj")
    ) {
      if (!matched.includes("Nightlife")) matched.push("Nightlife");
    }

    // Holiday
    if (
      pLow.includes("holiday") ||
      pLow.includes("christmas") ||
      pLow.includes("halloween") ||
      pLow.includes("easter") ||
      pLow.includes("independence day") ||
      pLow.includes("4th of july")
    ) {
      if (!matched.includes("Holiday")) matched.push("Holiday");
    }

    // Parades
    if (pLow.includes("parade")) {
      if (!matched.includes("Parades")) matched.push("Parades");
    }

    // Seniors
    if (
      pLow.includes("senior") ||
      pLow.includes("retiree") ||
      pLow.includes("elder")
    ) {
      if (!matched.includes("Seniors")) matched.push("Seniors");
    }

    // Tours
    if (pLow.includes("tour") || pLow.includes("crawl")) {
      if (!matched.includes("Tours")) matched.push("Tours");
    }

    // Fallback exact match with CATEGORY_ORDER
    const found = CATEGORY_ORDER.find((c) => c.toLowerCase() === pLow);
    if (found && !matched.includes(found)) matched.push(found);
  }

  return matched.length > 0 ? matched : ["Other"];
}

function categoryAccent(category: CategoryKey) {
  switch (category) {
    case "Festivals":
      return "#f59e0b";
    case "Concerts":
      return "#8b5cf6";
    case "Sports":
      return "#10b981";
    case "Venues":
      return "#0ea5e9";
    case "Food Trucks":
      return "#ea580c"; // bold food truck orange
    case "Yard / Garage Sales":
      return "#059669"; // vibrant emerald green
    case "Tours":
      return "#f97316";
    case "Lectures":
      return "#6366f1";
    case "Classes":
      return "#0d9488"; // rich vibrant teal
    case "Local":
      return "#64748b";
    case "Clubs / Groups":
      return "#ec4899";
    case "Fundraisers":
      return "#e11d48"; // vibrant rose / heart crimson
    case "Conventions":
      return "#3b82f6";
    case "Holiday":
      return "#ef4444";
    case "Arts":
      return "#d946ef";
    case "Kids":
      return "#14b8a6";
    case "Seniors":
      return "#84cc16";
    case "Parades":
      return "#f43f5e";
    case "Comedy":
      return "#eab308";
    case "Nightlife":
      return "#9333ea";
    default:
      return "#6b7280";
  }
}

// Discreet, un-flamboyant ad frame at the bottom of the popups to maximize revenue beautifully
function DiscreteModalAdSlot() {
  return (
    <div style={{ width: '100%', height: '45px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        ADVERTISEMENT SPACE
      </span>
    </div>
  );
}

function buildTenDayBucketData(rawEvents: DBEventItem[]): DayBucket[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: 10 }).map((_, index) => {
    const date = addDays(today, index);
    const iso = makeIso(date);

    const filteredDbItems = rawEvents.filter((e) => {
      if (!e.eventDate) return false;
      return e.eventDate.slice(0, 10) === iso;
    });

    const parsedItems: EventItem[] = filteredDbItems.map((e) => ({
      id: e.id,
      title: e.title,
      source: e.source,
      time: e.startTime,
      venue: e.venue,
      categories: normalizeCategories(e.category),
      details: e.details,
      affiliateUrl: e.affiliateUrl,
      venue_address: e.venue_address,
      hosting_entity: e.hosting_entity,
      contact_email: e.contact_email,
      contact_phone: e.contact_phone,
      official_info_url: e.official_info_url,
      social_urls: e.social_urls,
      registration_url: e.registration_url,
      event_flyer_url: e.event_flyer_url,
      eventDate: e.eventDate,
      cityName: e.cityName
    }));

    const grouped = CATEGORY_ORDER.map((category) => ({
      key: category,
      items: parsedItems.filter((event) => event.categories.includes(category)),
    })).filter((group) => group.items.length > 0);

    return {
      iso,
      dayLabel:
        index === 0
          ? "Today"
          : date.toLocaleDateString("en-US", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      categories: grouped.slice(0, 5),
    };
  });
}

function buildMonthDays() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: 365 }).map((_, index) => {
    const date = addDays(today, index);
    return {
      iso: makeIso(date),
      label: formatMonthDay(date),
      month: date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
    };
  });
}

function flattenEvents(days: DayBucket[]) {
  return days.flatMap((day) =>
    day.categories.flatMap((group) =>
      group.items.map((event) => ({
        ...event,
        iso: day.iso,
        dayLabel: day.dayLabel,
        dateLabel: day.dateLabel,
      }))
    )
  );
}

function EventCard({
  event,
  onClick,
}: {
  event: EventItem & { dayLabel?: string; dateLabel?: string; iso?: string };
  onClick: () => void;
}) {
  const primaryCategory = event.categories[0] || "Other";
  const accent = categoryAccent(primaryCategory);

  return (
    <div
      style={{
        border: `1px solid ${accent}40`,
        borderRadius: "12px",
        padding: "10px",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              lineHeight: 1.2,
              color: "#111827",
              marginBottom: "4px",
            }}
          >
            {event.title}
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "#4b5563",
              lineHeight: 1.3,
            }}
          >
            {event.dayLabel && event.dateLabel
              ? `${event.dayLabel} · ${event.dateLabel} · `
              : ""}
            {event.time} · {event.venue}
            {event.cityName && (
              <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "1px 7px", borderRadius: "999px", fontSize: "10px", fontWeight: 800, marginLeft: "6px", display: "inline-block" }}>
                {event.cityName}
              </span>
            )}
            {event.venue_address && (
              <div style={{ color: "#64748b", fontSize: "10.5px", marginTop: "2px" }}>
                📍 {event.venue_address}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClick}
          style={{
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#111827",
            borderRadius: "999px",
            padding: "6px 10px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          View
        </button>
      </div>
    </div>
  );
}

export function OverlayModal({
  title,
  subtitle,
  headerAction,
  footerActions,
  onClose,
  children,
  noScroll,
  noPadding
}: {
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footerActions?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  noScroll?: boolean;
  noPadding?: boolean;
}) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 99999,
        }}
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: "1000px",
            height: "92vh",
            maxHeight: "92vh",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              background: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: "12px" }}>
              {title}
            </h2>
            {subtitle && (
              <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "3px" }}>{subtitle}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {headerAction && <div>{headerAction}</div>}
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                borderRadius: "999px",
                width: "34px",
                height: "34px",
                fontSize: "18px",
                fontWeight: 700,
                lineHeight: 1,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          className={noScroll ? "" : "overflow-y-auto"}
          style={{
            padding: noPadding ? "0" : "14px 16px",
            background: "#fff",
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            overflow: noScroll ? "hidden" : "auto"
          }}
        >
          {children}
        </div>

        <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          {/* Row 1: Event-specific action pills (Register, Official, Share, Add) */}
          {footerActions && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {footerActions}
            </div>
          )}

          {/* Row 2: General site navigation pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={onClose} style={{ background: '#0f172a', color: '#fff', padding: '9px 18px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              BACK TO SITE
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' })); }} style={{ background: '#0f172a', color: '#fff', padding: '9px 18px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT EVENT
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'share_insights' })); }} style={{ background: '#0f172a', color: '#fff', padding: '9px 18px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SHARE INSIGHTS
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_photo' })); }} style={{ background: '#0f172a', color: '#fff', padding: '9px 18px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT PHOTO
            </button>
            <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_webcam' })); }} style={{ background: '#0f172a', color: '#fff', padding: '9px 18px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              SUBMIT WEBCAM
            </button>
          </div>
          
          <DiscreteModalAdSlot />
        </div>
      </div>
      </div>
    </>
  );
}


function getCityLogo(cityName?: string): string | null {
  if (!cityName) return null;
  const c = cityName.toLowerCase().trim();
  if (c.includes("troutman")) return "/images/cities/troutman.png";
  if (c.includes("statesville")) return "/images/cities/statesville.png";
  if (c.includes("mooresville")) return "/images/cities/mooresville.png";
  if (c.includes("charlotte")) return "/images/cities/charlotte.png";
  return null;
}

function getCuratedSaleInfo(ev: EventItem): { url: string; label: string } | null {
  const text = `${ev.title || ''} ${ev.details || ''} ${ev.categories.join(' ')}`.toLowerCase();
  
  // Brocante / Vide-Grenier (France & French-speaking Europe)
  if (
    text.includes("vide-grenier") ||
    text.includes("vide grenier") ||
    text.includes("brocante") ||
    text.includes("vide-maison") ||
    text.includes("vide maison") ||
    text.includes("bric-a-brac") ||
    text.includes("marché aux puces")
  ) {
    return { url: "/images/curated/vide_grenier.jpg", label: "Authentic French Vide-Grenier & Brocante Listing" };
  }
  
  // Car Boot Sale (UK, Ireland, Australia, Commonwealth)
  if (
    text.includes("car boot") ||
    text.includes("boot sale") ||
    text.includes("carboot")
  ) {
    return { url: "/images/curated/car_boot_sale.jpg", label: "Authentic UK & Commonwealth Car Boot Sale" };
  }
  
  // Estate & Moving Sale
  if (
    text.includes("estate sale") ||
    text.includes("moving sale") ||
    text.includes("downsizing sale") ||
    text.includes("tag sale") ||
    text.includes("estatesales.net")
  ) {
    return { url: "/images/curated/estate_sale.jpg", label: "Estate & Moving Sale Directory Notice" };
  }
  
  // General Yard & Garage Sale
  if (
    ev.categories.includes("Yard / Garage Sales") ||
    text.includes("yard sale") ||
    text.includes("garage sale") ||
    text.includes("rummage sale") ||
    text.includes("barn sale") ||
    text.includes("porch sale")
  ) {
    return { url: "/images/curated/yard_sale.jpg", label: "Neighborhood Yard & Garage Sale Notice" };
  }
  
  return null;
}

function InlineEventModal({ ev, cityName, onClose, setIframeUrl }: { ev: EventItem; cityName: string; onClose: () => void; setIframeUrl: (url: string) => void }) {
  const [flyerError, setFlyerError] = useState(false);
  const [liveScrapedUrl, setLiveScrapedUrl] = useState<string | null>(null);
  const [liveScrapedError, setLiveScrapedError] = useState(false);
  const [bankedEntityGraphic, setBankedEntityGraphic] = useState<string | null>(null);
  const [bankedError, setBankedError] = useState(false);

  const displayDate = new Date(ev.eventDate || Date.now()).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isGenericPlaceholder =
    ev.event_flyer_url?.includes("civicplus.com/ImageRepository/Document?documentID=450") ||
    ev.event_flyer_url?.includes("/AlertCenter/") ||
    ev.event_flyer_url?.includes("default-placeholder");

  const saleInfo = getCuratedSaleInfo(ev);
  const isUserSubmittedFlyer = (ev.source === "User Submission" || ev.source === "User Form") && !!ev.event_flyer_url && !flyerError && !isGenericPlaceholder;

  // Waterfall Graphic Resolver:
  // 1. If Yard/Estate/Boot/Brocante sale:
  //    - If owner uploaded flyer, use it.
  //    - Otherwise ALWAYS use curated fallback (never attempt web scrape for yard sales).
  // 2. For other events without flyer:
  //    - Attempt live site/social scrape via /api/og-preview
  //    - If none, attempt banked entity graphic lookup via /api/entities/lookup
  //    - If none, check town/city municipal seal.
  useEffect(() => {
    // If it's a sale and not user flyer, saleInfo handles it directly
    if (saleInfo && !isUserSubmittedFlyer) return;
    if (ev.event_flyer_url && !flyerError && !isGenericPlaceholder) return;

    let isMounted = true;

    async function resolveFallbackGraphic() {
      // Step A: Look for photo/graphic on event site or correlating Facebook/social
      const targetWebUrl = ev.official_info_url || ev.social_urls || ev.registration_url;
      if (targetWebUrl && targetWebUrl.startsWith("http")) {
        try {
          const res = await fetch(`/api/og-preview?url=${encodeURIComponent(targetWebUrl)}`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.ok && data.imageUrl) {
              setLiveScrapedUrl(data.imageUrl);
              return;
            }
          }
        } catch {
          // silent fallback to next tier
        }
      }

      // Step B: Look for banked/saved graphic in entity graph (venue or hosting entity)
      const lookupTarget = ev.hosting_entity || ev.venue;
      if (lookupTarget && lookupTarget.trim().length > 1) {
        try {
          const res = await fetch(`/api/entities/lookup?name=${encodeURIComponent(lookupTarget.trim())}`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data.ok && data.entity?.imageUrl) {
              setBankedEntityGraphic(data.entity.imageUrl);
              return;
            }
          }
        } catch {
          // silent fallback to next tier
        }
      }
    }

    resolveFallbackGraphic();

    return () => {
      isMounted = false;
    };
  }, [ev.id, ev.official_info_url, ev.social_urls, ev.registration_url, ev.hosting_entity, ev.venue, ev.event_flyer_url, flyerError, isGenericPlaceholder, saleInfo, isUserSubmittedFlyer]);

  const cityLogo = getCityLogo(ev.cityName || cityName);

  // Determine active graphic and badge
  let activeGraphicUrl: string | undefined = undefined;
  let graphicBadge: string | null = null;
  let isSealFallback = false;
  let isCuratedArt = false;

  if (saleInfo) {
    if (isUserSubmittedFlyer) {
      activeGraphicUrl = ev.event_flyer_url;
    } else {
      activeGraphicUrl = saleInfo.url;
      graphicBadge = saleInfo.label;
      isCuratedArt = true;
    }
  } else if (ev.event_flyer_url && !flyerError && !isGenericPlaceholder) {
    activeGraphicUrl = ev.event_flyer_url;
  } else if (liveScrapedUrl && !liveScrapedError) {
    activeGraphicUrl = liveScrapedUrl;
    graphicBadge = "Live Event Preview · Official Site";
  } else if (bankedEntityGraphic && !bankedError) {
    activeGraphicUrl = bankedEntityGraphic;
    graphicBadge = `Banked Profile Photo · ${ev.hosting_entity || ev.venue}`;
  } else if (cityLogo) {
    activeGraphicUrl = cityLogo;
    graphicBadge = `Official ${ev.cityName || cityName} Municipal & Community Notice`;
    isSealFallback = true;
  }

  return (
    <OverlayModal
      title={`${ev.cityName || cityName} - ${ev.title}`}
      onClose={onClose}
      footerActions={
        <>
          {(ev.registration_url || ev.affiliateUrl) && (
            <button 
              type="button"
              onClick={() => setIframeUrl(ev.registration_url || ev.affiliateUrl!)}
              style={{
                background: "#059669",
                color: "white",
                padding: "11px 22px",
                borderRadius: "999px",
                fontWeight: 900,
                fontSize: "11px",
                letterSpacing: "0.05em",
                border: "none",
                cursor: "pointer",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                boxShadow: "0 4px 12px rgba(5,150,105,0.25)"
              }}
            >
              {ev.affiliateUrl && !ev.registration_url ? "🎟️ Get Tickets" : "Register"}
            </button>
          )}

          <ShareButton 
            className=""
            style={{
              background: "#a855f7",
              color: "white",
              padding: "11px 22px",
              borderRadius: "999px",
              fontWeight: 900,
              fontSize: "11px",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: "0 4px 12px rgba(168,85,247,0.25)"
            }}
            title={ev.title} 
            text={`Check out ${ev.title} in ${cityName}!`} 
            url={`https://livetimedata.com/events/${ev.id}`} 
          />

          <AddToCalendarButton 
            className=""
            style={{
              background: "#4f46e5",
              color: "white",
              padding: "11px 22px",
              borderRadius: "999px",
              fontWeight: 900,
              fontSize: "11px",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 12px rgba(79,70,229,0.25)"
            }}
            event={{
              title: ev.title,
              details: ev.details,
              venue: ev.venue || '',
              eventDate: ev.eventDate || (ev as any).event_date || '',
              startTime: ev.time || (ev as any).start_time || '',
              cityName: ev.cityName || ''
            }} 
          />
        </>
      }
    >
      <div style={{ padding: "0", display: "flex", flexDirection: "column" }}>
        
        {/* IMPORTANT FACTS HEADER - Light & Clean */}
        <div style={{ padding: "24px 24px 16px 24px", display: "flex", flexDirection: "column", gap: "4px", background: "#fff" }}>
          <div style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6366f1" }}>
            {displayDate}
          </div>
          <div style={{ fontSize: "36px", fontWeight: 900, lineHeight: 1.1, color: "#0f172a" }}>
            {ev.time || (ev as any).start_time || "Time TBA"}
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, display: "flex", flexDirection: "column", gap: "4px", color: "#475569", marginTop: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              📍 <span style={{ color: "#0f172a" }}>{ev.venue}</span>{ev.cityName ? ` · ${ev.cityName}` : ''}
            </div>
            {ev.venue_address && (
              <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 500, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", paddingLeft: "24px" }}>
                <span>{ev.venue_address}</span>
                <button
                  type="button"
                  onClick={() => setIframeUrl(`https://maps.google.com/maps?q=${encodeURIComponent(`${ev.venue} ${ev.venue_address} ${ev.cityName || ''}`.trim())}&output=embed`)}
                  style={{ background: "none", border: "none", padding: 0, color: "#4f46e5", fontWeight: 700, textDecoration: "underline", fontSize: "12px", cursor: "pointer" }}
                >
                  Map & Directions &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* FLYER / GRAPHIC WATERFALL DISPLAY */}
        {activeGraphicUrl && (
          <div style={{
            width: "100%",
            background: isSealFallback ? "#f8fafc" : "#0f172a",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            borderTop: "1px solid #e2e8f0",
            borderBottom: "1px solid #e2e8f0",
            padding: isSealFallback ? "24px 16px" : "16px 16px 20px 16px"
          }}>
            <img 
              src={activeGraphicUrl} 
              onError={() => {
                if (activeGraphicUrl === ev.event_flyer_url) setFlyerError(true);
                else if (activeGraphicUrl === liveScrapedUrl) setLiveScrapedError(true);
                else if (activeGraphicUrl === bankedEntityGraphic) setBankedError(true);
              }} 
              alt={graphicBadge || "Event Graphic"} 
              style={{
                width: isCuratedArt ? "100%" : "auto",
                maxWidth: isSealFallback ? "300px" : isCuratedArt ? "680px" : "100%",
                maxHeight: isSealFallback ? "160px" : "75vh",
                objectFit: isCuratedArt ? "cover" : "contain",
                borderRadius: isSealFallback ? "8px" : "12px",
                boxShadow: isSealFallback ? "none" : "0 8px 30px rgba(0,0,0,0.35)"
              }} 
            />
            {graphicBadge && (
              <div style={{
                marginTop: "12px",
                fontSize: "11px",
                fontWeight: 800,
                color: isSealFallback ? "#64748b" : "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: isSealFallback ? "transparent" : "rgba(255,255,255,0.08)",
                padding: isSealFallback ? "0" : "4px 12px",
                borderRadius: "999px"
              }}>
                {graphicBadge}
              </div>
            )}
          </div>
        )}

        {/* MAIN BODY */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px", background: "#fff" }}>
          <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "16px", fontWeight: 900, marginBottom: "8px", color: "#0f172a", textTransform: "uppercase" }}>About this Event</div>
            <div style={{ fontSize: "15px", color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {ev.details}
            </div>

            {/* Owner Claim / Photo Submission Callout */}
            <div style={{
              marginTop: "20px",
              padding: "16px 18px",
              borderRadius: "14px",
              background: "#f0fdf4",
              border: "1.5px dashed #22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "240px", flex: "1" }}>
                <span style={{ fontSize: "24px" }}>📸</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#166534" }}>
                    {saleInfo ? "Is this your sale or listing?" : "Are you organizing this event?"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#15803d", marginTop: "2px" }}>
                    {saleInfo 
                      ? "Add your featured items, high-res photos, or updates to help buyers find you!" 
                      : "Add your official flyer, photos, or schedule updates anytime."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('openModal', { detail: 'submit_event' }));
                }}
                style={{
                  background: "#166534",
                  color: "#ffffff",
                  padding: "10px 18px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(22,101,52,0.25)",
                  whiteSpace: "nowrap"
                }}
              >
                + Add Photos & Info
              </button>
            </div>
          </div>
        </div>
      </div>
    </OverlayModal>
  );
}

export default function EventsBlock({ cityName, stateName: incomingStateName, showNearby: incomingNearby = false, countryCode = "US", lat, lon }: EventsBlockProps) {
  const [dbEvents, setDbEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNearby, setShowNearby] = useState(incomingNearby);

  // Community Event Submission State Matrix
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    const handleOpenModal = (e: CustomEvent) => {
      if (e.detail === 'submit_event') {
        setSubmitOpen(true);
        setSubmitStep("form");
      }
    };
    window.addEventListener('openModal', handleOpenModal as EventListener);
    return () => window.removeEventListener('openModal', handleOpenModal as EventListener);
  }, []);
  
  useEffect(() => {
    if (!submitOpen) return;
    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleGlobalPaste = (e: ClipboardEvent) => {
      let file = Array.from(e.clipboardData?.files || []).find(f => f.type.startsWith("image/"));
      if (!file && e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          if (e.clipboardData.items[i].type.startsWith("image/")) {
            const f = e.clipboardData.items[i].getAsFile();
            if (f) {
              file = f;
              break;
            }
          }
        }
      }
      if (file) {
        setFormImage(file);
        const reader = new FileReader();
        reader.onloadend = () => setFormFlyerBase64(reader.result as string);
        reader.readAsDataURL(file);
      }
    };

    window.addEventListener('dragover', preventDrag);
    window.addEventListener('drop', preventDrag);
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('dragover', preventDrag);
      window.removeEventListener('drop', preventDrag);
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [submitOpen]);

  const [submitStep, setSubmitStep] = useState<"form" | "success">("form");
  const [ageRange, setAgeRange] = useState("18+");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formOrg, setFormOrg] = useState("");
  const [formHostingEntity, setFormHostingEntity] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  
  const [formTitle, setFormTitle] = useState("");
  const [formCategories, setFormCategories] = useState<string[]>(["Other"]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [formVenueName, setFormVenueName] = useState("");
  const [formVenueAddress, setFormVenueAddress] = useState("");
  const [formCity, setFormCity] = useState(cityName.split(",")[0]?.trim() || cityName);
  const [formState, setFormState] = useState(incomingStateName || cityName.split(",")[1]?.trim() || "");
  const [formTime, setFormTime] = useState("");
  const [formDates, setFormDates] = useState<string[]>([]);
  const [formFlyerBase64, setFormFlyerBase64] = useState<string | null>(null);

  const [autofillUrl, setAutofillUrl] = useState("");
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillImageLoading, setAutofillImageLoading] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

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
      }
    } catch (err: any) {
      setAutofillError(err.message);
    } finally {
      setAutofillLoading(false);
    }
  }

  const [formDetails, setFormDetails] = useState("");
  
  const [formInfoUrl, setFormInfoUrl] = useState("");
  const [formSocialUrls, setFormSocialUrls] = useState("");
  const [formTicketUrl, setFormTicketUrl] = useState("");
  const [formVendorUrl, setFormVendorUrl] = useState("");
  const [formImage, setFormImage] = useState<File | null>(null);
  const [isFlyerDragging, setIsFlyerDragging] = useState(false);
  const [formFlyerUrl, setFormFlyerUrl] = useState("");
  
  const [formSending, setFormSending] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentDateInput, setCurrentDateInput] = useState("");
  const [selectedNearbyCity, setSelectedNearbyCity] = useState<string | null>(null);

  const nearbyCities = useMemo(() => {
    if (!showNearby) return [];
    const cityCounts = new Map<string, number>();
    for (const e of dbEvents) {
      const c = e.cityName || (e as any).city_name;
      if (c) cityCounts.set(c, (cityCounts.get(c) || 0) + 1);
    }
    return Array.from(cityCounts.entries()).map(([name, count]) => ({ name, count }));
  }, [dbEvents, showNearby]);

  const effectiveDbEvents = useMemo(() => {
    if (!showNearby || !selectedNearbyCity) return dbEvents;
    return dbEvents.filter((e) => (e.cityName || (e as any).city_name) === selectedNearbyCity);
  }, [dbEvents, showNearby, selectedNearbyCity]);

  const days = useMemo(() => buildTenDayBucketData(effectiveDbEvents), [effectiveDbEvents]);
  const monthDays = useMemo(() => buildMonthDays(), []);
  const allEvents = useMemo(() => flattenEvents(days), [days]);

  const [dayModalIso, setDayModalIso] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [categoryModalKey, setCategoryModalKey] = useState<CategoryKey | null>(null);
  const [activeDayCategory, setActiveDayCategory] = useState<CategoryKey | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const parts = useMemo(() => cityName.split(","), [cityName]);
  const citySegment = parts[0]?.trim() || cityName;
  const stateSegment = incomingStateName || parts[1]?.trim() || "";

  async function fetchEvents() {
    setLoading(true);
    try {
      const queryLat = (typeof lat === 'number' && typeof lon === 'number') ? `&lat=${lat}&lon=${lon}` : '';
      const response = await fetch(
        `/api/events?city=${encodeURIComponent(citySegment)}&state=${encodeURIComponent(stateSegment)}${showNearby ? '&nearby=true' : ''}${queryLat}`
      );
      if (!response.ok) {
        console.error("Server API routing issue. Data not fetched.");
        return;
      }
      const data = await response.json();
      if (data.ok) {
        setDbEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed loading backend event parameters:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, [cityName, showNearby, lat, lon]);

  const selectedDay = useMemo(() => {
    let day = days.find((day) => day.iso === dayModalIso);
    if (!day && dayModalIso) {
      const date = new Date(dayModalIso + "T12:00:00");
      const filteredDbItems = effectiveDbEvents.filter((e) => {
        if (!e.eventDate && !(e as any).event_date) return false;
        return (e.eventDate || (e as any).event_date).slice(0, 10) === dayModalIso;
      });

      const parsedItems: EventItem[] = filteredDbItems.map((e) => ({
        id: e.id,
        title: e.title,
        source: e.source,
        time: e.startTime,
        venue: e.venue,
        categories: normalizeCategories(e.category),
        details: e.details,
        affiliateUrl: e.affiliateUrl,
        venue_address: e.venue_address,
        hosting_entity: e.hosting_entity,
        contact_email: e.contact_email,
        contact_phone: e.contact_phone,
        official_info_url: e.official_info_url,
        social_urls: e.social_urls,
        registration_url: e.registration_url,
        event_flyer_url: e.event_flyer_url,
        eventDate: e.eventDate,
        cityName: e.cityName
      }));

      const grouped = CATEGORY_ORDER.map((category) => ({
        key: category,
        items: parsedItems.filter((event) => event.categories.includes(category)),
      })).filter((group) => group.items.length > 0);

      day = {
        iso: dayModalIso,
        dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
        dateLabel: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        categories: grouped.slice(0, 5),
      };
    }
    return day ?? null;
  }, [days, dayModalIso, dbEvents]);

  const effectiveActiveCategory = activeDayCategory || selectedDay?.categories[0]?.key || null;

  const selectedDayItems =
    selectedDay?.categories.find((group) => group.key === effectiveActiveCategory)
      ?.items ?? [];

  const categoryEvents = useMemo(() => {
    if (!categoryModalKey) return [];
    
    // We must use dbEvents instead of allEvents to capture events beyond the initial 10-day timeline
    const now = new Date();
    now.setHours(0, 0, 0, 0); // start of today
    
    const parsedItems: EventItem[] = effectiveDbEvents
      .filter((e) => {
        if (!e.eventDate && !(e as any).event_date) return false;
        const eDate = new Date((e.eventDate || (e as any).event_date).slice(0, 10) + "T12:00:00");
        return eDate >= now; // upcoming events only
      })
      .map((e) => ({
        id: e.id,
        title: e.title,
        source: e.source,
        time: e.startTime,
        venue: e.venue,
        categories: normalizeCategories(e.category),
        details: e.details,
        affiliateUrl: e.affiliateUrl,
        venue_address: e.venue_address,
        hosting_entity: e.hosting_entity,
        contact_email: e.contact_email,
        contact_phone: e.contact_phone,
        official_info_url: e.official_info_url,
        social_urls: e.social_urls,
        registration_url: e.registration_url,
        event_flyer_url: e.event_flyer_url,
        eventDate: e.eventDate,
        cityName: e.cityName
      }));

    return parsedItems
      .filter((event) => event.categories.includes(categoryModalKey))
      .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime());
  }, [effectiveDbEvents, categoryModalKey]);

  function openDayModal(iso: string, category?: CategoryKey | null) {
    const day = days.find((d) => d.iso === iso) ?? null;
    setCalendarOpen(false);
    setCategoryModalKey(null);
    setSubmitOpen(false);
    setDayModalIso(iso);
    setActiveDayCategory(category ?? day?.categories[0]?.key ?? null);
    setOpenEventId(null);
  }

  function closeAllModals() {
    setDayModalIso(null);
    setCalendarOpen(false);
    setCategoryModalKey(null);
    setActiveDayCategory(null);
    setOpenEventId(null);
    setSubmitOpen(false);
    setSubmitStep("form");
    setFormMessage(null);
    setIframeUrl(null);
    
    // Total Form Wipe - resets everything back to a completely blank slate
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setAgeRange("18+");
    setParentName("");
    setParentEmail("");
    setFormOrg("");
    setFormHostingEntity("");
    setFormContactEmail("");
    setFormContactPhone("");
    setFormTitle("");
    setFormCategories(["Other"]);
    setFormVenueName("");
    setFormVenueAddress("");
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
  }

  async function handleFormSubmit(e: React.FormEvent, isAddAnother: boolean) {
    e.preventDefault();
    if (formSending) return;
    if (ageRange === "Under 13") {
      setFormMessage({ type: "error", text: "You must enter a valid Teacher Code to submit as an Under 13 participant." });
      setFormSending(false);
      return;
    }
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
          document.querySelector('.overflow-y-auto')?.scrollTo(0,0);
        } else {
          setSubmitStep("success");
          setFormMessage(null);
        }
        fetchEvents(); 
      } else {
        setFormMessage({ type: "error", text: data.error || "Event submission failed. Verify parameters." });
      }
    } catch (err) {
      setFormMessage({ type: "error", text: "Network connection timeout. Re-establishing secure lines..." });
    } finally {
      setFormSending(false);
    }
  }
 return (
    <section
      style={{
        marginTop: "10px",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "9px",
        background: "#ffffff",
        boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          marginBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 900,
              color: "#111827",
              margin: 0,
              lineHeight: 1.2,
              textTransform: "uppercase",
            }}
          >
            CITY EVENTS {citySegment.toUpperCase()}{showNearby ? " - NEARBY" : ""}
          </h2>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginTop: "2px",
            }}
          >
            {loading ? "Syncing data matrix..." : "10-day window"}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', alignItems: 'center', width: '100%' }}>
          <button
            onClick={() => setCalendarOpen(true)}
            style={{
              width: "100%",
              background: "#fff",
              border: "1px solid #111827",
              borderRadius: "999px",
              padding: "6px 14px",
              fontSize: "10px",
              fontWeight: 700,
              color: "#111827",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Calendar View
          </button>

          {/* Pill Toggle for Nearby */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #111827", borderRadius: "999px", overflow: "hidden", width: "100%" }}>
            <button 
              onClick={() => setShowNearby(false)}
              style={{
                background: !showNearby ? "#111827" : "#fff",
                color: !showNearby ? "#fff" : "#111827",
                padding: "5px 14px", fontSize: "10px", fontWeight: 700, border: "none", cursor: "pointer", textTransform: "uppercase"
              }}
            >Local</button>
            <button 
              onClick={() => setShowNearby(true)}
              style={{
                background: showNearby ? "#111827" : "#fff",
                color: showNearby ? "#fff" : "#111827",
                padding: "5px 14px", fontSize: "10px", fontWeight: 700, border: "none", cursor: "pointer", textTransform: "uppercase"
              }}
            >Nearby</button>
          </div>

          <button
            type="button"
            onClick={() => {
              closeAllModals();
              setSubmitStep("form");
              setSubmitOpen(true);
            }}
            style={{
              width: "100%",
              border: "none",
              background: "#111827",
              color: "#fff",
              borderRadius: "999px",
              padding: "5px 10px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Submit Event
          </button>
        </div>
      </div>

      {/* TOP PLACEMENT: Direction-of-Travel Nearby City Filter Bar */}
      {showNearby && nearbyCities.length > 1 && (
        <div
          style={{
            marginTop: "10px",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "8px 12px",
            background: "#f1f5f9",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", marginRight: "2px" }}>
            📍 Nearby Cities:
          </span>
          <button
            type="button"
            onClick={() => setSelectedNearbyCity(null)}
            style={{
              padding: "4px 11px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: selectedNearbyCity === null ? 800 : 600,
              background: selectedNearbyCity === null ? "#1e293b" : "#ffffff",
              color: selectedNearbyCity === null ? "#ffffff" : "#475569",
              border: selectedNearbyCity === null ? "1px solid #1e293b" : "1px solid #cbd5e1",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            All Nearby ({dbEvents.length})
          </button>
          {nearbyCities.map(({ name, count }) => {
            const isSelected = selectedNearbyCity === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedNearbyCity(isSelected ? null : name)}
                style={{
                  padding: "4px 11px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: isSelected ? 800 : 600,
                  background: isSelected ? "#2563eb" : "#ffffff",
                  color: isSelected ? "#ffffff" : "#475569",
                  border: isSelected ? "1px solid #2563eb" : "1px solid #cbd5e1",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(156px, 156px)",
          gap: "8px",
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: "3px",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
        }}
      >
        {days.map((day) => {
          const hasCategories = day.categories.length > 0;

          return (
            <div
              key={day.iso}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "13px",
                background: "#fff",
                padding: "8px",
                minHeight: "auto",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <div>
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                    {day.dayLabel}
                  </div>
                  <div style={{ fontSize: "10px", color: "#4b5563", marginTop: "2px", fontWeight: 500 }}>
                    {day.dateLabel}
                  </div>
                </div>

                {hasCategories && (
                  <div style={{ display: "grid", gap: "4px", marginBottom: "4px" }}>
                    {day.categories.slice(0, 5).map((group) => (
                      <button
                        key={`${day.iso}-${group.key}`}
                        type="button"
                        onClick={() => openDayModal(day.iso, group.key)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "7px",
                          border: "1px solid #eef2f7",
                          borderRadius: "8px",
                          padding: "4px 6px",
                          background: "#fafafa",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}>
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: categoryAccent(group.key),
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                            {getLocalizedCategoryLabel(group.key, countryCode)}
                          </span>
                        </div>
                        <span style={{ fontSize: "10px", color: "#4b5563", fontWeight: 600, flexShrink: 0 }}>
                          {group.items.length}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => openDayModal(day.iso)}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#111827",
                  borderRadius: "999px",
                  padding: "5px 9px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                View
              </button>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "8px",
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: "3px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(max-content, 1fr)",
            gap: "7px",
            minWidth: "100%",
            alignItems: "center",
          }}
        >
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                closeAllModals();
                setCategoryModalKey(category);
              }}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                borderRadius: "999px",
                padding: "6px 9px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
                whiteSpace: "nowrap",
              }}
            >
              {getLocalizedCategoryLabel(category, countryCode)}
            </button>
          ))}
        </div>
      </div>

      {/* Pop-up Overlay Container 1: Daily Events Display Layout */}
      {selectedDay ? (
        <OverlayModal
          title={`${cityName}${showNearby ? " (Nearby)" : ""} - ${selectedDay.dayLabel} · ${selectedDay.dateLabel}`}
          onClose={closeAllModals}
        >
          {showNearby && nearbyCities.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                padding: "6px 10px",
                marginBottom: "12px",
                background: "#f1f5f9",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Filter City:
              </span>
              <button
                type="button"
                onClick={() => setSelectedNearbyCity(null)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: selectedNearbyCity === null ? 800 : 500,
                  background: selectedNearbyCity === null ? "#1e293b" : "#ffffff",
                  color: selectedNearbyCity === null ? "#ffffff" : "#475569",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                All Nearby ({dbEvents.filter(e => (e.eventDate || (e as any).event_date || "").slice(0, 10) === selectedDay.iso).length})
              </button>
              {nearbyCities.map(({ name }) => {
                const count = dbEvents.filter(
                  e => (e.cityName || (e as any).city_name) === name && (e.eventDate || (e as any).event_date || "").slice(0, 10) === selectedDay.iso
                ).length;
                if (count === 0) return null;
                const isSelected = selectedNearbyCity === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedNearbyCity(isSelected ? null : name)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: isSelected ? 800 : 500,
                      background: isSelected ? "#2563eb" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#475569",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {selectedDay.categories.length ? (
            <>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                {selectedDay.categories.map((group) => {
                  const active = group.key === effectiveActiveCategory;
                  return (
                    <button
                      key={`${selectedDay.iso}-${group.key}`}
                      type="button"
                      onClick={() => {
                        setActiveDayCategory(group.key);
                        setOpenEventId(null);
                      }}
                      style={{
                        border: active ? `1px solid ${categoryAccent(group.key)}` : "1px solid #d1d5db",
                        background: active ? "#f8fafc" : "#fff",
                        color: "#111827",
                        borderRadius: "999px",
                        padding: "6px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {getLocalizedCategoryLabel(group.key, countryCode)} ({group.items.length})
                    </button>
                  );
                })}
              </div>

              {selectedDayItems.length ? (
                <div style={{ display: "grid", gap: "8px" }}>
                  {selectedDayItems.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => setOpenEventId(event.id)}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ border: "1px dashed #d1d5db", borderRadius: "12px", padding: "12px", fontSize: "12px", color: "#4b5563", background: "#fafafa", fontWeight: 500 }}>
                  No verified events located for this category on this day.
                </div>
              )}
            </>
          ) : (
              <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "12px", padding: "16px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                <span>
                  Quiet day in {cityName}. Try <button onClick={() => { setOpenEventId(null); setDayModalIso(null); setShowNearby(true); }} style={{fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0, textDecoration: 'underline'}}>nearby</button> or <button onClick={() => { setOpenEventId(null); setDayModalIso(null); setCalendarOpen(true); }} style={{fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0, textDecoration: 'underline'}}>explore</button> the calendar for {cityName}.
                </span>
              </div>
          )}
        </OverlayModal>
      ) : null}

      {/* Pop-up Overlay Container 2: 365-Day Extended Calendar Browser */}
      {calendarOpen && (
        <OverlayModal 
          title={`Extended Calendar View - ${showNearby ? "Nearby " : ""}${cityName}`} 
          onClose={closeAllModals}
          headerAction={
            <div style={{ display: "flex", border: "1px solid #111827", borderRadius: "999px", overflow: "hidden" }}>
              <button 
                onClick={() => setShowNearby(false)}
                style={{
                  background: !showNearby ? "#111827" : "#fff",
                  color: !showNearby ? "#fff" : "#111827",
                  padding: "4px 12px", fontSize: "9px", fontWeight: 700, border: "none", cursor: "pointer", textTransform: "uppercase"
                }}
              >Local</button>
              <button 
                onClick={() => setShowNearby(true)}
                style={{
                  background: showNearby ? "#111827" : "#fff",
                  color: showNearby ? "#fff" : "#111827",
                  padding: "4px 12px", fontSize: "9px", fontWeight: 700, border: "none", cursor: "pointer", textTransform: "uppercase"
                }}
              >Nearby</button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {Array.from(new Set(monthDays.map((day) => day.month))).map((month) => {
              const monthItems = monthDays.filter((day) => day.month === month);
              const firstDayDate = new Date(monthItems[0].iso + "T12:00:00");
              const startOffset = firstDayDate.getDay();

              return (
                <div key={month}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
                    {month}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px", marginBottom: "4px", textAlign: "center", fontSize: "10px", fontWeight: 800, color: "#6b7280", textTransform: "uppercase" }}>
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px" }}>
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {monthItems.map((day) => {
                      const isToday = day.iso === makeIso(new Date());
                      const hasEvent = dbEvents.some((e) => (e.eventDate || (e as any).event_date || "").startsWith(day.iso));
                      return (
                        <button
                          key={day.iso}
                          type="button"
                          onClick={() => {
                            if (hasEvent) {
                              setOpenEventId(null);
                              setDayModalIso(day.iso);
                              setCalendarOpen(false);
                            }
                          }}
                          style={{
                            border: isToday ? "2px solid #111827" : hasEvent ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                            background: isToday ? "#f3f4f6" : hasEvent ? "#3b82f6" : "#ffffff",
                            color: isToday ? "#111827" : hasEvent ? "#ffffff" : "#9ca3af",
                            borderRadius: "10px",
                            padding: "6px 2px",
                            fontSize: "10px",
                            fontWeight: isToday ? 900 : hasEvent ? 800 : 500,
                            cursor: hasEvent ? "pointer" : "default",
                          }}
                        >
                          {day.label.replace(/^[a-zA-Z]{3} /, "")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </OverlayModal>
      )}

      {/* Pop-up Overlay Container 3: Vertical Category Filter List */}
      {categoryModalKey ? (
        <OverlayModal
          title={`${cityName} - Verified ${getLocalizedCategoryLabel(categoryModalKey, countryCode)} Events`}
          onClose={closeAllModals}
        >
          {showNearby && nearbyCities.length > 1 && (
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                paddingBottom: "8px",
                marginBottom: "12px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedNearbyCity(null)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: selectedNearbyCity === null ? 800 : 600,
                  background: selectedNearbyCity === null ? "#1e293b" : "#f1f5f9",
                  color: selectedNearbyCity === null ? "#fff" : "#475569",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                All Nearby ({dbEvents.filter(e => normalizeCategories(e.category).includes(categoryModalKey)).length})
              </button>
              {nearbyCities.map(({ name }) => {
                const count = dbEvents.filter(
                  e => (e.cityName || (e as any).city_name) === name && normalizeCategories(e.category).includes(categoryModalKey)
                ).length;
                if (count === 0) return null;
                const isSelected = selectedNearbyCity === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedNearbyCity(isSelected ? null : name)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: isSelected ? 800 : 600,
                      background: isSelected ? "#2563eb" : "#f1f5f9",
                      color: isSelected ? "#fff" : "#475569",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name} ({count})
                  </button>
                );
              })}
            </div>
          )}
          {categoryEvents.length ? (
            <div style={{ display: "grid", gap: "8px" }}>
              {categoryEvents.map((event) => (
                <EventCard
                  key={`${categoryModalKey}-${event.id}`}
                  event={event}
                  onClick={() => setOpenEventId(event.id)}
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px dashed #d1d5db", borderRadius: "12px", padding: "12px", fontSize: "12px", color: "#4b5563", background: "#fafafa", fontWeight: 500 }}>
              No verified upcoming events located in this category right now.
            </div>
          )}
        </OverlayModal>
      ) : null}

      {/* Pop-up Overlay Container 4: Event Details Modal */}
      {openEventId && (() => {
        let ev: any = allEvents.find(e => String(e.id) === String(openEventId));
        if (!ev) {
          const rawEv = dbEvents.find(e => String(e.id) === String(openEventId));
          if (rawEv) {
            ev = { id: rawEv.id, title: rawEv.title, source: rawEv.source, time: rawEv.startTime, venue: rawEv.venue, categories: normalizeCategories(rawEv.category), details: rawEv.details, affiliateUrl: rawEv.affiliateUrl, venue_address: rawEv.venue_address, hosting_entity: rawEv.hosting_entity, contact_email: rawEv.contact_email, contact_phone: rawEv.contact_phone, official_info_url: rawEv.official_info_url, social_urls: rawEv.social_urls, registration_url: rawEv.registration_url, event_flyer_url: rawEv.event_flyer_url, eventDate: rawEv.eventDate, cityName: rawEv.cityName } as EventItem;
          }
        }
        if (!ev) return null;
        return <InlineEventModal ev={ev} cityName={cityName} onClose={() => setOpenEventId(null)} setIframeUrl={setIframeUrl} />;
      })()}

      {/* Pop-up Overlay Container 5: Form Entry Module */}
      {submitOpen ? (
        <OverlayModal
          title={submitStep === "form" ? `Submit an Event: ${citySegment}${stateSegment ? ', ' + stateSegment : ''} • ${countryCode}` : "Thank You!"}
          onClose={closeAllModals}
        >
          {submitStep === "form" ? (
            <form 
              onSubmit={(e) => handleFormSubmit(e, false)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              style={{ display: "grid", gap: "16px" }}
            >
              {formMessage && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: formMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
                    color: formMessage.type === "success" ? "#065f46" : "#991b1b",
                    border: formMessage.type === "success" ? "1px solid #a7f3d0" : "1px solid #fca5a5",
                  }}
                >
                  {formMessage.text}
                </div>
              )}

              {/* Logistical Nodes Section */}
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: "12px", fontWeight: "900", color: "#1e293b", textTransform: "uppercase", marginBottom: "12px" }}>Event Details & Location</h3>
                <div style={{ display: "grid", gap: "12px" }}>
                  {/* Title and Category on same line */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Event Title *</label>
                      <input
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder=""
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>

                    {/* Multi-Select Category Dropdown */}
                    <div style={{ display: "grid", gap: "4px", position: "relative" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Event Categories (Select multiple) *</label>
                      <div 
                        onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", background: "#fff", fontSize: "12px", color: "#111827", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {formCategories.join(", ")}
                      </span>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>▼</span>
                    </div>
                    
                    {isCategoryOpen && (
                      <>
                        {/* Invisible backdrop to click away */}
                        <div 
                          style={{ position: "fixed", inset: 0, zIndex: 40 }} 
                          onClick={(e) => { e.stopPropagation(); setIsCategoryOpen(false); }}
                        />
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", background: "#fff", border: "2px solid #111827", borderRadius: "10px", maxHeight: "250px", overflowY: "auto", zIndex: 50, boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" }}>
                          {CATEGORY_ORDER.map((cat) => (
                            <label key={cat} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: formCategories.includes(cat) ? "#f8fafc" : "#fff", transition: "all 0.1s" }} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                style={{ width: "16px", height: "16px", accentColor: "#2563eb", cursor: "pointer" }}
                                checked={formCategories.includes(cat)} 
                                onChange={(e) => {
                                  if (e.target.checked) setFormCategories(prev => [...prev.filter(c => c !== "Other"), cat]);
                                  else setFormCategories(prev => prev.filter(c => c !== cat).length ? prev.filter(c => c !== cat) : ["Other"]);
                                }}
                              />
                              <span style={{ fontSize: "13px", fontWeight: formCategories.includes(cat) ? 700 : 500, color: formCategories.includes(cat) ? "#0f172a" : "#4b5563" }}>{getLocalizedCategoryLabel(cat, countryCode)}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Venue Name *</label>
                      <input
                        type="text"
                        required
                        value={formVenueName}
                        onChange={(e) => setFormVenueName(e.target.value)}
                        placeholder=""
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Venue Address *</label>
                      <input
                        type="text"
                        required
                        value={formVenueAddress}
                        onChange={(e) => setFormVenueAddress(e.target.value)}
                        placeholder=""
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>City *</label>
                      <input
                        type="text"
                        required
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>State / Region *</label>
                      <input
                        type="text"
                        required
                        value={formState}
                        onChange={(e) => setFormState(e.target.value)}
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Event Date(s) *</label>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        {formDates.map((date, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#1e293b", color: "#fff", padding: "4px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600 }}>
                            {date}
                            <button type="button" onClick={() => setFormDates(prev => prev.filter((_, i) => i !== idx))} style={{ color: "#f87171", fontWeight: "bold", background: "none", border: "none", cursor: "pointer" }}>×</button>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <input
                            type="date"
                            value={currentDateInput}
                            onChange={(e) => setCurrentDateInput(e.target.value)}
                            style={{ width: "130px", padding: "6px", borderRadius: "10px", border: "2px solid #111827", fontSize: "11px", color: "#111827" }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (currentDateInput && !formDates.includes(currentDateInput)) {
                                setFormDates(prev => [...prev, currentDateInput].sort());
                              }
                              setCurrentDateInput("");
                            }}
                            style={{ padding: "6px 12px", background: "#111827", color: "#fff", borderRadius: "10px", fontSize: "10px", fontWeight: "bold", border: "none", cursor: "pointer", textTransform: "uppercase" }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Start Time</label>
                      <input
                        type="text"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        placeholder=""
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "4px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Event Description</label>
                    <textarea
                      rows={3}
                      value={formDetails}
                      onChange={(e) => setFormDetails(e.target.value)}
                      placeholder="Tell visitors about your event, activities, performers, vendors, schedule, or special attractions."
                      className="placeholder-gray-400"
                      style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", resize: "none", color: "#111827" }}
                    />
                  </div>

                  {/* Drag and Drop Image Upload Placeholder UI */}
                  <div style={{ display: "grid", gap: "4px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Upload Event Flyer</label>
                    <label
                      htmlFor="flyer-upload"
                      tabIndex={0}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith("image/")) {
                          setFormImage(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setFormFlyerBase64(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      onPaste={(e) => {
                        const file = e.clipboardData.files?.[0];
                        if (file && file.type.startsWith("image/")) {
                          setFormImage(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setFormFlyerBase64(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{
                        border: "2px dashed #cbd5e1",
                        borderRadius: "8px",
                        padding: "20px",
                        textAlign: "center",
                        background: "#f1f5f9",
                        cursor: "pointer",
                        display: "block"
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "#475569", fontWeight: 600 }}>Drag & Drop, Paste, or Click to Upload Flyer</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        id="flyer-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormImage(file);
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64data = reader.result as string;
                              setFormFlyerBase64(base64data);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {formImage && (
                        <div style={{ marginTop: "8px", fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                          Ready to upload: {formImage.name}
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Monetization & Asset Linking Section */}
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: "12px", fontWeight: "900", color: "#1e293b", textTransform: "uppercase", marginBottom: "12px" }}>Additional Information</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div style={{ display: "grid", gap: "4px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Website or Information Link</label>
                    <input
                      type="url"
                      value={formInfoUrl}
                      onChange={(e) => setFormInfoUrl(e.target.value)}
                      placeholder="https://"
                      style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                    />
                  </div>
                  <div style={{ display: "grid", gap: "4px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Social Media Links (Optional)</label>
                    <input
                      type="text"
                      value={formSocialUrls}
                      onChange={(e) => setFormSocialUrls(e.target.value)}
                      placeholder="Paste Facebook, Instagram, YouTube, etc. links here..."
                      style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                    />
                  </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Ticket Link (Optional)</label>
                      <input
                        type="url"
                        value={formTicketUrl}
                        onChange={(e) => setFormTicketUrl(e.target.value)}
                        placeholder=""
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Vendor Registration Link (Optional)</label>
                      <input
                        type="url"
                        value={formVendorUrl}
                        onChange={(e) => setFormVendorUrl(e.target.value)}
                        placeholder=""
                        className="placeholder-gray-400"
                        style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "4px", marginTop: "12px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Event Flyer URL (Optional)</label>
                    <input
                      type="url"
                      value={formFlyerUrl}
                      onChange={(e) => setFormFlyerUrl(e.target.value)}
                      placeholder="https://"
                      style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                    />
                </div>
              </div>

              {/* Public Event Contact Section */}
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: "12px", fontWeight: "900", color: "#1e293b", textTransform: "uppercase", marginBottom: "12px" }}>Official Event Contact (Public)</h3>
                <div style={{ display: "grid", gap: "4px", marginBottom: "12px" }}>
                  <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Sponsor / Host (Optional)</label>
                  <input
                    type="text"
                    value={formHostingEntity}
                    onChange={(e) => setFormHostingEntity(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "grid", gap: "4px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Event Email (Optional)</label>
                    <input
                      type="email"
                      value={formContactEmail}
                      onChange={(e) => setFormContactEmail(e.target.value)}
                      placeholder=""
                      className="placeholder-gray-400"
                      style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                    />
                  </div>
                  <div style={{ display: "grid", gap: "4px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Event Phone (Optional)</label>
                    <input
                      type="tel"
                      value={formContactPhone}
                      onChange={(e) => setFormContactPhone(e.target.value)}
                      placeholder=""
                      className="placeholder-gray-400"
                      style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                    />
                  </div>
                </div>
              </div>

              {/* IDENTIFICATION SEGMENT (Moved to bottom) */}
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontSize: "12px", fontWeight: "900", color: "#1e293b", textTransform: "uppercase", marginBottom: "12px" }}>Submitter Information (Private)</h3>
                
                <div style={{ display: "grid", gap: "12px", marginBottom: "12px" }}>
                  <div style={{ display: "grid", gap: "4px", maxWidth: "200px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Contributor Age Range *</label>
                    <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827", fontWeight: 700, cursor: "pointer", background: "#fff" }}>
                      <option value="18+">18 or older</option>
                      <option value="13-17">13 - 17</option>
                      <option value="Under 13">Under 13</option>
                    </select>
                  </div>
                </div>

                {ageRange === "Under 13" ? (
                  <div style={{ background: "#fef2f2", border: "2px solid #111827", padding: "16px", borderRadius: "10px", marginBottom: "12px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#111827", marginBottom: "12px" }}>⚠️ COPPA Restriction: You must have a parent/guardian submit this information, or provide an authorized Teacher/Organization code.</p>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Teacher / Organization Code *</label>
                      <input type="text" required style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827", fontWeight: 600 }} placeholder="Enter school or club code" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div style={{ display: "grid", gap: "4px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Your Name *</label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                        />
                      </div>
                      <div style={{ display: "grid", gap: "4px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Your Email *</label>
                        <input
                          type="email"
                          required
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div style={{ display: "grid", gap: "4px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Organization / Group (Optional)</label>
                        <input
                          type="text"
                          value={formOrg}
                          onChange={(e) => setFormOrg(e.target.value)}
                          style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                        />
                      </div>
                      <div style={{ display: "grid", gap: "4px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Your Phone (Optional)</label>
                        <input
                          type="tel"
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {ageRange === "13-17" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f1f5f9", border: "2px solid #111827", padding: "16px", borderRadius: "10px" }}>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Parent/Guardian Name *</label>
                      <input type="text" required style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }} />
                    </div>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase" }}>Parent/Guardian Email *</label>
                      <input type="email" required style={{ width: "100%", padding: "8px", borderRadius: "10px", border: "2px solid #111827", fontSize: "12px", color: "#111827" }} />
                    </div>
                  </div>
                )}
              </div>

              {/* The Submit Buttons Block */}
              {ageRange !== "Under 13" && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <input name="legalAgreed" type="checkbox" required id="legal-check-event" style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer', accentColor: '#0f172a' }} />
                  <label htmlFor="legal-check-event" style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5, cursor: 'pointer' }}>
                    I certify that I am at least 13 years of age (and if under 18, have parental/guardian permission) and agree to the <button type="button" onClick={() => window.open('/terms', '_blank')} style={{ color: '#0f172a', fontWeight: 800, textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Submission Terms and Privacy Policy</button>. I grant permission for submitted content to be reviewed, edited, used, shared, or published across our network or partner projects.
                  </label>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={formSending}
                  style={{
                    width: "100%",
                    background: "#111827",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: formSending ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {formSending ? "Transmitting..." : "Submit Event"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleFormSubmit(e, true)}
                  disabled={formSending}
                  style={{
                    width: "100%",
                    background: "#111827",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: formSending ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {formSending ? "Transmitting..." : "Submit & Add Another"}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <h2 style={{ fontSize: "24px", fontWeight: 900, color: "#111827", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Thank You!
              </h2>
              <p style={{ fontSize: "14px", color: "#475569", maxWidth: "400px", margin: "0 auto", lineHeight: "1.6" }}>
                Your submission has been received.<br />
                If additional information is needed, we may contact you using the information provided.
              </p>
            </div>
          )}
        </OverlayModal>
      ) : null}

      {/* Pop-up Overlay Container 5: Secure Iframe Viewer */}
      {iframeUrl ? (
        (() => {
          let ev: any = allEvents.find(e => String(e.id) === String(openEventId));
          if (!ev) {
            const rawEv = dbEvents.find(e => String(e.id) === String(openEventId));
            if (rawEv) {
              ev = { id: rawEv.id, title: rawEv.title, source: rawEv.source, time: rawEv.startTime, venue: rawEv.venue, categories: normalizeCategories(rawEv.category), details: rawEv.details, affiliateUrl: rawEv.affiliateUrl, venue_address: rawEv.venue_address, hosting_entity: rawEv.hosting_entity, contact_email: rawEv.contact_email, contact_phone: rawEv.contact_phone, official_info_url: rawEv.official_info_url, social_urls: rawEv.social_urls, registration_url: rawEv.registration_url, event_flyer_url: rawEv.event_flyer_url, eventDate: rawEv.eventDate, cityName: rawEv.cityName } as EventItem;
            }
          }
          const eventFooterActions = ev ? (
            <>
              {ev.affiliateUrl && iframeUrl !== ev.affiliateUrl ? (
                <button
                  type="button"
                  onClick={() => setIframeUrl(ev.affiliateUrl!)}
                  style={{ background: "#4f46e5", color: "white", padding: "9px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", cursor: "pointer", textTransform: "uppercase" }}
                >
                  Tickets
                </button>
              ) : ev.affiliateUrl ? (
                <button type="button" disabled style={{ background: "#e5e7eb", color: "#9ca3af", padding: "9px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", textTransform: "uppercase" }}>Tickets</button>
              ) : null}

              {ev.registration_url && iframeUrl !== ev.registration_url ? (
                <button
                  type="button"
                  onClick={() => setIframeUrl(ev.registration_url!)}
                  style={{ background: "#059669", color: "white", padding: "9px 16px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", cursor: "pointer", textTransform: "uppercase" }}
                >
                  Register
                </button>
              ) : ev.registration_url ? (
                <button type="button" disabled style={{ background: "#e5e7eb", color: "#9ca3af", padding: "9px 16px", borderRadius: "999px", fontWeight: 700, fontSize: "11px", border: "none", textTransform: "uppercase" }}>Register</button>
              ) : null}


              <ShareButton 
                title={ev.title} 
                text={`Check out ${ev.title} in ${cityName}!`} 
                url={`https://livetimedata.com/events/${ev.id}`} 
              />
              <AddToCalendarButton 
                event={{
                  title: ev.title,
                  details: ev.details,
                  venue: ev.venue || '',
                  eventDate: ev.eventDate || (ev as any).event_date || '',
                  startTime: ev.time || (ev as any).start_time || '',
                  cityName: ev.cityName || ''
                }} 
              />
            </>
          ) : null;

          const displayDate = ev ? new Date(ev.eventDate || Date.now()).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
          const subtitle = ev ? `${displayDate} · ${ev.time || (ev as any).start_time || "Time TBA"} · ${ev.venue}${ev.cityName ? `, ${ev.cityName}` : ''}` : undefined;

          return (
            <OverlayModal
              title={ev ? `${ev.cityName || cityName} - ${ev.title}` : `${cityName} - External Portal`}
              subtitle={subtitle}
              onClose={() => setIframeUrl(null)}
              footerActions={eventFooterActions}
              noScroll={true}
              noPadding={true}
            >
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <iframe
                  src={
                    iframeUrl.includes("output=embed") || iframeUrl.startsWith("/")
                      ? (iframeUrl.startsWith("http") || iframeUrl.startsWith("/") ? iframeUrl : `https://${iframeUrl}`)
                      : `/api/proxy?url=${encodeURIComponent(iframeUrl.startsWith("http") ? iframeUrl : `https://${iframeUrl}`)}`
                  }
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  style={{ width: "100%", height: "100%", minHeight: "65vh", border: "none", borderRadius: "8px" }}
                  onError={() => {
                    fetch("/api/alerts/iframe-failure", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ eventId: openEventId || "unknown", failedUrl: iframeUrl }),
                    }).catch(() => {}); // silent catch
                  }}
                />
              </div>
            </OverlayModal>
          );
        })()
      ) : null}
    </section>
  );
} 
