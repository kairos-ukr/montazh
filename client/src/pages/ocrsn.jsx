import React, { useMemo, useState } from "react";

const OCR_ENDPOINT = "https://api.ocr.space/parse/image";

// ⛔️ Для тесту на localhost. Потім перенесеш на бекенд.
const OCR_API_KEY = "K84676570888957";

/* -------------------- helpers -------------------- */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeText(t = "") {
  return t
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐-–—]/g, "-")
    .replace(/[|]/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSerialCandidate(s = "") {
  let x = s.trim();
  x = x.replace(/^[\s:;_\-/]+|[\s:;_\-/]+$/g, "");
  x = x.replace(/\s+/g, "");
  x = x.replace(/[—–]/g, "-");
  return x.toUpperCase();
}

/* -------------------- BRAND + MODEL (SOLAX battery: Model No.) -------------------- */

function detectBrandModel(ocrTextRaw) {
  const raw = normalizeText(ocrTextRaw);
  const t = raw.toUpperCase();

  // 1) BRAND DETECTION
  let brand = null;

  if (/\bDEYE\b/.test(t) || /\bSUN-[A-Z0-9/-]{4,}\b/.test(t)) brand = "DEYE";
  if (!brand && (/\bSOLIS\b/.test(t) || /\bGINLONG\b/.test(t))) brand = "SOLIS";
  if (!brand && (/\bSOLAX\b/.test(t) || /\bX[13]-/.test(t))) brand = "SOLAX";

  // 2) MODEL HELPERS
  const cleanModel = (m) => {
    if (!m) return null;
    let x = String(m)
      .replace(/^[\s:;#]+/, "")
      .replace(/[\s,;#]+$/, "")
      .trim();

    x = x.replace(/\s+/g, " ");

    const codeLike = /^[A-Z0-9][A-Z0-9./_-]+\s+[A-Z0-9][A-Z0-9./_-]+$/i.test(x);
    if (codeLike) x = x.replace(/\s+/g, "");

    return x;
  };

  const cutAtNextField = (s) => {
    if (!s) return s;
    return s
      .split(/\b(SERIAL|S\/N|SN|INPUT|OUTPUT|AC|DC|POWER|RATED|MPPT|VOLT|CURRENT|FREQ|HZ)\b/i)[0]
      .split(/[\n\r]/)[0]
      .trim();
  };

  const patternsByBrand = {
    SOLAX: [
      // ✅ батареї/часто: Model No.:
      /\bMODEL\b\s*(?:NO|N0|NUMBER)?\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i,
      // Model:
      /\bMODEL\b\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i,
      // Model Name:
      /\bMODEL\s*NAME\b\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i,
      // fallback
      /\b(X[13]-[A-Z0-9/-]{3,})\b/i,
    ],
    DEYE: [
      /\bMODEL\b\s*(?:NO|N0|NUMBER)?\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i,
      /\bMODEL\s*(?:NO|N0)\b\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i,
      /\b(SUN-[A-Z0-9/-]{5,})\b/i,
    ],
    SOLIS: [
      /\bMODEL\b\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i,
      /\bMODEL\b\s*(?:NO|N0|NUMBER)?\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i,
      /\b(S[56]-[A-Z0-9/-]{3,})\b/i,
    ],
  };

  const tryPatterns = (patterns) => {
    for (const re of patterns) {
      const m = raw.match(re);
      if (m && m[1]) {
        const cut = cutAtNextField(m[1]);
        const cleaned = cleanModel(cut);
        if (cleaned && cleaned.length >= 3) return cleaned;
      }
    }
    return null;
  };

  let model = null;
  if (brand && patternsByBrand[brand]) model = tryPatterns(patternsByBrand[brand]);

  if (!model) {
    const generic =
      raw.match(/\bMODEL(?:\s*(?:NO|N0|NUMBER))?\.?\b\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i) ||
      raw.match(/\bTYPE\b\s*[:#]?\s*([A-Z0-9][A-Z0-9 ./_-]{2,})/i);

    if (generic && generic[1]) model = cleanModel(cutAtNextField(generic[1]));
  }

  return { brand, model };
}

/* -------------------- SN extraction (best only) -------------------- */

function scoreSerialCandidate(value, source, ocrUpperText, brand) {
  let score = 0;

  if (source === "label") score += 60;
  else score += 10;

  if (value.length >= 10) score += 15;
  if (value.length >= 14) score += 10;
  if (value.length > 24) score -= 10;

  const hasLetters = /[A-Z]/.test(value);
  const hasDigits = /\d/.test(value);
  if (hasLetters && hasDigits) score += 12;
  else if (hasDigits && !hasLetters) score += 6;

  if (ocrUpperText.includes("SN") || ocrUpperText.includes("SERIAL")) score += 5;

  if (/^0+$/.test(value)) score -= 50;
  if (/^[A-Z]+$/.test(value)) score -= 10;

  if (brand === "DEYE" && value.length >= 12) score += 4;
  if (brand === "SOLAX" && /[/-]/.test(value)) score += 3;
  if (brand === "SOLIS" && /[/-]/.test(value)) score += 2;

  return score;
}

function getBestSerialFromText(ocrTextRaw, brand) {
  const text = normalizeText(ocrTextRaw);
  const upper = text.toUpperCase();

  const candidates = [];

  const labelRegexes = [
    /\bS\s*\/\s*N\b\s*[:#]?\s*([A-Z0-9][A-Z0-9_/\-\s]{3,})/gi,
    /\bSN\b\s*[:#]?\s*([A-Z0-9][A-Z0-9_/\-\s]{3,})/gi,
    /\bSERIAL(?:\s*(?:NO|NUMBER))?\b\s*[:#]?\s*([A-Z0-9][A-Z0-9_/\-\s]{3,})/gi,
    /\bS\/N\s*NO\b\s*[:#]?\s*([A-Z0-9][A-Z0-9_/\-\s]{3,})/gi,
  ];

  function takeReasonableToken(raw) {
    const x = (raw || "").trim();
    const cut = x.split(/[\n\r,;()]/)[0].trim();
    const parts = cut.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return cut;

    const joined2 = (parts[0] || "") + (parts[1] || "");
    if (/^[A-Z0-9][A-Z0-9_/\-]{6,}$/.test(joined2)) return joined2;

    return parts[0];
  }

  for (const re of labelRegexes) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const token = takeReasonableToken(m[1]);
      const norm = normalizeSerialCandidate(token);
      if (norm.length >= 4) candidates.push({ value: norm, source: "label" });
    }
  }

  const genericMatches = upper.match(/\b[A-Z0-9][A-Z0-9_/\-]{7,}\b/g) || [];
  for (const g of genericMatches) {
    const norm = normalizeSerialCandidate(g);
    if (/^(IP\d+|UKCA|CE|ROHS|FCC|HZ|VAC|VDC|AC|DC|KW|KVA|W|V|A)$/i.test(norm)) continue;
    if (/^\d{1,6}(V|W|A|HZ|KW|KVA)$/i.test(norm)) continue;
    candidates.push({ value: norm, source: "generic" });
  }

  // unique
  const map = new Map();
  for (const c of candidates) if (!map.has(c.value)) map.set(c.value, c);

  const unique = Array.from(map.values());
  const scored = unique.map((c) => ({
    ...c,
    score: scoreSerialCandidate(c.value, c.source, upper, brand),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.value || "";
}

/* -------------------- compression + download -------------------- */

async function compressImageToLimit(
  file,
  {
    maxBytes = 950 * 1024, // fixed
    maxSide = 2200,        // fixed
    mime = "image/jpeg",
    initialQuality = 0.85,
    minQuality = 0.32,
  } = {}
) {
  if (!file || !file.type?.startsWith("image/")) return file;

  // ✅ if <= limit - no compression
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  const largest = Math.max(width, height);
  if (largest > maxSide) {
    const scale = maxSide / largest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  const toBlob = (q, type = mime) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

  let blob = await toBlob(initialQuality, mime);
  if (!blob) return file;

  if (blob.size > maxBytes) {
    let lo = minQuality;
    let hi = initialQuality;
    let best = blob;

    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const b = await toBlob(mid, mime);
      if (!b) break;

      if (b.size <= maxBytes) {
        best = b;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    blob = best;
  }

  if (blob.size > maxBytes) {
    const webp = await toBlob(0.62, "image/webp");
    if (webp && webp.size < blob.size) blob = webp;
  }

  while (blob.size > maxBytes && canvas.width > 600) {
    canvas.width = Math.round(canvas.width * 0.88);
    canvas.height = Math.round(canvas.height * 0.88);

    const ctx2 = canvas.getContext("2d");
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = "high";
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    ctx2.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const b = await toBlob(minQuality, mime);
    if (!b) break;
    blob = b;
  }

  const ext = blob.type === "image/webp" ? ".webp" : ".jpg";
  const outName = file.name.replace(/\.\w+$/, "") + ".compressed" + ext;
  return new File([blob], outName, { type: blob.type });
}

function autoDownloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name || "compressed.jpg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* -------------------- OCR call with retry/fallback -------------------- */

function isTimeoutE101(data) {
  const msg = `${data?.ErrorMessage || ""} ${data?.ErrorDetails || ""}`;
  return /E101/i.test(msg) || /timed out/i.test(msg);
}

async function callOcrWithFallback({
  file,
  apikey,
  language,
  engine,
  scale,
  detectOrientation,
  isTable,
}) {
  const plan = [];
  if (engine) plan.push(String(engine));
  if (!plan.includes("2")) plan.push("2");
  if (!plan.includes("1")) plan.push("1");

  let lastErr = null;

  for (const eng of plan) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const form = new FormData();
        form.append("file", file, file.name);
        form.append("language", language);
        form.append("OCREngine", eng);
        form.append("scale", String(scale));
        form.append("detectOrientation", String(detectOrientation));
        form.append("isTable", String(isTable));
        form.append("isOverlayRequired", "false");

        const res = await fetch(OCR_ENDPOINT, {
          method: "POST",
          headers: { apikey },
          body: form,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          lastErr = { type: "http", eng, attempt, httpStatus: res.status, data };
          if (res.status >= 500) {
            await sleep(500 * attempt);
            continue;
          }
          return { ok: false, engineUsed: eng, data, httpStatus: res.status };
        }

        if (data?.IsErroredOnProcessing) {
          if (isTimeoutE101(data)) {
            lastErr = { type: "timeout", eng, attempt, data };
            await sleep(600 * attempt);
            continue;
          }
          return { ok: false, engineUsed: eng, data, httpStatus: 200 };
        }

        return { ok: true, engineUsed: eng, data, httpStatus: 200 };
      } catch (e) {
        lastErr = { type: "network", eng, attempt, error: String(e?.message || e) };
        await sleep(600 * attempt);
      }
    }
  }

  return { ok: false, engineUsed: null, data: lastErr, httpStatus: null };
}

/* -------------------- UI styles -------------------- */

const styles = {
  page: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    padding: 18,
    maxWidth: 860,
    margin: "0 auto",
    color: "#0f172a",
  },
  header: {
    margin: "0 0 14px",
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  card: {
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  cardBody: { padding: 14 },
  controlsRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  fileInputWrap: {
    flex: "1 1 260px",
    border: "1px dashed rgba(15,23,42,0.25)",
    borderRadius: 12,
    padding: "10px 12px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    background: "rgba(15,23,42,0.02)",
  },
  fileMeta: { fontSize: 12, color: "rgba(15,23,42,0.75)" },
  button: {
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    background: "#0f172a",
    color: "#fff",
    boxShadow: "0 8px 18px rgba(15,23,42,0.18)",
    transition: "transform 0.05s ease",
  },
  buttonDisabled: { opacity: 0.6, cursor: "not-allowed" },
  toggle: { display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "rgba(15,23,42,0.8)" },
  hint: { fontSize: 12, color: "rgba(15,23,42,0.65)", marginTop: 10 },
  error: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.08)",
    color: "#7f1d1d",
    fontSize: 13,
    fontWeight: 600,
  },
  grid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  statCard: {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 14,
    background: "rgba(15,23,42,0.02)",
    padding: 14,
  },
  statLabel: { fontSize: 12, color: "rgba(15,23,42,0.65)", marginBottom: 6 },
  statValue: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  smallLine: { fontSize: 12, color: "rgba(15,23,42,0.65)", marginTop: 8 },
};

function fmtKB(bytes) {
  if (!bytes) return "0 KB";
  return `${Math.round(bytes / 1024)} KB`;
}

/* -------------------- Page -------------------- */

export default function OCRSNPage() {
  const [file, setFile] = useState(null);

  // OCR settings (leave as is)
  const [engine, setEngine] = useState("3");
  const [language, setLanguage] = useState("eng");
  const [scale, setScale] = useState(true);
  const [detectOrientation, setDetectOrientation] = useState(true);
  const [isTable, setIsTable] = useState(false);

  // fixed compression settings
  const MAX_BYTES = 950 * 1024;
  const MAX_SIDE = 2200;

  const [autoDownloadCompressed, setAutoDownloadCompressed] = useState(false);

  const [beforeSize, setBeforeSize] = useState(0);
  const [afterSize, setAfterSize] = useState(0);

  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [error, setError] = useState("");
  const [engineUsed, setEngineUsed] = useState("");

  const { brand, model } = useMemo(() => detectBrandModel(ocrText), [ocrText]);

  const serial = useMemo(() => {
    if (!ocrText) return "";
    return getBestSerialFromText(ocrText, brand);
  }, [ocrText, brand]);

  async function runOcr() {
    setError("");
    setOcrText("");
    setEngineUsed("");
    setBeforeSize(0);
    setAfterSize(0);

    if (!file) {
      setError("Вибери фото.");
      return;
    }
    if (!OCR_API_KEY || OCR_API_KEY.includes("PUT_YOUR")) {
      setError("Вкажи OCR API key у OCR_API_KEY.");
      return;
    }

    setLoading(true);
    try {
      setBeforeSize(file.size);

      const processedFile = await compressImageToLimit(file, {
        maxBytes: MAX_BYTES,
        maxSide: MAX_SIDE,
        mime: "image/jpeg",
        initialQuality: 0.85,
        minQuality: 0.32,
      });

      setAfterSize(processedFile.size);

      if (processedFile.size > MAX_BYTES) {
        setError(`Не вдалося влізти в ліміт 950KB. Спробуй інше фото.`);
        return;
      }

      const wasCompressed = processedFile !== file;
      if (autoDownloadCompressed && wasCompressed) {
        autoDownloadFile(processedFile);
      }

      const result = await callOcrWithFallback({
        file: processedFile,
        apikey: OCR_API_KEY,
        language,
        engine,
        scale,
        detectOrientation,
        isTable,
      });

      setEngineUsed(result.engineUsed || "");

      if (!result.ok) {
        if (result.data?.ErrorMessage || result.data?.ErrorDetails) {
          setError(`${result.data.ErrorMessage || "OCR error"} ${result.data.ErrorDetails || ""}`.trim());
        } else {
          setError("OCR не відповів або таймаут. Спробуй ще раз / інший Engine.");
        }
        return;
      }

      const parsed = (result.data?.ParsedResults || [])
        .map((p) => p?.ParsedText || "")
        .join("\n\n");

      const finalText = normalizeText(parsed);
      setOcrText(finalText);

      if (!finalText) setError("OCR повернув порожній текст. Спробуй інше фото або інший Engine.");
    } catch (e) {
      setError(e?.message || "Невідома помилка.");
    } finally {
      setLoading(false);
    }
  }

  const fileName = file?.name || "Файл не вибрано";
  const fileSize = file?.size ? fmtKB(file.size) : "";

  const wasCompressed = beforeSize > 0 && afterSize > 0 && afterSize !== beforeSize;

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: 10 }}>
        <div style={styles.header}>OCR: Бренд · Модель · Серійний номер</div>
        <div style={{ fontSize: 13, color: "rgba(15,23,42,0.7)" }}>
          Ліміти: <b>950KB</b> та <b>2200px</b>. Якщо фото ≤ 950KB — стискання не виконується.
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardBody}>
          <div style={styles.controlsRow}>
            <div style={styles.fileInputWrap}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Фото шильдика / серійника</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{ width: "100%" }}
                />
                <div style={styles.fileMeta}>
                  {fileName}
                  {fileSize ? ` · ${fileSize}` : ""}
                </div>
              </div>
            </div>

            <button
              onClick={runOcr}
              disabled={loading || !file}
              style={{
                ...styles.button,
                ...(loading || !file ? styles.buttonDisabled : null),
              }}
              onMouseDown={(e) => {
                if (!loading && file) e.currentTarget.style.transform = "translateY(1px)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(0px)";
              }}
            >
              {loading ? "Зчитую..." : "Зчитати"}
            </button>

            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={autoDownloadCompressed}
                onChange={(e) => setAutoDownloadCompressed(e.target.checked)}
              />
              Скачати стиснене (якщо стискалось)
            </label>
          </div>

          {(beforeSize > 0 || afterSize > 0) && (
            <div style={styles.hint}>
              Було: <b>{fmtKB(beforeSize)}</b> → Стало: <b>{fmtKB(afterSize)}</b>
              {wasCompressed ? " (стиснено)" : " (без стискання)"} · Engine:{" "}
              <b>{engineUsed || "—"}</b>
            </div>
          )}

          {error && <div style={styles.error}>{error}</div>}
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Бренд</div>
          <div style={styles.statValue}>{brand || "—"}</div>
          <div style={styles.smallLine}>Автовизначення по тексту OCR.</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Модель</div>
          <div style={styles.statValue}>{model || "—"}</div>
          <div style={styles.smallLine}>
            SOLAX (в т.ч. батареї) — пріоритет <b>Model No.:</b> · DEYE — <b>Model No.:</b> · SOLIS — <b>Model:</b>
          </div>
        </div>

        <div style={{ ...styles.statCard, gridColumn: "1 / -1" }}>
          <div style={styles.statLabel}>Серійний номер (SN)</div>
          <div style={{ ...styles.statValue, fontSize: 22 }}>{serial || "—"}</div>
          <div style={styles.smallLine}>Показуємо тільки найкращий знайдений варіант.</div>
        </div>
      </div>

      {/* Якщо захочеш — можна потім додати “Скопіювати” кнопки поруч із полями */}
    </div>
  );
}