import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 bg-black min-h-screen text-slate-300">
      <Link href="/" className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors mb-8">
        <ArrowLeft size={14} className="mr-2" />
        Back to Home
      </Link>
      
      <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">About LiveTimeData</h1>
      
      <div className="mt-8 space-y-5 text-[12px] md:text-[13px] leading-relaxed">
        <p>LiveTimeData is a global city information and discovery website designed to make useful local information easier to find in one place.</p>
        <p>Our goal is simple: help people quickly explore cities and communities through information such as local time, weather, forecasts, events, webcams, photographs, maps, local facts, attractions, and other useful city information.</p>
        <p>LiveTimeData is continually expanding and improving its coverage. Information may come from a combination of public information, third-party data sources, community contributions, research, automated systems, artificial intelligence, and editorial work.</p>
        <p>Some information may initially be generated or compiled with automated or AI-assisted tools and may later be corrected, expanded, replaced, or improved using additional research and human-contributed information.</p>
        <p>We welcome contributions from people who know their communities. Visitors, organizations, event organizers, photographers, webcam owners and operators, businesses, educators, and community members may be able to submit information, photographs, events, corrections, suggestions, and other useful material for consideration.</p>
        <p>Submitting information does not guarantee publication, and LiveTimeData may edit, combine, summarize, verify, update, or decline material in accordance with our Terms of Service.</p>
        <p>Because cities and local information constantly change, LiveTimeData cannot guarantee that every piece of information is complete or current. Important information should always be confirmed with the appropriate official source, business, venue, organizer, or other authority.</p>
        <p>LiveTimeData is independently operated from North Carolina, United States.</p>
        <p>For questions, suggestions, corrections, partnerships, advertising inquiries, or other matters, please visit our Contact page or email:</p>
        <p className="font-bold text-white">LiveTimeData@gmail.com</p>
        <p>Mail:</p>
        <p className="font-bold text-white">LiveTimeData<br />P.O. Box 5272<br />Statesville, NC 28687<br />United States</p>
      </div>
    </div>
  );
}
