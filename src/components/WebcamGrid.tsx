"use client";

import { useEffect, useState } from "react";

type Webcam = {
  id: string;
  kind: string;
  title: string;
  embedUrl?: string | null;
  imageUrl?: string | null;
};

type Props = {
  latitude: number;
  longitude: number;
};

export default function WebcamGrid({ latitude, longitude }: Props) {
  const [webcams, setWebcams] = useState<Webcam[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/webcams?lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      if (data.ok || data.webcams) {
        setWebcams(data.webcams);
      }
    }
    load();
  }, [latitude, longitude]);

  const trackView = async (id: string) => {
    if (id.includes("fallback") || id.includes("map")) return;
    await fetch("/api/webcams/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, actionType: "view" }),
    });
  };

  return (
    <section style={{ marginTop: "24px" }}>
      <h2 style={{ marginBottom: "12px", fontSize: "14px", fontWeight: 900, textTransform: "uppercase" }}>Nearby Cameras</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
        {webcams.map((cam) => (
          <div
            key={cam.id}
            onClick={() => trackView(cam.id)}
            style={{ border: "1px solid #e5e7eb", borderRadius: "16px", overflow: "hidden", background: "#ffffff" }}
          >
            <div style={{ padding: "10px", fontWeight: 600, fontSize: "14px" }}>{cam.title}</div>
            {cam.embedUrl ? (
              <iframe src={cam.embedUrl} width="100%" height="220" loading="lazy" style={{ border: "none" }} />
            ) : (
              <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", fontSize: "13px", color: "#6b7280" }}>
                Camera source loading soon
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}