"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CityDashboardClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  async function searchCity(q: string) {
    if (!q.trim()) return;

    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data.results || []);
  }

  function chooseCity(city: any) {
    const params = new URLSearchParams({
      lat: city.latitude,
      lon: city.longitude,
      name: city.name,
      country: city.country,
      admin1: city.admin1 || "",
    });

    const slug = `${city.name}-${city.admin1 || ""}-${city.country}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    router.push(`/time/${slug}?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <h1 className="text-3xl font-bold mb-6">LiveTimeData</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          searchCity(query);
        }}
        className="flex gap-3"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city"
          className="border rounded-lg px-4 py-2 flex-1"
        />
        <button className="bg-black text-white px-5 py-2 rounded-lg">
          Search
        </button>
      </form>

      {results.length > 0 && (
        <div className="mt-4 border rounded-lg bg-white">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => chooseCity(r)}
              className="block w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-none"
            >
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-gray-500">
                {r.admin1 ? `${r.admin1}, ` : ""}
                {r.country}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}