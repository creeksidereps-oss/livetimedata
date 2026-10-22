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
      const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1329; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .box { max-width: 440px; padding: 32px 24px; background: #131f37; border-radius: 16px; border: 1px solid #1e293b; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    h2 { font-size: 18px; margin: 0 0 10px 0; color: #ffffff; font-weight: 700; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="box">
    <div class="badge">Official Provider Notice</div>
    <h2>Protected Host Site</h2>
    <p>This host provider restricts automated in-modal browsing. All confirmed event times, venue addresses, and physical coordinates remain fully accessible on LiveTimeData.</p>
  </div>
</body>
</html>`;
      return new Response(fallbackHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
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
    return new Response(`<!DOCTYPE html><html><body style="background:#0b1329;color:#94a3b8;font-family:sans-serif;text-align:center;padding-top:40px;"><p>Preview unavailable. Full details displayed on event card.</p></body></html>`, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
