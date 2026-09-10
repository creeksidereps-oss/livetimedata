import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allowed Admin PINs:
// 090726 - Founder
// 102687 - Heather
// 030201 - Meredythe
// 110293 - Shelby
const ALLOWED_PINS = new Set([
  '090726',
  '102687',
  '030201',
  '110293'
]);

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
