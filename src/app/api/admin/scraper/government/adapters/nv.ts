import { GovCamera, StateAdapter } from "./types";

export const nvAdapter: StateAdapter = {
  id: "NV",
  name: "Nevada DOT (NV511)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      const apiKey = process.env.NV_API_KEY;
      if (!apiKey) throw new Error("NV_API_KEY is not defined in .env.local");

      const res = await fetch(`https://nvroads.com/api/v2/get/cameras?key=${apiKey}&format=json`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      
      if (!res.ok) throw new Error(`Nevada API returned ${res.status}`);
      const data = await res.json();

      for (const cam of data) {
        if (!cam.Views || cam.Views.length === 0) continue;
        
        let view = cam.Views[0];
        if (view.Status !== "Active" && view.Status !== "Enabled" && !view.VideoUrl) {
           // It might say "Disabled" but still have a VideoUrl
           if (!view.VideoUrl && !view.Url) continue;
        }

        cameras.push({
          cityName: cam.Roadway || "Nevada",
          stateName: "NV",
          title: view.Description || cam.Roadway || "Nevada Camera",
          source: "NVDOT",
          imageUrl: null, 
          embedUrl: view.VideoUrl || view.Url || null
        });
      }
    } catch (e) {
      console.error("[NV ADAPTER] Error:", e);
    }
    return cameras;
  }
};
