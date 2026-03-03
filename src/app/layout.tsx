// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LiveTimeData",
  description: "Search any city for the local time and current weather.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[#f6f6f6] antialiased`}>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>

          <footer className="w-full border-t bg-white">
            <div className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between text-sm text-gray-600">
              <div className="text-xs text-gray-500">
                © {new Date().getFullYear()} LiveTimeData
              </div>
              <div className="flex gap-6">
                <Link href="/privacy" className="hover:underline">
                  Privacy
                </Link>
                <Link href="/terms" className="hover:underline">
                  Terms
                </Link>
                <Link href="/contact" className="hover:underline">
                  Contact
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}