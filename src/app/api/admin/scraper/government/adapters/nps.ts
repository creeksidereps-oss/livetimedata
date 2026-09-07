import { GovCamera, StateAdapter } from "./types";

export const npsAdapter: StateAdapter = {
  id: "NPS",
  name: "National Park Service",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const npsApiKey = process.env.NPS_API_KEY;
    if (!npsApiKey) {
      console.log("[NPS ADAPTER] No NPS_API_KEY found. Skipping.");
      return [];
    }

    const cameras: GovCamera[] = [];
    try {
      const res = await fetch(`https://developer.nps.gov/api/v1/webcams?limit=1000`, {
        headers: { "X-Api-Key": npsApiKey }
      });
      if (!res.ok) throw new Error(`NPS API returned ${res.status}`);
      const data = await res.json();

      for (const cam of data.data) {
        if (cam.status === "Inactive" && !cam.isStreaming) continue; // Skip truly inactive ones

        const imageUrl = cam.images && cam.images.length > 0 ? cam.images[0].url : null;
        
        cameras.push({
          cityName: cam.relatedParks && cam.relatedParks.length > 0 ? cam.relatedParks[0].fullName : (cam.parkCode || "NPS"),
          stateName: cam.relatedParks && cam.relatedParks.length > 0 ? cam.relatedParks[0].states.split(',')[0] : "US",
          title: cam.title || "National Park Cam",
          source: "NPS API",
          imageUrl: imageUrl,
          embedUrl: null // Wait for YouTube cross-referencer
        });
      }
    } catch (e) {
      console.error("[NPS ADAPTER] Error:", e);
    }
    return cameras;
  }
};
