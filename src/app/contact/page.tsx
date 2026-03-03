// src/app/contact/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ContactPage() {
  const router = useRouter();
  const [fallbackHref, setFallbackHref] = useState("/city-dashboard");

  // Remember the page the user came from (so “Back to site” returns correctly)
  useEffect(() => {
    try {
      const ref = document.referrer || "";
      if (ref) {
        const u = new URL(ref);
        // only keep same-site referrers
        if (u.host === window.location.host) {
          setFallbackHref(u.pathname + u.search + u.hash);
        }
      }
    } catch {}
  }, []);

  function close() {
    // Prefer history back (returns to current city page)
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref || "/city-dashboard");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      {/* click outside closes */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={close}
      />

      <div className="relative mx-auto mt-10 w-[min(900px,calc(100%-24px))] rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="text-lg font-semibold">Contact</div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="text-gray-700">
            For questions, feedback, corrections, or business inquiries, email us:
          </p>

          <div className="mt-4 rounded-xl border bg-gray-50 p-4">
            <a
              href="mailto:LiveTimeData@gmail.com"
              className="text-blue-600 underline"
            >
              LiveTimeData@gmail.com
            </a>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            We aim to respond within 1–2 business days.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back to site
          </button>
        </div>
      </div>
    </div>
  );
}