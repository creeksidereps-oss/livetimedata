// src/app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveTimeData",
  description: "Search any city for the local time and current weather.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>

          {/* Footer links (global) */}
          <footer className="border-t mt-10 py-6 text-sm text-center text-gray-600">
            <div className="flex justify-center gap-6">
              <Link href="/about" className="hover:underline">
                About
              </Link>
              <Link href="/contact" className="hover:underline">
                Contact
              </Link>
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
            </div>
            <div className="mt-3 text-xs text-gray-500">© {new Date().getFullYear()} LiveTimeData</div>
          </footer>
        </div>
      </body>
    </html>
  );
}