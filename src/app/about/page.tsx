// src/app/about/page.tsx
import CloseLegalButton from "../components/CloseLegalButton";
import BackToPrevious from "../components/BackToPrevious";

export const metadata = {
  title: "About | LiveTimeData",
  description: "Learn about the LiveTimeData project and its mission.",
};

export default function AboutPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="text-lg font-semibold">About LiveTimeData</div>
          <CloseLegalButton />
        </div>

        <div className="px-6 py-6 space-y-4 text-sm text-gray-700">
          <p>
            LiveTimeData is a simple global utility designed to help people quickly
            find the current time, local weather, and nearby live cameras for cities
            around the world.
          </p>

          <p>
            Many travelers, remote workers, and international teams need to check
            time differences between cities. LiveTimeData makes this easy by
            combining time information with local weather and visual context.
          </p>

          <p>
            Our goal is to provide a fast, easy-to-use tool that works anywhere and
            helps users quickly understand what’s happening in another part of the
            world.
          </p>

          <p>
            The site is continuously improving as new features and data sources are
            added.
          </p>

          <div className="pt-4">
            <BackToPrevious label="Back to site" />
          </div>
        </div>
      </div>
    </div>
  );
}