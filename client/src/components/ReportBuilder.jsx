import React, { useState } from "react";

const DEFAULT_SECTIONS = {
  client: true,
  installation: true,
  workers: true,
  equipment: true,
  payments: true,
  photos: true,
};

export default function ReportBuilder({ installationCustomId }) {
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [lastTimeMs, setLastTimeMs] = useState(null);

  const toggle = (key) => setSections((p) => ({ ...p, [key]: !p[key] }));

  const generateReport = async () => {
    setLoading(true);
    setLastTimeMs(null);

    try {
      const res = await fetch(`/api/reports/${installationCustomId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to generate");
      }

      const timeHeader = res.headers.get("X-Report-Time-ms");
      if (timeHeader) setLastTimeMs(Number(timeHeader));

      const blob = await res.blob();

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e) {
      console.error(e);
      alert("Помилка генерації звіту");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "75vh", gap: 20 }}>
      {/* LEFT */}
      <div style={{ width: 300, borderRight: "1px solid #ddd", padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Конструктор звіту</h3>
        <div style={{ marginBottom: 10, color: "#555" }}>
          Обʼєкт: <b>{installationCustomId}</b>
        </div>

        {[
          ["client", "Клієнт"],
          ["installation", "Обʼєкт"],
          ["workers", "Робочі дні"],
          ["equipment", "Обладнання"],
          ["payments", "Платежі"],
          ["photos", "Фото"],
        ].map(([key, label]) => (
          <label key={key} style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={sections[key]}
              onChange={() => toggle(key)}
            />{" "}
            {label}
          </label>
        ))}

        <button
          onClick={generateReport}
          disabled={loading}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "10px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Генерація..." : "Згенерувати звіт"}
        </button>

        {lastTimeMs !== null && (
          <div style={{ marginTop: 10, color: "#666" }}>
            Час генерації: {(lastTimeMs / 1000).toFixed(1)} с
          </div>
        )}

        {pdfUrl && (
          <a
            href={pdfUrl}
            download={`report_${installationCustomId}.pdf`}
            style={{ display: "block", marginTop: 12, textAlign: "center" }}
          >
            ⬇ Завантажити PDF
          </a>
        )}
      </div>

      {/* RIGHT */}
      <div style={{ flex: 1, padding: 16 }}>
        {!pdfUrl && !loading && (
          <div style={{ color: "#888" }}>
            Натисни «Згенерувати звіт», щоб побачити превʼю.
          </div>
        )}

        {loading && <div>Формується PDF…</div>}

        {pdfUrl && (
          <iframe
            src={pdfUrl}
            title="PDF Preview"
            style={{
              width: "100%",
              height: "100%",
              border: "1px solid #ccc",
            }}
          />
        )}
      </div>
    </div>
  );
}
