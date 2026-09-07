import { GovCamera, StateAdapter } from "./types";

export const ncAdapter: StateAdapter = {
  id: "NC",
  name: "North Carolina DOT (DriveNC)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const driveNcApiKey = process.env.DRIVENC_API_KEY;
    if (!driveNcApiKey) {
      console.log("[NC ADAPTER] No DRIVENC_API_KEY found. Skipping.");
      return [];
    }

    const cameras: GovCamera[] = [];
    try {
      const res = await fetch(`https://www.drivenc.gov/api/v2/get/cameras?key=${driveNcApiKey}`);
      if (!res.ok) throw new Error(`DriveNC API returned ${res.status}`);
      const data = await res.json();
      const cams = Array.isArray(data) ? data : (data.features || []);

      for (const cam of cams) {
        if (!cam.Views || cam.Views.length === 0) continue;
        const view = cam.Views[0];
        if (view.Status !== "Enabled" || !view.Url) continue;

        cameras.push({
          cityName: cam.County || "Unknown",
          stateName: "NC",
          title: `NC DOT ${cam.Roadway} - ${view.Description || cam.Location}`,
          source: "DriveNC",
          imageUrl: view.Url,
          embedUrl: null // We skip YouTube check here to prevent Vercel timeouts!
        });
      }
    } catch (e) {
      console.error("[NC ADAPTER] Error:", e);
    }
    return cameras;
  }
};
