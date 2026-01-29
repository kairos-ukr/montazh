import express from "express";
import multer from "multer";
import crypto from "crypto";
import FormData from "form-data"; 
import axios from "axios"; 
import { requireAuth } from "../middleware/requireAuth.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// --- CONFIGURATION FROM ENV ---
const OCR_ENDPOINT = process.env.OCR_ENDPOINT || "https://api.ocr.space/parse/image"; 
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY;

// Твій Python сервіс
const PYTHON_SERVICE_URL = "https://quiet-water-a1ad.kairosost38500.workers.dev"; 

const DEFAULT_LANGUAGE = "eng";
const DEFAULT_ENGINE = "3";

if (!OCR_API_KEY) {
    console.warn("⚠️ УВАГА: Не знайдено OCR_SPACE_API_KEY у файлі .env!");
}

// --- TEXT NORMALIZATION ---
function normalizeText(t = "") {
  let text = String(t)
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐-–—]/g, "-") 
    .replace(/[|]/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  text = text.replace(/\bXL-/gi, "X1-");
  text = text.replace(/\bHU(?=[0-9A-Z])/gi, "HL"); 
  return text;
}

function normalizeSerialCandidate(s = "") {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanModelName(m) {
  if (!m) return null;
  let x = String(m).trim();
  x = x.replace(/^[\s:;#\-\.]+|[\s,#\-\.]+$/g, "");
  x = x.replace(/\s+/g, " ");
  return x;
}

// --- PARSING LOGIC ---
function parseDataFromOCR(ocrTextRaw) {
  const text = normalizeText(ocrTextRaw);
  const upper = text.toUpperCase();

  let brand = null;
  let model = null;
  let category = "inverter";

  if (upper.includes("DEYE") || /\bSE-[A-Z0-9]/i.test(text) || /\bRW-[A-Z0-9]/i.test(text)) {
    brand = "DEYE";
    if (upper.includes("BATTERY") || upper.includes("NOMINAL ENERGY") || upper.includes("SE-") || upper.includes("RW-")) {
        category = "battery";
    }
  } else if (upper.includes("SOLIS") || upper.includes("GINLONG")) {
    brand = "SOLIS";
  } else if (upper.includes("SOLAX") || upper.includes("SOLUX") || /\bX1-/.test(upper)) {
    brand = "SOLAX";
  }

  if (brand === "DEYE" && !model) {
      const batteryRegex = /\b(SE|RW|AI|BOS)-[A-Z0-9\.]+(?:\s+(?:Pro|Plus|Max|M|G|E|S))?\b/i;
      const m = text.match(batteryRegex);
      if (m) { model = cleanModelName(m[0]); category = "battery"; }
  }
  if (brand === "DEYE" && !model) {
      const m = text.match(/\bSUN-[A-Z0-9\.-]{4,}(?:K|KW)?\b/i);
      if (m) model = cleanModelName(m[0]);
  }
  if (!model) {
    const genericRegex = /(?:MODEL|TYPE|NO\.)\s*[:#\.]?\s*([A-Z0-9\-\.\/\s]{3,20})/i;
    const m = text.match(genericRegex);
    if (m && cleanModelName(m[1]).length > 2) model = cleanModelName(m[1]);
  }

  let capacity_kwh = null;
  const energyRegex = /Nominal\s*Energy\s*[:\.\-]?\s*(\d+[\.,]?\d*)\s*k?Wh/i;
  const eMatch = text.match(energyRegex);
  if (eMatch) capacity_kwh = parseFloat(eMatch[1].replace(",", "."));

  const power_val = capacity_kwh || extractPowerKwInverter(brand, model);
  return { brand, model, category, power_kw: power_val, rawText: text };
}

function extractPowerKwInverter(brand, model = "") {
  const mUpper = String(model).toUpperCase();
  if (brand === "DEYE" && mUpper.includes("SUN-")) {
    const m = mUpper.match(/\bSUN-(\d{1,2}(?:\.\d+)?)(?:K|KW)\b/);
    if (m) return Number(m[1]);
  }
  if (brand === "SOLIS") {
    const m = mUpper.match(/(\d{1,3}(?:\.\d+)?)\s*K\b/);
    if (m) return Number(m[1]);
  }
  return null;
}

function getBestSerial(ocrText, brand, category) {
  const text = normalizeText(ocrText);
  const tokens = text.split(/[\s\n]+/).filter(Boolean);
  const candidates = [];

  const labelRegex = /(?:SN|S\/N|SERIAL|NO\.)\s*[:#\.]?\s*([A-Z0-9]{5,30})/i;
  const explicitMatch = text.match(labelRegex);
  if (explicitMatch) candidates.push({ value: normalizeSerialCandidate(explicitMatch[1]), score: 90 });

  tokens.forEach(token => {
      const raw = normalizeSerialCandidate(token);
      let score = 0;
      if (brand === "DEYE" && category === "battery") {
          if (raw.length === 16) {
              score += 60;
              const letterCount = (raw.match(/[A-Z]/g) || []).length;
              const digitCount = (raw.match(/\d/g) || []).length;
              if (letterCount === 2 && digitCount === 14) score += 100;
              else if (letterCount >= 1 && letterCount <= 4 && digitCount >= 12) score += 80;
              else if (digitCount === 16) score += 40;
              if (raw.startsWith("2")) score += 20;
          }
      } else if (brand === "DEYE") {
          if (/^\d{10}$/.test(raw)) score += 80;
      } else if (brand === "SOLIS") {
          if (/^\d{16}$/.test(raw)) score += 80;
      } else if (brand === "SOLAX") {
          if (raw.startsWith("H") && raw.length > 10) score += 60;
      }
      if (["MODEL", "DEYE", "LI-ION", "CHINA", "BATTERY", "VERSION"].includes(raw)) score = -999;
      if (score > 0) candidates.push({ value: raw, score });
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value || "";
}

// --- DB SYNC LOGIC (UPDATED WITH PHOTOS) ---
async function smartAssign(installationId, brand, model, serial, power_kw, category, photoUrl, photoFileId) {
    const name = `${brand || "Unknown"} ${model || "Device"}`;
    
    // 1. Знаходимо або створюємо тип обладнання (equipment)
    let { data: eq } = await supabaseAdmin.from("equipment").select("id").eq("name", name).maybeSingle();
    
    if (!eq) {
        const { data: newEq } = await supabaseAdmin.from("equipment")
            .insert([{ name, manufacturer: brand, category: category || "inverter", power_kw }])
            .select("id").single();
        eq = newEq;
    }
    
    // 2. Шукаємо вже встановлене обладнання
    const { data: installed } = await supabaseAdmin.from("installed_equipment")
        .select("*")
        .eq("installation_custom_id", installationId)
        .eq("equipment_id", eq.id)
        .maybeSingle();

    const newSn = serial ? [serial] : [];
    
    // Готуємо масиви для фото (якщо URL прийшов)
    const newPhotos = photoUrl ? [photoUrl] : [];
    const newFileIds = photoFileId ? [photoFileId] : [];

    if (installed) {
        // --- UPDATE ---
        let oldSn = [];
        try { oldSn = typeof installed.serial_number === 'string' ? JSON.parse(installed.serial_number) : installed.serial_number; } catch {}
        if (!Array.isArray(oldSn)) oldSn = [];
        
        // Отримуємо старі фото (Postgres повертає масив, або null)
        const oldPhotos = installed.photos || [];
        const oldFileIds = installed.photo_file_ids || [];

        // Перевірка на дублікат серійного номера
        if (serial && oldSn.includes(serial)) {
            console.log(`[BG-WORKER] SN ${serial} exists. Adding photo only.`);
            // Якщо SN є, ми все одно хочемо додати фото до запису
            await supabaseAdmin.from("installed_equipment").update({
                photos: [...oldPhotos, ...newPhotos],
                photo_file_ids: [...oldFileIds, ...newFileIds]
            }).eq("id", installed.id);
            return;
        }

        // Оновлюємо кількість, SN та фото
        await supabaseAdmin.from("installed_equipment").update({
            quantity: installed.quantity + 1,
            serial_number: JSON.stringify([...oldSn, ...newSn]),
            photos: [...oldPhotos, ...newPhotos],
            photo_file_ids: [...oldFileIds, ...newFileIds]
        }).eq("id", installed.id);

    } else {
        // --- INSERT ---
        await supabaseAdmin.from("installed_equipment").insert([{
            installation_custom_id: installationId,
            equipment_id: eq.id,
            quantity: 1,
            serial_number: JSON.stringify(newSn),
            photos: newPhotos,       // масив
            photo_file_ids: newFileIds // масив
        }]);
    }
}

// --- WORKER: OCR + SEND TO PYTHON + DB SYNC ---
async function runBackgroundJob(fileBuffer, fileMime, installId, reqId) {
    console.log(`[BG-WORKER] ${reqId} started...`);
    try {
        // 1. OCR SPACE REQUEST
        if (!OCR_API_KEY) throw new Error("OCR_SPACE_API_KEY missing in ENV");

        const fd = new FormData();
        fd.append("apikey", OCR_API_KEY);
        fd.append("language", DEFAULT_LANGUAGE);
        fd.append("OCREngine", DEFAULT_ENGINE);
        fd.append("scale", "true");
        fd.append("detectOrientation", "true"); 
        fd.append("file", fileBuffer, { filename: "image.jpg", contentType: fileMime });

        const ocrRes = await axios.post(OCR_ENDPOINT, fd, { headers: fd.getHeaders(), maxBodyLength: Infinity });
        const ocrData = ocrRes.data;
        
        if (ocrData.IsErroredOnProcessing) {
            console.error(`[BG-WORKER] OCR API Error: ${ocrData.ErrorMessage}`);
            // Навіть якщо OCR впав, можливо варто все одно завантажити фото? 
            // Поки що виходимо, але можна змінити логіку.
            return;
        }

        const text = ocrData.ParsedResults?.[0]?.ParsedText || "";
        const { brand, model, category, power_kw, rawText } = parseDataFromOCR(text);
        const serial = getBestSerial(rawText, brand, category);
        
        console.log(`[BG-WORKER] Parsed: ${brand} | ${model} | SN:${serial}`);

        // 2. ВІДПРАВКА НА PYTHON СЕРВЕР ТА ОТРИМАННЯ ПОСИЛАННЯ
        let driveLink = null;
        let driveFileId = null;

        try {
            const pyForm = new FormData();
            pyForm.append("file", fileBuffer, { filename: "scan.jpg", contentType: fileMime });
            pyForm.append("installation_id", String(installId));
            pyForm.append("serial_number", serial || ""); 

            console.log(`[BG-WORKER] Sending to Python Service...`);
            const pyRes = await axios.post(`${PYTHON_SERVICE_URL}/integrations/ocr-save`, pyForm, {
                 headers: pyForm.getHeaders(),
                 maxBodyLength: Infinity
            });
            
            // Отримуємо дані від Python
            driveLink = pyRes.data.drive_link;
            driveFileId = pyRes.data.file_id; 
            
            console.log(`[BG-WORKER] Python Success. FileID: ${driveFileId}`);

        } catch (pyErr) {
            console.error(`[BG-WORKER] Python Service Error:`, pyErr.message);
        }

        // 3. ЗАПИС В БД (Supabase) з фото
        if (brand && model) {
            await smartAssign(installId, brand, model, serial, power_kw, category, driveLink, driveFileId);
            console.log(`[BG-WORKER] DB Updated successfully`);
        } else {
            console.log(`[BG-WORKER] Detection failed, skipping DB assign.`);
        }
        
    } catch (e) {
        console.error(`[BG-WORKER] Exception ${reqId}:`, e);
    }
}

// --- ROUTER ---
router.post("/scan-and-assign", requireAuth, upload.single("file"), (req, res) => {
    const requestId = crypto.randomUUID();

    if (!req.body.installation_custom_id || !req.file) {
        return res.status(400).json({ error: "No data" });
    }

    res.json({
        ok: true,
        requestId,
        message: "Accepted. Processing...",
        status: "processing_background"
    });

    runBackgroundJob(req.file.buffer, req.file.mimetype, Number(req.body.installation_custom_id), requestId);
});

export default router;