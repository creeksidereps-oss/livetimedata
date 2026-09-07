import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ ok: false, error: 'URL required' }, { status: 400 });
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'Failed to fetch URL' }, { status: 400 });
    }

    const html = await res.text();
    const ogImageMatch = 
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    
    if (ogImageMatch && ogImageMatch[1]) {
      // Decode HTML entities if necessary
      let imageUrl = ogImageMatch[1].replace(/&amp;/g, '&');
      if (imageUrl.startsWith('/')) {
        const urlObj = new URL(targetUrl);
        imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
      }
      return NextResponse.json({ ok: true, imageUrl });
    }

    return NextResponse.json({ ok: false, error: 'No OG image found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Error parsing URL' }, { status: 500 });
  }
}
