// src/app/page.tsx
import Link from "next/link";
import CityDashboardClient from "./city-dashboard/ui";
import { TOP_CITIES, cityLabel, cityParams } from "@/lib/topCities";

type SP = { [key: string]: string | string[] | undefined };

function num(v: unknown, fallback: number) {
  const n = typeof v === "string" ? Number(v) : Array.isArray(v) ? Number(v[0]) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export default function Home({ searchParams }: { searchParams?: SP }) {
  // Simple pagination for crawlable links without dumping 10k on one page
  const page = Math.max(1, num(searchParams?.page, 1));
  const perPage = 200; // good balance for UX + crawlability
  const total = TOP_CITIES.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const slice = TOP_CITIES.slice(start, start + perPage);

  const prevHref = safePage > 1 ? `/?page=${safePage - 1}` : null;
  const nextHref = safePage < totalPages ? `/?page=${safePage + 1}` : null;

  return (
    <main className="min-h-screen bg-[#f6f6f6] text-gray-900 overflow-x-hidden">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        {/* Keep your existing working search + dashboard client */}
        <CityDashboardClient initialQuery="" />

        {/* Browse section (server-rendered, crawlable) */}
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-700">Browse cities</div>
              <div className="mt-1 text-xs text-gray-500">
                Showing {start + 1}-{Math.min(start + perPage, total)} of {total} cities • Page {safePage} of {totalPages}
              </div>
            </div>

            <div className="flex gap-2">
              {prevHref ? (
                <Link className="rounded-xl border px-3 py-2 text-xs hover:bg-gray-50" href={prevHref}>
                  ← Prev
                </Link>
              ) : (
                <span className="rounded-xl border px-3 py-2 text-xs text-gray-400">← Prev</span>
              )}
              {nextHref ? (
                <Link className="rounded-xl border px-3 py-2 text-xs hover:bg-gray-50" href={nextHref}>
                  Next →
                </Link>
              ) : (
                <span className="rounded-xl border px-3 py-2 text-xs text-gray-400">Next →</span>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {slice.map((c) => {
              const params = cityParams(c);
              return (
                <div key={c.slug} className="rounded-xl border bg-white px-4 py-3">
                  <div className="font-semibold">{c.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{cityLabel(c)}</div>

                  <div className="mt-3 flex gap-2">
                    <Link href={`/time/${c.slug}?${params}`} className="rounded-lg border px-3 py-1 text-xs hover:bg-gray-50">
                      Time
                    </Link>
                    <Link href={`/weather/${c.slug}?${params}`} className="rounded-lg border px-3 py-1 text-xs hover:bg-gray-50">
                      Weather
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-between">
            {prevHref ? (
              <Link className="rounded-xl border px-3 py-2 text-xs hover:bg-gray-50" href={prevHref}>
                ← Prev
              </Link>
            ) : (
              <span />
            )}
            {nextHref ? (
              <Link className="rounded-xl border px-3 py-2 text-xs hover:bg-gray-50" href={nextHref}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}