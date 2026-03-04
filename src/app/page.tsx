"use client";

import { useState } from "react";
import Link from "next/link";

const popularCities = [
  { name: "New York", country: "USA" },
  { name: "Los Angeles", country: "USA" },
  { name: "Chicago", country: "USA" },
  { name: "London", country: "UK" },
  { name: "Paris", country: "France" },
  { name: "Tokyo", country: "Japan" },
  { name: "Sydney", country: "Australia" },
  { name: "Toronto", country: "Canada" },
];

export default function HomePage() {
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    const slug = query
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\s+/g, "-");

    window.location.href = `/time/${slug}`;
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">

      {/* Title */}
      <h1 className="text-3xl font-semibold mb-8">
        LiveTimeData
      </h1>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className="flex gap-3 mb-12"
      >
        <input
          className="flex-1 border rounded-lg px-4 py-3"
          placeholder="Search a city (ex: Dallas NC, Paris TX, New York USA)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button
          className="bg-black text-white px-5 py-3 rounded-lg"
          type="submit"
        >
          Search
        </button>
      </form>

      {/* Popular Cities */}
      <div className="border rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4">
          Popular Cities
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {popularCities.map((city) => {
            const slug = `${city.name}-${city.country}`
              .toLowerCase()
              .replace(/\s+/g, "-");

            return (
              <Link
                key={slug}
                href={`/time/${slug}`}
                className="border rounded-lg px-4 py-3 hover:bg-gray-50"
              >
                {city.name}
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}