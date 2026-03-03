// src/app/privacy/page.tsx
import Link from "next/link";
import BackToPrevious from "../components/BackToPrevious";

export const metadata = {
  title: "Privacy Policy | LiveTimeData",
  description: "Privacy Policy for LiveTimeData.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-10 text-gray-900">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
          <BackToPrevious label="✕" />
        </div>

        <div className="px-6 py-6 text-sm text-gray-700 space-y-4">
          <p>LiveTimeData provides time and weather information based on user searches.</p>

          <h2 className="pt-2 text-base font-semibold">Advertising</h2>
          <p>
            We may display advertisements provided by third-party ad networks such as Google AdSense.
            These providers may use cookies to personalize ads.
          </p>

          <h2 className="pt-2 text-base font-semibold">Analytics</h2>
          <p>We may use analytics tools to understand website usage and improve performance.</p>

          <h2 className="pt-2 text-base font-semibold">Contact</h2>
          <p>For questions about this policy, contact support@livetimedata.com</p>

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