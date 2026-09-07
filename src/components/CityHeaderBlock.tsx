type Props = {
  cityName: string;
  countryName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  admin1?: string | null;
};

function buildFullLocation(
  city: string,
  admin1?: string | null,
  country?: string | null
) {
  const parts = [city];

  if (admin1 && admin1.trim()) {
    parts.push(admin1.trim());
  }

  if (country && country.trim()) {
    parts.push(country.trim());
  }

  return parts.join(", ");
}

export default function CityHeaderBlock({
  cityName,
  countryName,
  countryCode,
  latitude,
  longitude,
  admin1,
}: Props) {
  const fullLocation = buildFullLocation(
    cityName,
    admin1,
    countryName || countryCode
  );

  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        marginBottom: "12px",
        background: "#fff",
        boxShadow: "0 4px 12px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          fontSize: "19px",
          fontWeight: 700,
          lineHeight: 1.2,
          color: "#111827",
          marginBottom: "4px",
        }}
      >
        {fullLocation}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          lineHeight: 1.3,
        }}
      >
        {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </div>
    </div>
  );
}