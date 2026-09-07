import { GovCamera, StateAdapter } from "./types";

export const waAdapter: StateAdapter = {
  id: "WA",
  name: "Washington DOT (WSDOT)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      const apiKey = process.env.WA_API_KEY;
      if (!apiKey) throw new Error("WA_API_KEY is not defined in .env.local");

      const res = await fetch(`https://www.wsdot.wa.gov/Traffic/api/HighwayCameras/HighwayCamerasREST.svc/GetCamerasAsJson?AccessCode=${apiKey}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      
      if (!res.ok) throw new Error(`Washington API returned ${res.status}`);
      const data = await res.json();

      for (const cam of data) {
        if (!cam.IsActive) continue;
        
        let roadName = cam.CameraLocation?.RoadName || "Washington";

        cameras.push({
          cityName: roadName,
          stateName: "WA",
          title: cam.Title || cam.Description || `${roadName} Camera`,
          source: "WSDOT",
          imageUrl: cam.ImageURL, 
          embedUrl: null // Using static image for WA
        });
      }
    } catch (e) {
      console.error("[WA ADAPTER] Error:", e);
    }
    return cameras;
  }
};
