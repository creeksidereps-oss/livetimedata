// src/app/page.tsx
import CityDashboardClient from "./city-dashboard/ui";

export default function HomePage() {
  // Render the SAME UI as /city-dashboard so Popular Cities works the same.
  // Use "any" so TypeScript won't block the build if the component props changed.
  const AnyDashboard: any = CityDashboardClient;

  return <AnyDashboard />;
}