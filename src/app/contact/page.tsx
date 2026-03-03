// src/app/contact/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | LiveTimeData",
  description: "Contact LiveTimeData for questions, support, or business inquiries.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold mb-6">Contact</h1>

      <p className="mb-4 text-gray-700">
        For questions, feedback, corrections, or business inquiries, email us:
      </p>

      <p className="mb-8 text-lg font-medium">
        <a href="mailto:LiveTimeData@gmail.com" className="text-blue-600 underline">
          LiveTimeData@gmail.com
        </a>
      </p>

      <p className="text-sm text-gray-500">We aim to respond within 1–2 business days.</p>
    </main>
  );
}