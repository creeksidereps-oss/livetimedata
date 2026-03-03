// src/app/components/CloseLegalButton.tsx
"use client";

import { useRouter } from "next/navigation";

export default function CloseLegalButton() {
  const router = useRouter();

  function close() {
    // Prefer going back to the exact page the user came from
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    // Fallback: go to the real app home (dashboard)
    router.push("/city-dashboard");
  }

  return (
    <button
      type="button"
      onClick={close}
      className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
      aria-label="Close"
      title="Close"
    >
      ✕
    </button>
  );
}