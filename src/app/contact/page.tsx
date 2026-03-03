// src/app/contact/page.tsx
import CloseLegalButton from "../components/CloseLegalButton";
import BackToPrevious from "../components/BackToPrevious";

export const metadata = {
  title: "Contact — LiveTimeData",
  description: "Contact LiveTimeData for questions, feedback, corrections, or business inquiries.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black/30 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="text-lg font-semibold">Contact</div>
          <CloseLegalButton />
        </div>

        <div className="px-6 py-6">
          <p className="text-sm text-gray-700">
            For questions, feedback, corrections, or business inquiries, email us:
          </p>

          <div className="mt-4 rounded-xl border bg-white p-4">
            <a
              className="text-blue-600 underline"
              href="mailto:LiveTimeData@gmail.com"
            >
              LiveTimeData@gmail.com
            </a>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            We aim to respond within 1–2 business days.
          </p>

          <div className="mt-8">
            <BackToPrevious />
          </div>
        </div>
      </div>
    </main>
  );
}