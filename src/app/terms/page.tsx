// src/app/terms/page.tsx
import Link from "next/link";
import BackToPrevious from "../components/BackToPrevious";

export const metadata = {
  title: "Terms of Service | LiveTimeData",
  description: "Terms of Service for LiveTimeData.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-10 text-gray-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h1 className="text-lg font-semibold">Terms of Service</h1>
          <BackToPrevious label="✕" />
        </div>

        <div className="px-6 py-6 text-sm text-gray-700 space-y-4">
          <p>LiveTimeData provides time and weather data for informational purposes only.</p>
          <p>We do not guarantee accuracy of third-party data sources.</p>
          <p>By using this website, you agree to these terms.</p>

          <div className="pt-4">
            <BackToPrevious label="Back to site" />
            <div className="mt-3 text-xs text-gray-500">
              If back doesn’t work (opened in a new tab), go to{" "}
              <Link className="underline" href="/city-dashboard">
                /city-dashboard
              </Link>
              .
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}