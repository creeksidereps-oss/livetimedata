"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function ShareButton({ title, text, url, className, style }: { title: string, text: string, url: string, className?: string, style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      className={className || "flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full transition-colors shadow-lg"}
      style={style}
    >
      {copied ? <Check size={18} /> : <Share2 size={18} />}
      {copied ? "Link Copied!" : "Share Event"}
    </button>
  );
}
