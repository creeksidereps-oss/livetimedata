import React from "react";
import { isValidRegionName } from "@/lib/cityResolver";

interface CityJsonLdProps {
  cityName: string;
  stateName?: string;
  countryName?: string;
  lat: number;
  lon: number;
  pageType?: "time" | "weather" | "dashboard";
}

export default function CityJsonLd({
  cityName,
  stateName,
  countryName = "United States",
  lat,
  lon,
  pageType = "dashboard",
}: CityJsonLdProps) {
  const validAdmin = isValidRegionName(stateName) ? stateName : undefined;
  const locationLabel = [cityName, validAdmin, countryName].filter(Boolean).join(", ");

  const cleanSlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const pageUrl = `https://www.livetimedata.com/${pageType === "weather" ? "weather" : "time"}/${cleanSlug}`;

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "City",
        "@id": `${pageUrl}#city`,
        "name": cityName,
        "containedInPlace": validAdmin
          ? {
              "@type": "AdministrativeArea",
              "name": validAdmin,
            }
          : {
              "@type": "Country",
              "name": countryName,
            },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": lat,
          "longitude": lon,
        },
        "description": `Current local time, weather forecast, live webcams, and community guide for ${locationLabel}.`,
        "url": pageUrl,
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "LiveTimeData",
            "item": "https://www.livetimedata.com",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": validAdmin || countryName,
            "item": `https://www.livetimedata.com/?search=${encodeURIComponent(validAdmin || countryName)}`,
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": cityName,
            "item": pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
}
