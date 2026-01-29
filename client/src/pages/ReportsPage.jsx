import React, { useState } from "react";
import ReportBuilder from "../components/ReportBuilder";

export default function ReportsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [found, setFound] = useState(null);
  const [foundClient, setFoundClient] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");

  const search = async () => {
    setLoading(true);
    setError("");
    setFound(null);
    setFoundClient(null);

    try {
      const res = await fetch(`/api/by-custom-id/${query}`);

      if (!res.ok) {
        setError("Обʼєкт не знайдено");
        return;
      }

      const data = await res.json();

      // підтримка двох форматів відповіді:
      // 1) { found:true, installation:{...}, client:{...} }
      // 2) { found:true, installation:{...} }
      if (!data?.found || !data?.installation) {
        setError("Обʼєкт не знайдено");
        return;
      }

      setFound(data.installation);
      setFoundClient(data.client || null);
    } catch (e) {
      console.error(e);
      setError("Помилка пошуку");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Генерація звіту</h2>

      {!selectedId && (
        <div style={{ maxWidth: 520 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            Custom ID обʼєкта
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Наприклад: 4386"
              style={{ flex: 1, padding: 10 }}
            />
            <button onClick={search} disabled={loading || !query}>
              {loading ? "Пошук..." : "Знайти"}
            </button>
          </div>

          {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}

          {found && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                border: "1px solid #ccc",
                borderRadius: 6,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <strong>{found.name || "Без назви"}</strong>
              </div>

              <div style={{ color: "#444" }}>
                ID: {found.custom_id}
                {" • "}
                {foundClient?.populated_place || "—"}
              </div>

              <button
                style={{ marginTop: 12 }}
                onClick={() => setSelectedId(found.custom_id)}
              >
                ✔ Використати цей обʼєкт
              </button>
            </div>
          )}
        </div>
      )}

      {selectedId && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{ marginBottom: 16 }}
          >
            ← Змінити обʼєкт
          </button>

          <ReportBuilder installationCustomId={selectedId} />
        </div>
      )}
    </div>
  );
}
