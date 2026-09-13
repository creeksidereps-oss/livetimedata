// src/lib/yardsales/international.ts

export interface ScrapedIntlSale {
  title: string;
  url: string;
  cityName: string;
  stateName?: string;
  countryCode: string;
  streetAddress?: string;
  latitude?: number;
  longitude?: number;
  startDate: string;
  endDate?: string;
  description: string;
  organizerName?: string;
}

/**
 * Scrapes French vide-greniers and brocantes from Brocabrac (clean Schema.org/Event JSON-LD)
 */
export async function scrapeFranceSales(deptCode: string = "75", cityName: string = "Paris"): Promise<ScrapedIntlSale[]> {
  const url = `https://brocabrac.fr/${deptCode}/${cityName.toLowerCase().replace(/\s+/g, "-")}/`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    const sales: ScrapedIntlSale[] = [];
    const schemaMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];

    for (const match of schemaMatches) {
      try {
        const data = JSON.parse(match[1]);
        if (data["@type"] === "Event") {
          const name = data.name || "Vide-Grenier & Brocante";
          const eventUrl = data.url || data["@id"] || url;
          const loc = data.location || {};
          const addr = loc.address || {};
          const geo = loc.geo || {};

          const street = addr.streetAddress || loc.name || "";
          const locality = addr.addressLocality || cityName;
          const lat = geo.latitude ? parseFloat(geo.latitude) : undefined;
          const lon = geo.longitude ? parseFloat(geo.longitude) : undefined;

          const startDate = data.startDate ? data.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
          const endDate = data.endDate ? data.endDate.slice(0, 10) : startDate;

          sales.push({
            title: name,
            url: eventUrl,
            cityName: locality,
            countryCode: "FR",
            streetAddress: street,
            latitude: lat,
            longitude: lon,
            startDate,
            endDate,
            description: (data.description || name).slice(0, 800),
            organizerName: data.organizer?.name || "Brocante & Vide-Grenier",
          });
        }
      } catch (e) {}
    }

    return sales;
  } catch (err: any) {
    console.error(`Brocabrac scrape error for ${cityName}:`, err.message);
    return [];
  }
}
