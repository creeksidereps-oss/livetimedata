// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/admin-*"],
      },
    ],
    sitemap: "https://www.livetimedata.com/sitemap.xml",
  };
}