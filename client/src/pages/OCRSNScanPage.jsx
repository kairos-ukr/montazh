import React, { useState } from "react";

function fmtKB(bytes) {
  if (!bytes) return "0 KB";
  return `${Math.round(bytes / 1024)} KB`;
}

// --- COMPRESSION UTILS ---

async function compressImageToLimit(
  file,
  {
    maxBytes = 950 * 1024,
    maxSide = 2200,
    mime = "image/jpeg",
    initialQuality = 0.85,
    minQuality = 0.32,
  } = {}
) {
  if (!file || !file.type?.startsWith("image/")) return file;
  
  // Якщо менше 1MB - не чіпаємо, економимо CPU клієнта
  if (file.size < 1024 * 1024) return file; 
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
  // High quality resize
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  const toBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, mime, q));

  let blob = await toBlob(initialQuality);
  
  // Простий цикл зменшення якості, якщо все ще завеликий
  if (blob.size > maxBytes) {
      blob = await toBlob(minQuality);
  }

  // Якщо навіть з minQuality великий, пробуємо зменшити розмір ще раз
  if (blob.size > maxBytes) {
      canvas.width = Math.round(width * 0.8);
      canvas.height = Math.round(height * 0.8);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await toBlob(minQuality);
  }

  return new File([blob], file.name.replace(/\.\w+$/, "") + ".compressed.jpg", { type: mime });
}

// --- STYLES ---

const styles = {
  page: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: 20,
    maxWidth: 500,
    margin: "0 auto",
    color: "#0f172a",
  },
  header: {
    textAlign: "center",
    marginBottom: 20,
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: -0.5
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  },
  label: {
      fontSize: 12,
      fontWeight: 700,
      color: "#64748b",
      marginBottom: 6,
      textTransform: "uppercase"
  },
  input: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 20,
    outline: "none",
  },
  uploadBox: {
    border: "2px dashed #cbd5e1",
    borderRadius: 12,
    padding: "30px",
    textAlign: "center",
    cursor: "pointer",
    background: "#f8fafc",
    marginBottom: 20,
    transition: "all 0.2s"
  },
  uploadBoxActive: {
    borderColor: "#0f172a",
    background: "#f1f5f9"
  },
  btn: {
    width: "100%",
    padding: "16px",
    borderRadius: 12,
    background: "#0f172a",
    color: "white",
    fontWeight: "bold",
    border: "none",
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.1s"
  },
  successCard: {
      padding: 30,
      background: "#dcfce7",
      color: "#14532d",
      borderRadius: 16,
      textAlign: "center",
      marginTop: 20,
      border: "2px solid #22c55e",
      animation: "fadeIn 0.3s ease-in"
  },
  hint: {
      marginTop: 15,
      fontSize: 13,
      color: "#94a3b8",
      textAlign: "center"
  }
};

export default function OCRInverterScan() {
  const [installationId, setInstallationId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleScan = async () => {
    if (!installationId || !file) return;
    setLoading(true);

    try {
      // 1. Compress if needed
      const processedFile = await compressImageToLimit(file);
      
      const fd = new FormData();
      fd.append("installation_custom_id", installationId);
      fd.append("quantity", "1"); // Default to 1 for accumulative scanning
      fd.append("file", processedFile);

      // 2. Fire Request
      const res = await fetch("/api/ocr/scan-and-assign", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server Error");

      // 3. Success UI
      setSent(true);
      
      // 4. Auto Reset after 2.5s
      setTimeout(() => {
          setSent(false);
          setFile(null);
          // We keep installationId so user can scan next item for same object
      }, 2500);

    } catch (e) {
      alert("Помилка: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
      return (
        <div style={styles.page}>
           <div style={styles.successCard}>
              <div style={{fontSize: 50, marginBottom: 10}}>✅</div>
              <div style={{fontSize: 24, fontWeight: 900}}>ПРИЙНЯТО!</div>
              <p style={{margin: "10px 0 0", fontSize: 16}}>
                  Файл передано на сервер.<br/>Обробка йде у фоні.
              </p>
              <div style={{marginTop: 20, fontSize: 13, opacity: 0.8}}>
                 Можна сканувати наступний...
              </div>
           </div>
           
           <button 
             onClick={() => { setSent(false); setFile(null); }}
             style={{...styles.btn, marginTop: 20, background: "white", color: "#0f172a", border: "2px solid #e2e8f0"}}
           >
             Сканувати наступний (вручну)
           </button>
        </div>
      );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>📸 Швидке Сканування</div>
      
      <div style={styles.card}>
        <div style={styles.label}>ID Об'єкту (Custom ID)</div>
        <input 
          style={styles.input} 
          placeholder="Напр. 102" 
          value={installationId}
          type="number"
          onChange={e => setInstallationId(e.target.value)}
        />

        <label 
           style={file ? {...styles.uploadBox, ...styles.uploadBoxActive} : styles.uploadBox}
        >
          <input 
            type="file" 
            accept="image/*" 
            style={{display: 'none'}} 
            onChange={e => setFile(e.target.files?.[0] || null)} 
          />
          <div style={{fontSize: 32, marginBottom: 10}}>📷</div>
          <div style={{fontWeight: 700, color: "#334155", fontSize: 16}}>
            {file ? file.name : "Натисни, щоб зробити фото"}
          </div>
          {file && <div style={{fontSize: 13, color: "#64748b", marginTop: 5}}>{fmtKB(file.size)}</div>}
        </label>

        <button 
          style={{...styles.btn, opacity: (loading || !file || !installationId) ? 0.6 : 1}}
          disabled={loading || !file || !installationId}
          onClick={handleScan}
        >
          {loading ? "Відправка..." : "ВІДПРАВИТИ"}
        </button>

        <div style={styles.hint}>
           Після відправки можна відразу закривати.
        </div>
      </div>
    </div>
  );
}