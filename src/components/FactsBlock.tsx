type FactsBlockProps = {
  cityName: string;
  countryName: string;
  latitude: number;
  longitude: number;
};

function getInterestingFacts(cityName: string, countryName: string) {
  return [
    `${cityName} is part of the broader story of ${countryName} and gives visitors a real sense of local place and scale.`,
    `Latitude and longitude make ${cityName} useful for geography, weather, and world-time learning.`,
    `Cities like ${cityName} are strong candidates for webcam, event, and travel discovery because they combine location context with live data.`,
    `${cityName} can be explored as both a utility destination and a discovery destination through time, weather, events, and live views.`,
  ];
}

function getOnThisDay(cityName: string) {
  return [
    `Today is a strong opportunity to explore what makes ${cityName} unique through local events, weather, and live cameras.`,
    `On this day, visitors can compare ${cityName}'s current time and conditions with cities around the world.`,
    `This date can later be expanded with historical events, local milestones, and holiday context tied to ${cityName}.`,
  ];
}

export default function FactsBlock({
  cityName,
  countryName,
  latitude,
  longitude,
}: FactsBlockProps) {
  const facts = getInterestingFacts(cityName, countryName);
  const onThisDay = getOnThisDay(cityName);

  const panelStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    background: "#fafaf9",
  };

  return (
    <section
      style={{
        marginTop: "12px",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "12px",
        background: "#ffffff",
        boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "12px",
        }}
      >
        <div style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "17px" }}>
            Quick Facts
          </h2>

          <div
            style={{
              fontSize: "13px",
              color: "#4b5563",
              marginBottom: "10px",
            }}
          >
            {cityName}, {countryName}
          </div>

          <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.5, fontSize: "13px" }}>
            {facts.map((fact, index) => (
              <li key={index} style={{ marginBottom: "6px" }}>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "17px" }}>
            On This Day
          </h2>

          <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.5, fontSize: "13px" }}>
            {onThisDay.map((item, index) => (
              <li key={index} style={{ marginBottom: "6px" }}>
                {item}
              </li>
            ))}
          </ul>

          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "#4b5563",
            }}
          >
            Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </div>
        </div>

        <div style={panelStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "17px" }}>
            Holidays
          </h2>

          <p style={{ marginTop: 0, lineHeight: 1.5, fontSize: "13px" }}>
            Holiday detection and holiday history will appear here next.
          </p>

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View Holiday
            </button>

            <button
              type="button"
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                borderRadius: "999px",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Holiday History
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}