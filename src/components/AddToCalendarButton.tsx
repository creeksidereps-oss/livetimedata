"use client";

import React from 'react';

interface AddToCalendarProps {
  event?: {
    title: string;
    startTime: string;
    eventDate: string;
    venue: string;
    details: string;
    cityName?: string;
  };
  title?: string;
  startTime?: string;
  eventDate?: string;
  venue?: string;
  details?: string;
  cityName?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function AddToCalendarButton(props: AddToCalendarProps) {
  const t = props.event?.title || props.title || "Event";
  const st = props.event?.startTime || props.startTime || "";
  const ed = props.event?.eventDate || props.eventDate || new Date().toISOString().slice(0, 10);
  const v = props.event?.venue || props.venue || "";
  const d = props.event?.details || props.details || "";

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Convert date/time to ICS format (simple approach)
    // Note: A robust implementation would parse time properly into UTC.
    // For now, we generate a simple full-day or string-matched time.
    const cleanDate = ed.replace(/-/g, '');
    
    const icsString = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${t}
DTSTART;VALUE=DATE:${cleanDate}
LOCATION:${v}
DESCRIPTION:${d.replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsString], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className={props.className || "bg-[#111827] text-white hover:bg-blue-600 transition-colors rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest shrink-0"}
      style={props.style}
      title="Add to Calendar"
    >
      Add to Calendar
    </button>
  );
}
