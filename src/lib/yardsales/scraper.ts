// src/lib/yardsales/scraper.ts
export interface ScrapedYardSale {
  title: string;
  url: string;
  latitude?: number;
  longitude?: number;
  streetAddress?: string;
  cityName: string;
  stateName: string;
  postalCode?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  description: string;
  photoUrl?: string;
}

export async function scrapeYardSaleSearchForCity(
  citySlug: string,
  stateSlug: string
): Promise<ScrapedYardSale[]> {
  const url = `https://www.yardsalesearch.com/garage-sales-${citySlug.toLowerCase().replace(/\s+/g, "-")}-${stateSlug.toLowerCase()}.html`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    const sales: ScrapedYardSale[] = [];

    // Match each sale block
    const cardMatches = html.split(/<div class="[^"]*sale-header[^"]*">/i);
    // skip the first chunk before the first sale-header
    for (let i = 1; i < cardMatches.length; i++) {
      const chunk = cardMatches[i];

      // Title & URL
      const titleMatch = chunk.match(/<h2 itemprop="name">\s*<a itemprop="url" href="([^"]+)">([^<]+)<\/a>/i);
      if (!titleMatch) continue;
      const saleUrl = titleMatch[1].trim();
      const title = titleMatch[2].trim();

      // Coordinates
      const latMatch = chunk.match(/itemprop="latitude" content="([^"]+)"/i);
      const lonMatch = chunk.match(/itemprop="longitude" content="([^"]+)"/i);
      const latitude = latMatch ? parseFloat(latMatch[1]) : undefined;
      const longitude = lonMatch ? parseFloat(lonMatch[1]) : undefined;

      // Address
      const streetMatch = chunk.match(/itemprop="streetAddress">([^<]+)<\/span>/i);
      const cityMatch = chunk.match(/itemprop="addressLocality">([^<]+)<\/span>/i);
      const regionMatch = chunk.match(/itemprop="addressRegion">([^<]+)<\/span>/i);
      const streetAddress = streetMatch ? streetMatch[1].trim() : undefined;
      const locality = cityMatch ? cityMatch[1].trim() : citySlug;
      const region = regionMatch ? regionMatch[1].trim() : stateSlug.toUpperCase();

      // Dates
      const startMatch = chunk.match(/itemprop="startDate" content="([^"]+)"/i);
      const endMatch = chunk.match(/itemprop="endDate" content="([^"]+)"/i);
      const startDate = startMatch ? startMatch[1].trim() : new Date().toISOString().slice(0, 10);
      const endDate = endMatch ? endMatch[1].trim() : startDate;

      // Description
      const descMatch = chunk.match(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/i);
      let description = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : title;
      description = description.replace(/\s+/g, " ").slice(0, 800);

      // Photo
      const photoMatch =
        chunk.match(/<img[^>]*class="[^"]*listing-photo-thumb[^"]*"[^>]*src="([^"]+)"/i) ||
        chunk.match(/<img[^>]*src="([^"]+)"[^>]*alt="Listing Photo Thumbnail"/i);
      const photoUrl = photoMatch ? photoMatch[1].trim() : undefined;

      sales.push({
        title,
        url: saleUrl,
        latitude,
        longitude,
        streetAddress,
        cityName: locality,
        stateName: region,
        startDate,
        endDate,
        description,
        photoUrl,
      });
    }

    return sales;
  } catch (err: any) {
    console.error(`YardSaleSearch scraper error for ${citySlug}, ${stateSlug}:`, err.message);
    return [];
  }
}
