// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { TOP_CITIES } from "@/lib/topCities";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://livetimedata.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = TOP_CITIES.flatMap((c) => [
    { url: `${base}/time/${c.slug}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/weather/${c.slug}`, changeFrequency: "daily", priority: 0.8 },
  ]);

  return [...staticRoutes, ...cityRoutes];
}