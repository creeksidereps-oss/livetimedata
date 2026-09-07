import { GovCamera, StateAdapter } from "./types";

export const mdAdapter: StateAdapter = {
  id: "MD",
  name: "Maryland DOT (CHART)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      const res = await fetch(`https://chart.maryland.gov/DataFeeds/GetCamerasJson`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (!res.ok) throw new Error(`Maryland API returned ${res.status}`);
      const data = await res.json();

      for (const cam of data) {
        if (cam.opStatus !== "OK") continue; // Skip broken cameras

        let title = cam.name || cam.description || "Maryland Camera";

        cameras.push({
          cityName: cam.cameraCategories && cam.cameraCategories.length > 0 ? cam.cameraCategories[0] : "Maryland",
          stateName: "MD",
          title: title,
          source: "MDOT",
          imageUrl: null, 
          embedUrl: cam.publicVideoURL // MD provides an HTML page for embedding
        });
      }
    } catch (e) {
      console.error("[MD ADAPTER] Error:", e);
    }
    return cameras;
  }
};
