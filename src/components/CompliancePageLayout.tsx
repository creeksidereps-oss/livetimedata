"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/config/adSlots";

interface CompliancePageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function CompliancePageLayout({ title, children }: CompliancePageLayoutProps) {
  const handleExit = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 bg-black min-h-screen text-slate-300">
      {/* Top Navigation Row: Back Link on Left, 'X' Pill on Right */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} className="mr-2" />
          Back to Home
        </Link>

        {/* Exit Pill in Top Right */}
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all shadow-sm cursor-pointer"
          title="Close and return"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Reserved Top Ad Placement for Post-Approval */}
      <AdSlot slot={AD_SLOTS.FOOTER_PAGE_TOP} />

      <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
        {title}
      </h1>

      <div className="mt-8 space-y-5 text-[12px] md:text-[13px] leading-relaxed">
        {children}
      </div>

      {/* Reserved Bottom Ad Placement for Post-Approval */}
      <AdSlot slot={AD_SLOTS.FOOTER_PAGE_BOTTOM} />

      {/* Bottom Exit Strategy: Return to Page on the Right */}
      <div className="mt-12 pt-6 border-t border-white/10 flex justify-end">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft size={14} />
          Return to Page
        </button>
      </div>
    </div>
  );
}
