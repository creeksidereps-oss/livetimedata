// src/app/page.tsx

import CityDashboardClient from "./city-dashboard/CityDashboardClient";

export default function HomePage() {
  return (
    <CityDashboardClient
      initialQuery=""
      autoPickFirst={false}
    />
  );
}