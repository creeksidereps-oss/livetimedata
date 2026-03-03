// src/app/city-dashboard/ui.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import ClockCard from "../../components/ClockCard";
import { popularCities } from "../../components/popularCities";

type GeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  timezone?: string;
};

type WeatherDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
};

type WeatherResp = {
  timezone: string | null;
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  } | null;
  daily: WeatherDaily | null;
};

function weatherLabelFromCode(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Showers";
  if ([95, 96, 99].includes(code)) return "Thunder";
  return "Conditions";
}

function cToF(c: number) {
  return (c * 9) / 5 + 32;
}

const KEY_TIME_24H = "ltd_pref_time_24h";
const KEY_TEMP_UNIT = "ltd_pref_temp_unit";

function labelForGeo(g: GeoResult) {
  return `${g.name}${g.admin1 ? `, ${g.admin1}` : ""}, ${g.country}`;
}

function slugify(parts: string[]) {
  const s = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "time";
}

function dayLabel(isoDate: string, tz: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
}

function safeText(v: unknown) {
  const s = typeof v === "string" ? v : "";
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  return s;
}

function AdSlot({ label, size = "normal" }: { label: string; size?: "normal" | "small" }) {
  const heightClass = size === "small" ? "h-12" : "h-24";
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className={`mt-2 ${heightClass} rounded-xl bg-gray-100`} />
      <div className="mt-2 text-[11px] text-gray-500">Ad placeholder (we’ll replace with real ad code later).</div>
    </div>
  );
}

function readTempUnit(): "c" | "f" {
  try {
    const u = localStorage.getItem(KEY_TEMP_UNIT);
    if (u === "c" || u === "f") return u;
  } catch {}
  return "c";
}
function writeTempUnit(u: "c" | "f") {
  try {
    localStorage.setItem(KEY_TEMP_UNIT, u);
  } catch {}
}
function read24h(): boolean {
  try {
    return localStorage.getItem(KEY_TIME_24H) === "1";
  } catch {}
  return false;
}
function write24h(v: boolean) {
  try {
    localStorage.setItem(KEY_TIME_24H, v ? "1" : "0");
  } catch {}
}

export default function CityDashboardClient({
  initialQuery,
  initialLat,
  initialLon,
  initialName,
  initialAdmin1,
  initialCountry,
  initialTimezone,
  mode,
}: {
  initialQuery: string;
  initialLat?: number;
  initialLon?: number;
  initialName?: string;
  initialAdmin1?: string;
  initialCountry?: string;
  initialTimezone?: string;
  mode?: "time" | "weather";
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const qFromUrl = safeText(sp.get("q"));
  const latFromUrl = safeText(sp.get("lat"));
  const lonFromUrl = safeText(sp.get("lon"));

  const isSlugRoute = pathname.startsWith("/time/") || pathname.startsWith("/weather/");

  const [queryInput, setQueryInput] = useState(safeText(qFromUrl || initialQuery || ""));
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [results, setResults] = useState<GeoResult[]>([]);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [weather, setWeather] = useState<WeatherResp | null>(null);

  const [geoLoading, setGeoLoading] = useState(false);
  const [wxLoading, setWxLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [is24h, setIs24h] = useState(false);
  const [tempUnit, setTempUnit] = useState<"c" | "f">("c");
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setIs24h(read24h());
    setTempUnit(readTempUnit());
  }, []);

  function toggle24h() {
    setIs24h((v) => {
      const next = !v;
      write24h(next);
      return next;
    });
  }

  function toggleTempUnit() {
    setTempUnit((u) => {
      const next: "c" | "f" = u === "c" ? "f" : "c";
      writeTempUnit(next);
      return next;
    });
  }

  // URL lat/lon highest priority
  useEffect(() => {
    if (latFromUrl && lonFromUrl) {
      const name = safeText(sp.get("name")) || initialName || "—";
      const country = safeText(sp.get("country")) || initialCountry || "—";
      const admin1 = safeText(sp.get("admin1")) || initialAdmin1;

      const lat = Number(latFromUrl);
      const lon = Number(lonFromUrl);

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setSelected({ id: 0, name, latitude: lat, longitude: lon, country, admin1 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latFromUrl, lonFromUrl]);

  // slug initial lat/lon (if provided)
  useEffect(() => {
    if (
      !selected &&
      typeof initialLat === "number" &&
      typeof initialLon === "number" &&
      Number.isFinite(initialLat) &&
      Number.isFinite(initialLon)
    ) {
      setSelected({
        id: 0,
        name: initialName || initialQuery || "—",
        latitude: initialLat,
        longitude: initialLon,
        country: initialCountry || "—",
        admin1: initialAdmin1 || undefined,
        timezone: initialTimezone || undefined,
      });
    }
  }, [initialLat, initialLon, initialName, initialAdmin1, initialCountry, initialTimezone, initialQuery, selected]);

  // auto-run geocode once on /time/<slug> or /weather/<slug>
  const didAutoRunRef = useRef(false);
  useEffect(() => {
    if (didAutoRunRef.current) return;
    if (selected) return;
    if (latFromUrl && lonFromUrl) return;

    const q = safeText(initialQuery);
    if (isSlugRoute && q) {
      didAutoRunRef.current = true;
      setSearchTerm(q);
    }
  }, [isSlugRoute, initialQuery, selected, latFromUrl, lonFromUrl]);

  function chooseCity(city: GeoResult) {
    setSelected(city);
    setResults([]);
    setShowDropdown(false);
    setErr(null);
    setCopied(false);

    const slug = slugify([city.name, city.admin1 || "", city.country]);
    const params = new URLSearchParams({
      lat: String(city.latitude),
      lon: String(city.longitude),
      name: city.name,
      country: city.country,
      admin1: city.admin1 || "",
    });

    const base = mode === "weather" || pathname.startsWith("/weather/") ? "/weather" : "/time";
    router.replace(`${base}/${slug}?${params.toString()}`);
  }

  // geocode search
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const q = searchTerm.trim();
      if (!q) return;

      setErr(null);
      setGeoLoading(true);

      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = await res.json();
        const list: GeoResult[] = data?.results ?? [];

        if (cancelled) return;

        if (!list.length) {
          setResults([]);
          setShowDropdown(false);
          setErr("No results found. Try: city + state/country (ex: Dallas NC, Paris TX, New York USA).");
          return;
        }

        // ✅ FIX: On /time/<slug> and /weather/<slug>, auto-pick first result and DO NOT show dropdown
        if (isSlugRoute) {
          chooseCity(list[0]);
          return;
        }

        setResults(list);
        setShowDropdown(true);

        // If only one result (non-slug), auto-pick
        if (list.length === 1) {
          chooseCity(list[0]);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setShowDropdown(false);
          setErr("Geocode failed.");
        }
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [searchTerm, isSlugRoute]);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  // weather fetch
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selected) return;

      setWxLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/weather?lat=${selected.latitude}&lon=${selected.longitude}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          setErr(data?.error || "Weather failed.");
          return;
        }

        if (!cancelled) setWeather(data);
      } catch {
        if (!cancelled) setErr("Weather failed.");
      } finally {
        if (!cancelled) setWxLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selected?.latitude, selected?.longitude]);

  const tz = weather?.timezone || selected?.timezone || initialTimezone || "America/New_York";

  const tempC = weather?.current?.temperature_2m;
  const tempValue = typeof tempC === "number" ? (tempUnit === "c" ? tempC : cToF(tempC)) : null;
  const tempText = typeof tempValue === "number" ? `${tempValue.toFixed(1)}°${tempUnit.toUpperCase()}` : "—";

  const code = weather?.current?.weather_code;
  const condText = typeof code === "number" ? weatherLabelFromCode(code) : "—";

  const wind = weather?.current?.wind_speed_10m;
  const windText = typeof wind === "number" ? `${wind.toFixed(1)} km/h` : "—";

  const dailyRows = useMemo(() => {
    const d = weather?.daily;
    if (!d || !d.time?.length) return [];

    return d.time.map((t, idx) => {
      const hiC = d.temperature_2m_max?.[idx];
      const loC = d.temperature_2m_min?.[idx];
      const wcode = d.weather_code?.[idx];

      const hi = typeof hiC === "number" ? (tempUnit === "c" ? hiC : cToF(hiC)) : null;
      const lo = typeof loC === "number" ? (tempUnit === "c" ? loC : cToF(loC)) : null;

      return {
        date: t,
        dow: dayLabel(t, tz),
        hi,
        lo,
        label: typeof wcode === "number" ? weatherLabelFromCode(wcode) : "—",
      };
    });
  }, [weather?.daily, tempUnit, tz]);

  const placeJsonLd = useMemo(() => {
    if (!selected) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Place",
      name: labelForGeo(selected),
      geo: { "@type": "GeoCoordinates", latitude: selected.latitude, longitude: selected.longitude },
      address: {
        "@type": "PostalAddress",
        addressRegion: selected.admin1 || undefined,
        addressCountry: selected.country || undefined,
      },
    };
  }, [selected]);

  function PopularSection({ title = "Popular searches" }: { title?: string }) {
    return (
      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <div className="text-sm font-semibold text-gray-700">{title}</div>
          <div className="mt-1 text-xs text-gray-500">Quick links to high-traffic cities.</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {popularCities.map((c) => {
            const params = new URLSearchParams({
              lat: String(c.lat),
              lon: String(c.lon),
              name: c.name,
              country: c.country,
              admin1: c.admin1 || "",
            }).toString();

            return (
              <div key={c.slug} className="rounded-xl border bg-white px-4 py-3">
                <div className="font-semibold">{c.name}</div>
                <div className="mt-1 text-xs text-gray-500">{(c.admin1 ? `${c.admin1}, ` : "") + c.country}</div>

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

        {/* ✅ Ad card under Popular Cities */}
        <div className="mt-4">
          <AdSlot label="Ad Slot (below popular cities)" size="normal" />
        </div>
      </section>
    );
  }

  return (
    <main className="bg-[#f6f6f6] text-gray-900 overflow-x-hidden pb-16">
      {placeJsonLd && (
        <Script
          id="ld-place"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
        />
      )}

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">LiveTimeData</h1>

            <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = queryInput.trim();
                  if (!q) return;
                  setSearchTerm(q);
                }}
                className="flex gap-3"
              >
                <div className="relative min-w-0 flex-1">
                  <input
                    ref={inputRef}
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    onFocus={() => {
                      if (!isSlugRoute && results.length) setShowDropdown(true);
                    }}
                    placeholder="Search a city (ex: Dallas NC, Paris TX, New York USA)"
                    className="w-full rounded-xl border px-4 py-3 pr-10 outline-none"
                    autoComplete="off"
                  />

                  {/* ✅ X button (works on ALL pages, including home) */}
                  {queryInput.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQueryInput("");
                        setShowDropdown(false);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                      aria-label="Clear search"
                      title="Clear"
                    >
                      ✕
                    </button>
                  )}

                  {showDropdown && results.length > 0 && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
                      {results.slice(0, 10).map((r) => (
                        <button
                          key={`${r.id}-${r.latitude}-${r.longitude}`}
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
                          onClick={() => chooseCity(r)}
                        >
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-xs text-gray-500">{(r.admin1 ? `${r.admin1}, ` : "") + r.country}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button className="shrink-0 rounded-xl bg-black px-5 py-3 text-white" type="submit">
                  {geoLoading ? "Searching…" : "Search"}
                </button>
              </form>
            </div>

            {err && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
            )}

            {!selected && <PopularSection />}

            {selected && (
              <>
                <section className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-3 shadow-sm">
                    <div className="min-h-[120px] flex items-center justify-center">
                      <ClockCard locationLine={labelForGeo(selected)} tz={tz} is24h={is24h} onToggle24h={toggle24h} />
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4 shadow-sm min-h-[120px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-700">City</div>
                        <div className="mt-1 truncate text-xl font-semibold">{labelForGeo(selected)}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          Lat: {selected.latitude.toFixed(5)} • Lon: {selected.longitude.toFixed(5)} • TZ: {tz}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={copyShareLink}
                        className="shrink-0 rounded-xl border px-3 py-2 text-xs hover:bg-gray-50"
                        title="Copy shareable link"
                      >
                        {copied ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-4 shadow-sm min-h-[120px]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Temperature</div>
                      <button
                        type="button"
                        onClick={toggleTempUnit}
                        className="rounded-full border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        aria-label="Toggle temperature unit"
                        title="Toggle °C/°F"
                      >
                        °{tempUnit.toUpperCase()}
                      </button>
                    </div>
                    <div className="mt-2 text-3xl font-semibold">{wxLoading ? "…" : tempText}</div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4 shadow-sm min-h-[120px]">
                    <div className="text-sm text-gray-600">Conditions</div>
                    <div className="mt-2 text-3xl font-semibold">{wxLoading ? "…" : condText}</div>
                    <div className="mt-1 text-sm text-gray-600">Wind: {wxLoading ? "…" : windText}</div>
                  </div>
                </section>

                <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold text-gray-700">7-Day Forecast</div>
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                    {dailyRows.length ? (
                      dailyRows.map((d) => (
                        <div key={d.date} className="min-w-[140px] rounded-xl border bg-white px-4 py-3">
                          <div className="text-sm font-semibold">{d.dow}</div>
                          <div className="mt-1 text-xs text-gray-500">{d.label}</div>
                          <div className="mt-3 text-sm">
                            <span className="font-semibold">
                              {typeof d.hi === "number" ? `${d.hi.toFixed(0)}°${tempUnit.toUpperCase()}` : "—"}
                            </span>
                            <span className="text-gray-500">
                              {" "}
                              /{" "}
                              {typeof d.lo === "number" ? `${d.lo.toFixed(0)}°${tempUnit.toUpperCase()}` : "—"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-600">{wxLoading ? "Loading…" : "—"}</div>
                    )}
                  </div>
                </section>

                <div className="mt-4">
                  <AdSlot label="Ad Slot (below forecast)" size="normal" />
                </div>

                {/* ✅ Popular cities restored on time/weather pages + ad slot under it */}
                <PopularSection title="Popular cities" />
              </>
            )}
          </div>

          <aside className="lg:sticky lg:top-6">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-700">Live webcams</div>
              <div className="mt-1 text-xs text-gray-500">Coming soon (Phase 2).</div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                  No cams yet.
                  <div className="mt-1 text-xs text-gray-500">Phase 2.</div>
                </div>

                <AdSlot label="Ad Slot" size="small" />
                <AdSlot label="Ad Slot" size="small" />
                <AdSlot label="Ad Slot" size="small" />
                <AdSlot label="Ad Slot" size="small" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}