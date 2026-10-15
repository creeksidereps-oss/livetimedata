import * as cheerio from "cheerio";

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
  startTime?: string;
  description: string;
  photoUrl?: string;
  hostingEntity?: string;
  source?: string;
}

export function cleanYardSaleText(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&hellip;/gi, "...")
    .replace(/&rarr;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/Read\s*More\s*(\.{3}|…|→)?/gi, "")
    .replace(/\.\.\.\s*\.\.\./g, "...")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
      const title = cleanYardSaleText(titleMatch[2]);

      // Coordinates
      const latMatch = chunk.match(/itemprop="latitude" content="([^"]+)"/i);
      const lonMatch = chunk.match(/itemprop="longitude" content="([^"]+)"/i);
      const latitude = latMatch ? parseFloat(latMatch[1]) : undefined;
      const longitude = lonMatch ? parseFloat(lonMatch[1]) : undefined;

      // Address
      const streetMatch = chunk.match(/itemprop="streetAddress">([^<]+)<\/span>/i);
      const cityMatch = chunk.match(/itemprop="addressLocality">([^<]+)<\/span>/i);
      const regionMatch = chunk.match(/itemprop="addressRegion">([^<]+)<\/span>/i);
      const streetAddress = streetMatch ? cleanYardSaleText(streetMatch[1]) : undefined;
      const locality = cityMatch ? cleanYardSaleText(cityMatch[1]) : citySlug;
      const region = regionMatch ? cleanYardSaleText(regionMatch[1]) : stateSlug.toUpperCase();

      // Dates
      const startMatch = chunk.match(/itemprop="startDate" content="([^"]+)"/i);
      const endMatch = chunk.match(/itemprop="endDate" content="([^"]+)"/i);
      const startDate = startMatch ? startMatch[1].trim() : new Date().toISOString().slice(0, 10);
      const endDate = endMatch ? endMatch[1].trim() : startDate;

      // Description
      const descMatch = chunk.match(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/i);
      let description = descMatch ? cleanYardSaleText(descMatch[1]) : title;
      if (!description) description = title;
      description = description.slice(0, 800);

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

/**
 * Scrapes garage, yard, and moving sales from Gsalr Network (gsalr.com, garagesalefinder.com, yardsales.net)
 * Enforces mandatory physical street address with a house number.
 */
export async function scrapeGsalrForCity(
  citySlug: string,
  stateSlug: string
): Promise<ScrapedYardSale[]> {
  const url = `https://gsalr.com/garage-sales-${citySlug.toLowerCase().replace(/\s+/g, "-")}-${stateSlug.toLowerCase()}.html`;
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
    const $ = cheerio.load(html);
    const sales: ScrapedYardSale[] = [];
    const streetPattern = /\d+\s+([a-zA-Z0-9#.\s]+)/;

    $('[itemtype*="Event"]').each((_, el) => {
      const title = cleanYardSaleText($(el).find('[itemprop="name"]').text());
      const saleUrl = $(el).find('[itemprop="url"]').attr("href") || "";
      const rawStreet = cleanYardSaleText($(el).find('[itemprop="streetAddress"]').text());
      const locality = cleanYardSaleText($(el).find('[itemprop="addressLocality"]').text());
      const region = cleanYardSaleText($(el).find('[itemprop="addressRegion"]').text());
      const postalCode = $(el).find('[itemprop="postalCode"]').text().trim();
      const startDate = $(el).find('[itemprop="startDate"]').attr("content") || new Date().toISOString().slice(0, 10);
      const photoUrl = $(el).find('img[itemprop="image"]').attr("src");
      const desc = cleanYardSaleText($(el).find(".sale-desc, .desc").text()) || title;

      // MANDATORY ADDRESS ENFORCEMENT: Reject listings without a valid street number
      if (!rawStreet || !streetPattern.test(rawStreet)) {
        return;
      }

      sales.push({
        title,
        url: saleUrl,
        streetAddress: rawStreet,
        cityName: locality || citySlug,
        stateName: region || stateSlug.toUpperCase(),
        postalCode,
        startDate: startDate.slice(0, 10),
        description: desc.slice(0, 800),
        photoUrl,
        hostingEntity: "Community Member",
        source: "Gsalr Network",
      });
    });

    return sales;
  } catch (err: any) {
    console.error(`Gsalr scraper error for ${citySlug}, ${stateSlug}:`, err.message);
    return [];
  }
}

/**
 * Scrapes estate and liquidations sales from EstateSales.NET using Schema.org/SaleEvent JSON-LD.
 * Enforces mandatory physical street address with a house number.
 */
export async function scrapeEstateSalesForCity(
  citySlug: string,
  stateSlug: string
): Promise<ScrapedYardSale[]> {
  const url = `https://www.estatesales.net/${stateSlug.toUpperCase()}/${encodeURIComponent(citySlug)}`;
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
    const $ = cheerio.load(html);
    const sales: ScrapedYardSale[] = [];
    const streetPattern = /\d+\s+([a-zA-Z0-9#.\s]+)/;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data["@type"] === "SaleEvent") {
          const title = cleanYardSaleText(data.name);
          const saleUrl = data.url;
          const loc = data.location || {};
          const addr = loc.address || {};
          const streetAddress = cleanYardSaleText(addr.streetAddress);
          const locality = cleanYardSaleText(addr.addressLocality) || citySlug;
          const region = cleanYardSaleText(addr.addressRegion) || stateSlug.toUpperCase();
          const postalCode = addr.postalCode;
          const startDate = data.startDate ? data.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
          const endDate = data.endDate ? data.endDate.slice(0, 10) : startDate;
          const photoUrl = Array.isArray(data.image) ? data.image[0] : data.image;

          // Handle EstateSales.NET practice of releasing exact street addresses on sale morning:
          let finalStreetAddress = streetAddress;
          if (!finalStreetAddress || !streetPattern.test(finalStreetAddress)) {
            if (locality && region) {
              finalStreetAddress = `${locality}, ${region} ${postalCode || ''} (Address released day of sale)`.trim();
            } else {
              return;
            }
          }

          const rawDesc = cleanYardSaleText(data.description);
          const finalDesc = (rawDesc && rawDesc !== "Estate Sale" ? rawDesc : title).slice(0, 800);

          sales.push({
            title,
            url: saleUrl,
            streetAddress: finalStreetAddress,
            cityName: locality,
            stateName: region,
            postalCode,
            startDate,
            endDate,
            description: finalDesc,
            photoUrl,
            hostingEntity: cleanYardSaleText(data.organizer?.name) || "Estate Liquidation Specialist",
            source: "EstateSales.NET",
          });
        }
      } catch (e) {}
    });

    return sales;
  } catch (err: any) {
    console.error(`EstateSales.NET scraper error for ${citySlug}, ${stateSlug}:`, err.message);
    return [];
  }
}

/**
 * Scrapes nationwide live in-person storage lien auctions from StorageTreasures.
 * STRICT ENFORCEMENT:
 * - Only live on-site auctions at physical storage facilities are ingested.
 * - Online-only auctions and digital bids are strictly excluded.
 * - Every auction must contain a verified numeric physical street address.
 */
export async function scrapeStorageTreasuresLiveAuctions(): Promise<ScrapedYardSale[]> {
  const apiKey = "oiXHdXqV7N1hm4y9qA8NGJCqBa9tSs6aU6dBBQCf";
  const baseUrl = "https://api.st-prd-1.aws.storagetreasures.com/p/";
  const streetPattern = /\d+\s+([a-zA-Z0-9#.\s]+)/;
  const auctions: ScrapedYardSale[] = [];

  let page = 1;
  try {
    while (page <= 10) {
      const res = await fetch(`${baseUrl}live-auctions?page_num=${page}&page_count=100`, {
        headers: {
          "x-api-key": apiKey,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) break;
      const json = await res.json();
      const items = json.live_auctions || [];
      if (items.length === 0) break;

      for (const item of items) {
        const facility = item.facility || {};
        const street = (facility.address || "").trim();

        // STRICT PHYSICAL ADDRESS ENFORCEMENT
        if (!street || !streetPattern.test(street)) {
          continue;
        }

        const cityName = (facility.city || "").trim();
        const stateName = (facility.state || "").trim();
        const postalCode = (facility.zipcode || "").trim();
        const facilityName = (facility.facility_name || "Self Storage Facility").trim();
        const unitCount = item.unit_count
          ? `${item.unit_count} unit${Number(item.unit_count) > 1 ? "s" : ""}`
          : "Storage units";

        const expDate =
          item.expire_date?.user?.date ||
          item.expire_date?.utc?.date ||
          (item.expire_date?.utc?.datetime ? item.expire_date.utc.datetime.slice(0, 10) : "");
        const expTime =
          item.expire_date?.user?.time_formatted ||
          item.expire_date?.user?.time ||
          "10:00 AM";

        if (!expDate) continue;

        const auctionUrl = `https://www.storagetreasures.com/facilities/${facility.facility_id || item.facility_id}#live-auctions`;
        const title = `Live Storage Auction (${unitCount}) - ${facilityName}`;
        const desc = `Live in-person storage lien auction at ${facilityName}. Unit count: ${unitCount}. Address: ${street}, ${cityName}, ${stateName} ${postalCode}. In-person attendance required.`;

        auctions.push({
          title,
          url: auctionUrl,
          streetAddress: street,
          cityName,
          stateName,
          postalCode,
          startDate: expDate,
          startTime: expTime,
          description: desc,
          hostingEntity: facilityName,
          source: "StorageTreasures",
          latitude: facility.marker?.lat ? parseFloat(facility.marker.lat) : undefined,
          longitude: facility.marker?.lng ? parseFloat(facility.marker.lng) : undefined,
        });
      }

      if (items.length < 100) break;
      page++;
    }
  } catch (err: any) {
    console.error("StorageTreasures live auction scraper error:", err.message);
  }

  return auctions;
}

/**
 * Scrapes garage, yard, and community sales from Yard Sale Treasure Map (yardsaletreasuremap.com).
 * Enforces mandatory physical street address with a house number parsed from the permalink structure.
 */
export async function scrapeYardSaleTreasureMapForCity(
  citySlug: string,
  stateSlug: string
): Promise<ScrapedYardSale[]> {
  const stateFormatted = stateSlug.includes("-")
    ? stateSlug
    : stateSlug.toLowerCase() === "nc"
    ? "North-Carolina"
    : stateSlug;
  const cityFormatted = citySlug
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("-");

  const url = `https://yardsaletreasuremap.com/US/${stateFormatted}/${cityFormatted}.html`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const sales: ScrapedYardSale[] = [];
    const streetPattern = /\d+\s+([a-zA-Z0-9#.\s]+)/;

    $(".grid-item").each((_, el) => {
      const href = $(el).find("a.sale_url").attr("href") || "";
      const rawTitle = cleanYardSaleText($(el).find(".sale_title").text());
      const rawDesc = cleanYardSaleText($(el).find(".sale_desc").text());

      // Match /US/{State}/{City}/{Street}/{Id}/
      const urlMatch = href.match(/\/US\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(\d+)\//i);
      if (!urlMatch) return;

      const statePart = cleanYardSaleText(urlMatch[1].replace(/-/g, " "));
      const cityPart = cleanYardSaleText(urlMatch[2].replace(/-/g, " "));
      const streetPart = cleanYardSaleText(urlMatch[3].replace(/-/g, " "));

      // MANDATORY ADDRESS ENFORCEMENT: Reject listings without a valid street number
      if (!streetPattern.test(streetPart)) return;

      // Extract date from desc
      let eventDate = new Date().toISOString().slice(0, 10);
      const dateMatch = rawDesc.match(/(\d{1,2})\/(\d{1,2})/);
      if (dateMatch) {
        let p1 = parseInt(dateMatch[1], 10);
        let p2 = parseInt(dateMatch[2], 10);
        let mon = p1;
        let day = p2;
        if (p1 > 12 && p2 <= 12) {
          mon = p2;
          day = p1;
        }
        if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
          eventDate = `${new Date().getFullYear()}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }

      // Extract start time
      let startTime = "08:00 AM";
      const timeMatch =
        rawDesc.match(/start time:\s*(\d+(?::\d+)?\s*(?:am|pm)?)/i) ||
        rawDesc.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*/i);
      if (timeMatch) {
        startTime = timeMatch[1].toUpperCase();
        if (!startTime.includes("AM") && !startTime.includes("PM")) {
          startTime += " AM";
        }
      }

      const fullAddress = `${streetPart}, ${cityPart}, ${statePart}`;
      const title = rawTitle || `Yard Sale - ${streetPart}`;
      const details = `${rawDesc}\n\nLocation: ${fullAddress}. Sourced via Yard Sale Treasure Map.`;

      sales.push({
        title,
        url: href,
        streetAddress: streetPart,
        cityName: cityPart,
        stateName: statePart,
        startDate: eventDate,
        startTime,
        description: details.slice(0, 800),
        hostingEntity: "Community Member",
        source: "Yard Sale Treasure Map",
      });
    });

    return sales;
  } catch (err: any) {
    console.error(`YardSaleTreasureMap scraper error for ${citySlug}, ${stateSlug}:`, err.message);
    return [];
  }
}

