// src/app/components/BackToPrevious.tsx
"use client";

import { useRouter } from "next/navigation";

export default function BackToPrevious({ label }: { label: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-block rounded-xl bg-black px-4 py-2 text-white"
    >
      {label}
    </button>
  );
}