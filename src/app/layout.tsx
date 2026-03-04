import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveTimeData",
  description: "Live time + weather by city.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google AdSense Verification Script */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8921617153359907"
          crossOrigin="anonymous"
        ></script>
      </head>

      <body>
        {children}
      </body>
    </html>
  );
}