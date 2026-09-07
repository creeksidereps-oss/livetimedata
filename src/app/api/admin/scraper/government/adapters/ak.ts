import { GovCamera, StateAdapter } from "./types";

export const akAdapter: StateAdapter = {
  id: "AK",
  name: "Alaska DOT (AK511)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      const apiKey = process.env.AK_API_KEY;
      if (!apiKey) throw new Error("AK_API_KEY is not defined in .env.local");

      const res = await fetch(`https://511.alaska.gov/api/v2/get/cameras?key=${apiKey}&format=json`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      
      if (!res.ok) throw new Error(`Alaska API returned ${res.status}`);
      const data = await res.json();

      for (const cam of data) {
        if (!cam.Views || cam.Views.length === 0) continue;
        
        let view = cam.Views[0];
        if (view.Status !== "Active" && view.Status !== "Enabled" && !view.VideoUrl && !view.Url) {
           continue;
        }

        cameras.push({
          cityName: cam.Roadway || "Alaska",
          stateName: "AK",
          title: cam.Location || cam.Roadway || "Alaska Camera",
          source: "AKDOT",
          imageUrl: null, 
          embedUrl: view.VideoUrl || view.Url || null
        });
      }
    } catch (e) {
      console.error("[AK ADAPTER] Error:", e);
    }
    return cameras;
  }
};
