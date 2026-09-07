import { GovCamera, StateAdapter } from "./types";

export const flAdapter: StateAdapter = {
  id: "FL",
  name: "Florida DOT (FL511)",
  fetchCameras: async (): Promise<GovCamera[]> => {
    const cameras: GovCamera[] = [];
    try {
      let start = 0;
      const length = 100; // FL511 DataTables endpoint caps at 100
      let totalRecords = 100; // Dummy initial value to enter the loop

      while (start < totalRecords) {
        const params = new URLSearchParams();
        params.append('draw', '1');
        params.append('start', start.toString());
        params.append('length', length.toString());

        const res = await fetch("https://fl511.com/List/GetData/Cameras", {
          method: "POST",
          body: params,
          headers: {
             "Content-Type": "application/x-www-form-urlencoded",
             "User-Agent": "Mozilla/5.0"
          }
        });
        
        if (!res.ok) throw new Error(`Florida API returned ${res.status}`);
        const data = await res.json();

        if (!data.data || !Array.isArray(data.data)) {
          throw new Error("Florida API returned invalid format");
        }

        totalRecords = data.recordsTotal; // Server returns true total (e.g., 4902)
        const returnedCount = data.data.length;

        if (returnedCount === 0) break; // Break out if no data to prevent infinite loop

        for (const cam of data.data) {
          if (!cam.images || cam.images.length === 0) continue;
          
          let view = cam.images[0];
          if (view.disabled || view.blocked) continue;

          let embedUrl = view.videoUrl || (view.imageUrl ? `https://fl511.com${view.imageUrl}` : null);
          if (!embedUrl) continue;

          cameras.push({
            cityName: cam.county || cam.roadway || "Florida",
            stateName: "FL",
            title: cam.location || cam.roadway || "Florida Camera",
            source: "FLDOT",
            imageUrl: view.imageUrl ? `https://fl511.com${view.imageUrl}` : null,
            embedUrl: embedUrl
          });
        }

        start += returnedCount;
      }
    } catch (e) {
      console.error("[FL ADAPTER] Error:", e);
    }
    return cameras;
  }
};
