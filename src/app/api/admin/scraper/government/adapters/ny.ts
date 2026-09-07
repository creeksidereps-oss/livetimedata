import { GovCamera, StateAdapter } from "./types";

export const nyAdapter: StateAdapter = {
  id: "NY",
  name: "New York DOT (511NY)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      const res = await fetch(`https://511ny.org/api/getcameras?format=json`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (!res.ok) throw new Error(`511NY API returned ${res.status}`);
      const data = await res.json();

      for (const cam of data) {
        if (cam.Disabled || cam.Blocked) continue;
        if (!cam.Url) continue;

        let title = cam.Name || "NY Camera";
        if (cam.RoadwayName) {
          title = `${cam.RoadwayName} - ${title}`;
        }

        cameras.push({
          cityName: "New York State", // 511NY doesn't provide explicit city names, but Geocoding will fix it via lat/lng later if needed.
          stateName: "NY",
          title: title,
          source: "511NY",
          imageUrl: cam.Url, // Returns an image natively
          embedUrl: cam.VideoUrl || null // Sometimes they have a VideoUrl
        });
      }
    } catch (e) {
      console.error("[NY ADAPTER] Error:", e);
    }
    return cameras;
  }
};
