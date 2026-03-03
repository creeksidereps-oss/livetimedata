import { NextResponse } from "next/server";
import { pickLiveCams } from "./liveCams";

export const runtime = "nodejs";

function num(v: string | null) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const lat = num(searchParams.get("lat"));
  const lon = num(searchParams.get("lon"));

  const limitRaw = Number(searchParams.get("limit") ?? "6");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 6;

  const cams = pickLiveCams({ lat, lon, limit });

  const results = cams.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: `${c.city}, ${c.country}`,
    thumbnail: `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`,
  }));

  return NextResponse.json({ results });
}