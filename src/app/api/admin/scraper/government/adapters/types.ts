export interface GovCamera {
  cityName: string;
  stateName: string;
  title: string;
  source: string;
  imageUrl: string | null;
  embedUrl: string | null;
}

export interface StateAdapter {
  id: string; // e.g. 'NC', 'NPS', 'FL'
  name: string; // e.g. 'North Carolina DOT'
  fetchCameras: () => Promise<GovCamera[]>;
}
