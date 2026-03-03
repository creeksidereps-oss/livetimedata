import { NextResponse } from "next/server";

export const runtime = "nodejs";

function num(v: string | null) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = num(searchParams.get("lat"));
  const lon = num(searchParams.get("lon"));

  if (lat === null || lon === null) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lon" },
      { status: 400 }
    );
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  // current weather
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");

  // daily forecast
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code"
  );

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Weather provider error" }, { status: 502 });
  }

  const data = await res.json();

  return NextResponse.json({
    timezone: data?.timezone ?? null,
    current: data?.current ?? null,
    daily: data?.daily ?? null,
  });
}