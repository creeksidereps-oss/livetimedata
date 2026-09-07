import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import ytSearch from "yt-search";

export const runtime = "nodejs"; // yt-search requires nodejs
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { cityName, stateName } = await req.json();

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "Missing cityName" }, { status: 400 });
    }

    console.log(`[WEBCAM SCRAPER] Searching live webcams for: ${cityName}, ${stateName || ''}`);

    const cityLower = cityName.toLowerCase().trim();

    // City-specific landmark terms for richer discovery
    const LANDMARK_MAP: Record<string, string[]> = {
      istanbul: ["bosphorus", "taksim", "galata", "sultanahmet", "kadikoy"],
      paris: ["eiffel", "seine", "montmartre", "champs elysees", "notre dame"],
      rome: ["vatican", "colosseum", "trevi", "st peter", "piazza navona"],
      dubai: ["burj khalifa", "dubai marina", "dubai mall", "palm jumeirah"],
      tokyo: ["shibuya", "shinjuku", "tokyo tower", "akihabara", "ginza", "asakusa"],
      london: ["tower bridge", "big ben", "london eye", "thames", "trafalgar"],
      "new york": ["times square", "brooklyn bridge", "manhattan", "broadway"],
      bangkok: ["sukhumvit", "chao phraya", "khao san", "siam"],
      miami: ["south beach", "ocean drive", "biscayne", "brickell"],
    };

    const landmarks = LANDMARK_MAP[cityLower] || [];

    const queries = [
      `${cityName} live cam`,
      `${cityName} live webcam`,
      `${cityName} ${stateName || ''} live stream`,
      `${cityName} traffic live`,
      `${cityName} skyline live`
    ];

    // Add landmark queries if available
    landmarks.slice(0, 3).forEach(l => {
      queries.push(`${l} live cam`);
    });

    let newCamsAdded = 0;
    const addedVideoIds = new Set<string>();

    for (const query of queries) {
      if (addedVideoIds.size >= 10) break;

      try {
        const searchRes = await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgJAAQ%253D%253D`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            },
          }
        );

        if (!searchRes.ok) continue;

        const html = await searchRes.text();
        const regex = /"videoId":"(.*?)"/g;
        let match;
        const pageIds = new Set<string>();
        while ((match = regex.exec(html)) !== null) {
          if (match[1].length === 11) pageIds.add(match[1]);
        }

        for (const videoId of Array.from(pageIds).slice(0, 4)) {
          if (addedVideoIds.has(videoId)) continue;

          let v: any = null;
          try {
            v = await ytSearch({ videoId });
          } catch (e) {
            continue;
          }

          if (!v || !v.title) continue;

          const titleLower = v.title.toLowerCase();

          // Strict City Matching: Must mention either the city OR one of its famous landmarks
          const mentionsCity = titleLower.includes(cityLower);
          const mentionsLandmark = landmarks.some(l => titleLower.includes(l));

          if (!mentionsCity && !mentionsLandmark) {
            continue;
          }

          // Filter out spam / useless livestreams
          if (
            titleLower.includes("what time is it") ||
            titleLower.includes("current time") ||
            titleLower.includes("minecraft") ||
            titleLower.includes("gta") ||
            titleLower.includes("lofi hip hop") ||
            titleLower.includes("study music") ||
            titleLower.includes("news live")
          ) {
            continue;
          }

          // Verify embedding is allowed on YouTube
          try {
            const oembedRes = await fetch(
              `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
            );
            if (!oembedRes.ok) {
              continue;
            }
          } catch (err) {
            continue;
          }

          const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;

          // Check if already in DB
          const existing = await sql`
            SELECT id FROM webcams 
            WHERE embed_url = ${embedUrl} OR embed_url ILIKE ${`%${videoId}%`}
            LIMIT 1
          `;

          if (existing.rows.length === 0) {
            let kind = "local-cam";
            if (titleLower.includes("traffic") || titleLower.includes("road") || titleLower.includes("highway") || titleLower.includes("i-")) {
              kind = "traffic-cam";
            } else if (titleLower.includes("zoo") || titleLower.includes("animal") || titleLower.includes("aquarium") || titleLower.includes("wildlife")) {
              kind = "wildlife-cam";
            } else if (titleLower.includes("beach") || titleLower.includes("ocean") || titleLower.includes("port") || titleLower.includes("bay") || titleLower.includes("harbor")) {
              kind = "tourist-cam";
            } else if (titleLower.includes("skyline") || titleLower.includes("downtown") || titleLower.includes("view") || titleLower.includes("tower")) {
              kind = "skyline-cam";
            } else if (titleLower.includes("weather")) {
              kind = "weather-cam";
            }

            // Clean up title for elegant display
            const cleanTitle = v.title
              .replace(/🔴/g, "")
              .replace(/24\/7/gi, "")
              .replace(/4k|1080p|2160p|uhd/gi, "")
              .replace(/live stream(ing)?/gi, "")
              .replace(/live webcam/gi, "")
              .replace(/live cam/gi, "")
              .replace(/live/gi, "")
              .replace(/\|/g, " - ")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, 60);

            await sql`
              INSERT INTO webcams (
                city_name, state_name, kind, title, source, status, embed_url, image_url, view_count, created_at
              ) VALUES (
                ${cityName},
                ${stateName || 'Global'},
                ${kind},
                ${cleanTitle || v.title.substring(0, 60)},
                'YouTube Live Bot',
                'live',
                ${embedUrl},
                ${v.thumbnail || v.image || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`},
                ${Math.floor(Math.random() * 400) + 100},
                NOW()
              )
            `;

            addedVideoIds.add(videoId);
            newCamsAdded++;
            console.log(`[WEBCAM SCRAPER] Added new live cam for ${cityName}: ${cleanTitle}`);
          }

          if (addedVideoIds.size >= 10) break;
        }
      } catch (queryErr) {
        console.error(`[WEBCAM SCRAPER] Error on query "${query}":`, queryErr);
      }
    }

    return NextResponse.json({
      ok: true,
      added: newCamsAdded,
      message: `Scraped and added ${newCamsAdded} new live streams for ${cityName}.`,
    });
  } catch (error: any) {
    console.error("[WEBCAM SCRAPER ERROR]:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
