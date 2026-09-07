import { GovCamera, StateAdapter } from "./types";

export const caAdapter: StateAdapter = {
  id: "CA",
  name: "California DOT (Caltrans)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      const res = await fetch("https://gis.data.ca.gov/api/download/v1/items/450df5bed93c4558a7264b7ef64187e6/geojson?layers=0", {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      
      if (!res.ok) throw new Error(`California API returned ${res.status}`);
      const data = await res.json();

      if (!data.features || !Array.isArray(data.features)) {
        throw new Error("California API returned invalid format");
      }

      for (const feature of data.features) {
        const props = feature.properties;
        if (!props) continue;
        
        if (props.inService === "False" || props.inService === false) continue;

        let embedUrl = props.streamingVideoURL || props.currentImageURL;
        if (!embedUrl) continue;

        cameras.push({
          cityName: props.nearbyPlace || props.county || "California",
          stateName: "CA",
          title: props.locationName || `${props.route || "CA"} Camera`,
          source: "Caltrans",
          imageUrl: props.currentImageURL || null,
          embedUrl: embedUrl
        });
      }
    } catch (e) {
      console.error("[CA ADAPTER] Error:", e);
    }
    return cameras;
  }
};
