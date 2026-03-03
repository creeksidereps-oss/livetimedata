import Link from "next/link";
import CloseLegalButton from "../components/CloseLegalButton";
import BackToPrevious from "../components/BackToPrevious";

export const metadata = {
  title: "Contact | LiveTimeData",
  description: "Contact LiveTimeData for questions, feedback, corrections, or business inquiries.",
};

export default function ContactPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="text-lg font-semibold">Contact</div>
          <CloseLegalButton />
        </div>

        <div className="px-6 py-6">
          <p className="text-sm text-gray-700">
            For questions, feedback, corrections, or business inquiries, email us:
          </p>

          <div className="mt-4 rounded-xl border bg-white p-4">
            <Link
              href="mailto:LiveTimeData@gmail.com"
              className="text-sm font-semibold text-blue-700 underline"
            >
              LiveTimeData@gmail.com
            </Link>
          </div>

          <p className="mt-3 text-xs text-gray-500">We aim to respond within 1–2 business days.</p>

          <div className="mt-6">
            <BackToPrevious label="Back to site" />
          </div>

          <p className="mt-3 text-xs text-gray-500">
            If back doesn’t work (opened in a new tab), go to{" "}
            <Link href="/city-dashboard" className="underline">
              /city-dashboard
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}