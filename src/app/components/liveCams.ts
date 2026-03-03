export type LiveCam = {
  id: string; // YouTube video id
  title: string;
  city: string;
  country: string;
  keywords: string[];
};

export const liveCams: LiveCam[] = [
  {
    id: "2E22geZeZDA",
    title: "Times Square (NYC) Live",
    city: "New York",
    country: "United States",
    keywords: ["new york", "nyc", "times square", "united states", "usa"],
  },
  {
    id: "dfVK7ld38Ys",
    title: "Shibuya Scramble Crossing Live",
    city: "Tokyo",
    country: "Japan",
    keywords: ["tokyo", "shibuya", "scramble", "japan"],
  },
  {
    id: "iZipA1LL_sU",
    title: "Eiffel Tower View (Paris) Live",
    city: "Paris",
    country: "France",
    keywords: ["paris", "eiffel", "france"],
  },
  {
    id: "M3EYAY2MftI",
    title: "Abbey Road Crossing (London) Live",
    city: "London",
    country: "United Kingdom",
    keywords: ["london", "abbey road", "united kingdom", "uk", "england"],
  },
  {
    id: "dq-mrcOopLM",
    title: "Waikiki Beach (Honolulu) Live",
    city: "Honolulu",
    country: "United States",
    keywords: ["waikiki", "honolulu", "hawaii", "oahu", "united states", "usa"],
  },
  {
    id: "ph1vpnYIxJk",
    title: "Venice Rolling Cam Live",
    city: "Venice",
    country: "Italy",
    keywords: ["venice", "venezia", "italy"],
  },
  {
    id: "MfIpyflPbHQ",
    title: "Dubai Marina Live",
    city: "Dubai",
    country: "United Arab Emirates",
    keywords: ["dubai", "marina", "uae", "united arab emirates"],
  },
];

export function pickLiveCams(params: {
  city?: string;
  admin1?: string;
  country?: string;
  q?: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(params.limit ?? 6, 8));
  const blob = `${params.city ?? ""} ${params.admin1 ?? ""} ${params.country ?? ""} ${params.q ?? ""}`
    .toLowerCase()
    .trim();

  const scored = liveCams
    .map((c) => {
      let score = 0;
      for (const k of c.keywords) {
        if (blob.includes(k)) score += 10;
      }
      if (params.country && c.country.toLowerCase() === params.country.toLowerCase()) score += 5;
      return { cam: c, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.cam);

  if (!top.length) return liveCams.slice(0, limit);

  return top;
}