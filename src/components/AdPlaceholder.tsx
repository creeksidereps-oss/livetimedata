type AdPlaceholderProps = {
  label?: string;
};

export default function AdPlaceholder({ label = "Sponsored" }: AdPlaceholderProps) {
  return (
    <section
      style={{
        border: "1px dashed #cbd5e1",
        borderRadius: "14px",
        minHeight: "76px",
        padding: "12px 14px",
        marginTop: "14px",
        background: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#475569",
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      Ad Slot — {label}
    </section>
  );
}