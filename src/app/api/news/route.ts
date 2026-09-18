// src/app/api/news/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(val: any): string {
  return String(val || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
}

function timeAgo(dateString: string): string {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    if (isNaN(diffMs)) return "Recently";

    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) {
      return diffMins <= 1 ? "Just now" : `${diffMins} mins ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(past);
  } catch {
    return "Recently";
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCity = searchParams.get("city") || "";
    const rawState = searchParams.get("state") || "";
    const rawCountry = searchParams.get("country") || "United States";

    const cityName = clean(rawCity);
    const stateName = clean(rawState);
    const countryName = clean(rawCountry);

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "City name required" }, { status: 400 });
    }

    const queryLocation = `${cityName} ${stateName || countryName}`.trim();
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryLocation)}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch news feed" }, { status: res.status });
    }

    const xmlText = await res.text();
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];

    const stories = itemMatches.slice(0, 12).map((itemXml, index) => {
      const rawTitle = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Local News Update";
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
      const source = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "Local News";
      const descHtml = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";

      // Clean headline: Google News RSS appends "- Source" at the end of titles
      let cleanHeadline = rawTitle.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (source && cleanHeadline.endsWith(` - ${source}`)) {
        cleanHeadline = cleanHeadline.slice(0, cleanHeadline.lastIndexOf(` - ${source}`)).trim();
      }

      // Clean description snippet
      const cleanSnippet = descHtml
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        id: `news-${index}-${Buffer.from(cleanHeadline).toString("base64").slice(0, 8)}`,
        title: cleanHeadline,
        source: source.trim(),
        pubDate,
        timeAgo: timeAgo(pubDate),
        snippet: cleanSnippet || `Latest regional coverage and breaking headlines for ${cityName}.`,
        link: link.trim()
      };
    });

    return NextResponse.json({
      ok: true,
      cityName,
      stateName,
      stories
    });
  } catch (error: any) {
    console.error("News API error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to load news" }, { status: 500 });
  }
}
