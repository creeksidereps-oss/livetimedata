import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return new Response(`Error fetching external page (${res.status} ${res.statusText})`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "text/html; charset=utf-8";
    let body = await res.text();

    // Inject <base href="..."> into <head> so all relative CSS, images, fonts, and links resolve to the source website
    try {
      const parsedUrl = new URL(targetUrl);
      const baseHref = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
      const baseTag = `<base href="${baseHref}">`;

      if (body.includes("<head>")) {
        body = body.replace("<head>", `<head>${baseTag}`);
      } else if (body.includes("<head ")) {
        body = body.replace(/<head[^>]*>/, `$&${baseTag}`);
      } else {
        body = `${baseTag}${body}`;
      }
    } catch (e) {
      // URL parsing fallback
    }

    // Return HTML stripped of X-Frame-Options and restrictive Content-Security-Policy
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (err: any) {
    console.error("In-modal proxy error:", err);
    return new Response(`Unable to load preview: ${err.message}`, { status: 500 });
  }
}
