import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://livetimedata.com"),
  title: {
    default: "LiveTimeData | Live City Time, Weather, Webcams & Community Events",
    template: "%s | LiveTimeData",
  },
  description: "Real-time municipal intelligence, local time, weather forecast, live webcams, community events, photos, and historical city insights.",
  openGraph: {
    title: "LiveTimeData | Live City Time, Weather, Webcams & Community Events",
    description: "Real-time municipal intelligence, local time, weather forecast, live webcams, community events, photos, and historical city insights.",
    url: "https://livetimedata.com",
    siteName: "LiveTimeData",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/assets/brand-placeholder.png",
        width: 1200,
        height: 630,
        alt: "LiveTimeData Municipal Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LiveTimeData | Real-Time City Intelligence",
    description: "Real-time municipal intelligence, local time, weather forecast, live webcams, and community events.",
    images: ["/assets/brand-placeholder.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8921617153359907"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-black text-white antialiased min-h-screen flex flex-col`}>
        {children}
        <Footer />
      </body>
    </html>
  );
}