import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allowed Admin PINs are read from the ADMIN_PINS env var (comma-separated),
// e.g. ADMIN_PINS=111111,222222 in Vercel > Project Settings > Environment Variables.
// TODO: once ADMIN_PINS is set in Vercel, delete LEGACY_PINS so no PINs live in source code.
const LEGACY_PINS = ['090726', '102687', '030201', '110293'];
const ALLOWED_PINS = new Set(
  (process.env.ADMIN_PINS || '').split(',').map((p) => p.trim()).filter(Boolean).length > 0
    ? (process.env.ADMIN_PINS as string).split(',').map((p) => p.trim()).filter(Boolean)
    : LEGACY_PINS
);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Block direct public access to /admin or /admin/...
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // Return 404 Not Found to prevent discovery/guessing
    return new NextResponse(null, { status: 404 });
  }

  // 2. Check for secret pin access: /admin-:pin or /admin-:pin/...
  const adminMatch = pathname.match(/^\/admin-([0-9a-zA-Z]+)(\/.*)?$/);
  if (adminMatch) {
    const pin = adminMatch[1];
    const subpath = adminMatch[2] || '';

    if (ALLOWED_PINS.has(pin)) {
      // If user navigates directly to /admin-[pin] without subpath, redirect to curation
      if (!subpath || subpath === '/') {
        const url = request.nextUrl.clone();
        url.pathname = `/admin-${pin}/curation`;
        return NextResponse.redirect(url);
      }

      // Rewrite the URL internally to /admin/... so page components resolve cleanly
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/admin${subpath}`;
      return NextResponse.rewrite(rewriteUrl);
    } else {
      // If PIN is invalid, return 404
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/admin-:pin/:path*',
    '/admin-:pin',
  ],
};
