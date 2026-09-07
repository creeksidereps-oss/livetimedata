import { ReactNode } from "react";

type CityPageLayoutProps = {
  topLeft: ReactNode;
  topRight: ReactNode;
  lowerLeft: ReactNode;
  lowerRight: ReactNode;
};

export default function CityPageLayout({
  topLeft,
  topRight,
  lowerLeft,
  lowerRight,
}: CityPageLayoutProps) {
  return (
    <section style={{ marginTop: "20px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.65fr) minmax(320px, 0.95fr)",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            minWidth: 0,
          }}
        >
          {topLeft}

          <div style={{ marginTop: "24px" }}>{lowerLeft}</div>
        </div>

        <div
          style={{
            minWidth: 0,
          }}
        >
          {topRight}

          <div style={{ marginTop: "24px" }}>{lowerRight}</div>
        </div>
      </div>
    </section>
  );
}