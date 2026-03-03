export type LiveCam = {
  id: string; // YouTube video id
  title: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
};

export const liveCams: LiveCam[] = [
  // USA
  {
    id: "QEJyYolmjeo", // FOX 4 Dallas tower cam (often embeddable)
    title: "LIVE: Dallas Tower Cam",
    city: "Dallas",
    country: "United States",
    lat: 32.7767,
    lon: -96.797,
  },
  {
    id: "4qyZLflp-sI", // Times Square 1560 Broadway (may vary)
    title: "Times Square Live",
    city: "New York",
    country: "United States",
    lat: 40.758,
    lon: -73.9855,
  },
  {
    id: "IeCVql74ZJ0", // Miami Beach Live (may vary)
    title: "Miami Beach Live",
    city: "Miami Beach",
    country: "United States",
    lat: 25.7907,
    lon: -80.13,
  },

  // Europe
  {
    id: "M3EYAY2MftI", // Abbey Road (often embeddable)
    title: "Abbey Road Crossing Live",
    city: "London",
    country: "United Kingdom",
    lat: 51.5321,
    lon: -0.1774,
  },
  {
    id: "ph1vpnYIxJk", // Venice rolling cam (often embeddable)
    title: "Venice Rolling Cam Live",
    city: "Venice",
    country: "Italy",
    lat: 45.4372,
    lon: 12.3346,
  },

  // Asia
  {
    id: "DVHoPNiNxNo", // Shibuya cam (may vary)
    title: "Shibuya Crossing Live",
    city: "Tokyo",
    country: "Japan",
    lat: 35.6595,
    lon: 139.7005,
  },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function pickLiveCams(params: { lat?: number; lon?: number; limit?: number }) {
  const limit = Math.max(1, Math.min(params.limit ?? 6, 8));

  // If we have a location, return closest cams first
  if (typeof params.lat === "number" && typeof params.lon === "number") {
    return liveCams
      .map((c) => ({
        cam: c,
        dist: haversineKm(params.lat!, params.lon!, c.lat, c.lon),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map((x) => x.cam);
  }

  // Otherwise just return a default list
  return liveCams.slice(0, limit);
}