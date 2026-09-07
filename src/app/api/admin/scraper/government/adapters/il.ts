import { GovCamera, StateAdapter } from "./types";

export const ilAdapter: StateAdapter = {
  id: "IL",
  name: "Illinois DOT (IDOT Gateway)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      let offset = 0;
      const url = "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0/query";
      
      while (true) {
        const query = `${url}?where=1%3D1&outFields=*&outSR=4326&f=json&resultOffset=${offset}&resultRecordCount=1000`;
        const res = await fetch(query, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        
        if (!res.ok) throw new Error(`Illinois API returned ${res.status}`);
        const data = await res.json();

        if (!data.features || !Array.isArray(data.features)) {
          throw new Error("Illinois API returned invalid format");
        }

        for (const feature of data.features) {
          const props = feature.attributes;
          if (!props) continue;
          
          if (props.TooOld === "true" || props.TooOld === true) continue;

          let embedUrl = props.SnapShot;
          if (!embedUrl) continue;

          cameras.push({
            cityName: "Illinois",
            stateName: "IL",
            title: props.CameraLocation || "Illinois Camera",
            source: "IDOT",
            imageUrl: props.SnapShot || null,
            embedUrl: embedUrl
          });
        }

        if (data.features.length < 1000) break;
        offset += data.features.length;
      }
    } catch (e) {
      console.error("[IL ADAPTER] Error:", e);
    }
    return cameras;
  }
};
