// Componente reutilizable — puede vivir en su propio archivo (DetailField.jsx)
function DetailField({ icon: Icon, label, value }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
      }}
    >
      <Icon size={14} color="var(--accent-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            marginBottom: 1,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
        <div
          style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}
          title={typeof value === "string" ? value : undefined}
        >
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, fields }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        {fields.map((field) => (
          <DetailField key={field.id} {...field} />
        ))}
      </div>
    </div>
  );
}