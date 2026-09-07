import { GovCamera, StateAdapter } from "./types";

export const iaAdapter: StateAdapter = {
  id: "IA",
  name: "Iowa DOT (511IA)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      let offset = 0;
      const url = "https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0/query";
      
      while (true) {
        const query = `${url}?where=1%3D1&outFields=*&outSR=4326&f=json&resultOffset=${offset}&resultRecordCount=1000`;
        const res = await fetch(query, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        
        if (!res.ok) throw new Error(`Iowa API returned ${res.status}`);
        const data = await res.json();

        if (!data.features || !Array.isArray(data.features)) {
          throw new Error("Iowa API returned invalid format");
        }

        for (const feature of data.features) {
          const props = feature.attributes;
          if (!props) continue;

          let embedUrl = props.VideoURL || props.ImageURL;
          if (!embedUrl) continue;

          cameras.push({
            cityName: props.REGION || "Iowa",
            stateName: "IA",
            title: props.Desc_ || props.ImageName || "Iowa Camera",
            source: "IADOT",
            imageUrl: props.ImageURL || null,
            embedUrl: embedUrl
          });
        }

        if (data.features.length < 1000) break;
        offset += data.features.length;
      }
    } catch (e) {
      console.error("[IA ADAPTER] Error:", e);
    }
    return cameras;
  }
};
