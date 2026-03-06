// src/lib/topCities.ts
import topCities from "@/data/topCities.json";

export type TopCity = {
  slug: string;
  name: string;
  admin1?: string;
  country: string;
  lat: number;
  lon: number;
};

export const TOP_CITIES: TopCity[] = topCities as TopCity[];

export function cityParams(c: TopCity) {
  const sp = new URLSearchParams({
    lat: String(c.lat),
    lon: String(c.lon),
    name: c.name,
    country: c.country,
    admin1: c.admin1 || "",
  });
  return sp.toString();
}

export function cityLabel(c: TopCity) {
  return `${c.name}${c.admin1 ? `, ${c.admin1}` : ""}, ${c.country}`;
}