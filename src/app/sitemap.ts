// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { popularCities } from "./components/popularCities";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://livetimedata.com";

  const core: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/city-dashboard`, changeFrequency: "daily", priority: 0.9 },
  ];

  const cityPages: MetadataRoute.Sitemap = popularCities.flatMap((c) => [
    {
      url: `${baseUrl}/time/${c.slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/weather/${c.slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ]);

  return [...core, ...cityPages];
}