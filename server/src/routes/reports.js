import express from "express";
import fetch from "node-fetch";
import { chromium } from "playwright";
import sharp from "sharp";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Твій FastAPI Drive gateway
const DRIVE_BASE_URL = "http://prem-eu1.bot-hosting.net:20174";

/**
 * Качає файл з Drive gateway і повертає data-uri для вставки в HTML.
 * Стискання + ресайз (без лімітів кількості фото)
 */
async function fetchImageDataUri(fileId) {
  try {
    const res = await fetch(`${DRIVE_BASE_URL}/drive/files/${fileId}`);
    if (!res.ok) {
      console.warn(`Drive download failed (${res.status}) for fileId=${fileId}`);
      return null;
    }

    const input = Buffer.from(await res.arrayBuffer());

    const optimized = await sharp(input)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    return `data:image/jpeg;base64,${optimized.toString("base64")}`;
  } catch (err) {
    console.error(`Error fetching image ${fileId}:`, err.message);
    return null;
  }
}

function row(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<tr><td style="width: 35%">${label}</td><td>${String(value)}</td></tr>`;
}

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("uk-UA");
  } catch {
    return String(d);
  }
}

async function loadReportData(installationCustomId) {
  const { data: installation, error: instErr } = await supabaseAdmin
    .from("installations")
    .select("*")
    .eq("custom_id", installationCustomId)
    .maybeSingle();

  if (instErr) throw new Error(`Supabase installations error: ${instErr.message}`);
  if (!installation) throw new Error(`Installation not found: ${installationCustomId}`);

  let client = null;
  if (installation.client_id) {
    const { data: cl, error: clErr } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("custom_id", installation.client_id)
      .maybeSingle();

    if (clErr) console.warn("Supabase clients error:", clErr);
    else client = cl;
  }

  const { data: workers, error: wErr } = await supabaseAdmin
    .from("installation_workers")
    .select("work_date, employees(name)")
    .eq("installation_custom_id", installationCustomId);

  if (wErr) throw new Error(`Supabase installation_workers error: ${wErr.message}`);

  // ОНОВЛЕНО: додано created_at, щоб знати дату для фото
  const { data: equipment, error: eErr } = await supabaseAdmin
    .from("installed_equipment")
    .select(`
      created_at,
      quantity,
      serial_number,
      photo_file_ids,
      login,
      password,
      equipment(name, manufacturer),
      employees(name, phone)
    `)
    .eq("installation_custom_id", installationCustomId);

  if (eErr) throw new Error(`Supabase installed_equipment error: ${eErr.message}`);

  const { data: payments, error: pErr } = await supabaseAdmin
    .from("payment_history")
    .select("*")
    .eq("installation_custom_id", installationCustomId)
    .order("paid_at", { ascending: true });

  if (pErr) throw new Error(`Supabase payment_history error: ${pErr.message}`);

  const { data: workflow, error: wfErr } = await supabaseAdmin
    .from("workflow_events")
    .select("*")
    .eq("installation_custom_id", installationCustomId)
    .order("created_at", { ascending: true });

  if (wfErr) throw new Error(`Supabase workflow_events error: ${wfErr.message}`);

  return { installation, client, workers: workers || [], equipment: equipment || [], payments: payments || [], workflow: workflow || [] };
}

async function buildHtml(data, sections) {
  const generatedAt = new Date().toLocaleString("uk-UA");

  // Workers grouping
  const workersByDate = {};
  for (const w of data.workers) {
    const d = fmtDate(w.work_date);
    workersByDate[d] ??= [];
    if (w.employees?.name) workersByDate[d].push(w.employees.name);
  }

  // --- ЗБІР ВСІХ ФОТО (WORKFLOW + EQUIPMENT) ПО ДАТАХ ---
  const photosByDate = {};

  // Функція-хелпер для додавання фото
  const addPhotosToCollection = async (dateRaw, fileIds) => {
    if (!Array.isArray(fileIds) || fileIds.length === 0) return;
    const d = fmtDate(dateRaw);
    photosByDate[d] ??= [];

    for (const fileId of fileIds) {
      const src = await fetchImageDataUri(fileId);
      if (src) photosByDate[d].push(src);
    }
  };

  if (sections.photos) {
    // 1. Фото з Workflow (Фотозвіти)
    for (const ev of data.workflow) {
      await addPhotosToCollection(ev.created_at, ev.photo_file_ids);
    }

    // 2. Фото з Equipment (Серійники) - тепер теж тут!
    for (const eq of data.equipment) {
      await addPhotosToCollection(eq.created_at, eq.photo_file_ids);
    }
  }

  const client = data.client;
  const inst = data.installation;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  h2 { margin: 18px 0 8px; font-size: 16px; }
  h3 { margin: 12px 0 6px; font-size: 13px; }
  .meta { margin-bottom: 12px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
  .muted { color: #666; }

  /* Універсальний стиль для всіх фото в кінці */
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .photo { border: 1px solid #ddd; padding: 6px; }
  .photo img { width: 100%; height: 220px; object-fit: contain; display: block; }
  
  .page-break { page-break-before: always; }
</style>
</head>
<body>

  <h1>Звіт по об'єкту</h1>
  <div class="meta">Дата генерації: <b>${generatedAt}</b></div>

  ${sections.client ? `
    <h2>Клієнт</h2>
    ${client ? `
      <table>
        ${row("Ім’я / Назва", client.name)}
        ${row("Телефон", client.phone)}
        ${row("Область", client.oblast)}
        ${row("Населений пункт", client.populated_place)}
        ${row("Тип об'єкта", client.object_type)}
        ${row("Компанія", client.company_name)}
        ${row("Нотатки", client.notes)}
      </table>
    ` : `<div class="muted">Немає даних клієнта.</div>`}
  ` : ""}

  ${sections.installation ? `
    <h2>Об'єкт</h2>
    <table>
      ${row("Custom ID", inst.custom_id)}
      ${row("Назва", inst.name)}
      ${row("Тип станції", inst.station_type)}
      ${row("Тип монтажу", inst.mount_type)}
      ${row("Потужність (кВт)", inst.capacity_kw)}
      ${row("Старт", fmtDate(inst.start_date))}
      ${row("Фініш", fmtDate(inst.end_date))}
      ${row("GPS", inst.gps_link)}
      ${row("Latitude", inst.latitude)}
      ${row("Longitude", inst.longitude)}
      ${row("Статус", inst.status)}
      ${row("Коментар", inst.notes)}
    </table>
  ` : ""}

  ${sections.workers ? `
    <h2>Робочі дні</h2>
    <table>
      <tr><td><b>Дата</b></td><td><b>Працівники</b></td></tr>
      ${Object.entries(workersByDate).map(([d, names]) => `
        <tr>
          <td>${d}</td>
          <td>${names.join(", ")}</td>
        </tr>
      `).join("")}
    </table>
  ` : ""}

  ${sections.equipment ? `
    <h2>Обладнання</h2>
    <table>
      <tr>
        <td><b>Назва</b></td>
        <td><b>К-сть</b></td>
        <td><b>Серійний №</b></td>
        <td><b>Логін</b></td>
        <td><b>Пароль</b></td>
        <td><b>Встановив</b></td>
      </tr>
      ${data.equipment.map(e => `
        <tr>
          <td>${e.equipment?.name || ""}</td>
          <td>${e.quantity || ""}</td>
          <td>${e.serial_number || ""}</td> <td>${e.login || ""}</td>
          <td>${e.password || ""}</td>
          <td>${(e.employees?.name || "")} ${(e.employees?.phone ? `(${e.employees.phone})` : "")}</td>
        </tr>
      `).join("")}
    </table>
  ` : ""}

  ${sections.payments ? `
    <h2>Платежі</h2>
    <table>
      <tr>
        <td><b>Дата</b></td>
        <td><b>Сума</b></td>
        <td><b>Метод</b></td>
        <td><b>Коментар</b></td>
      </tr>
      ${data.payments.map(p => `
        <tr>
          <td>${fmtDate(p.paid_at)}</td>
          <td>${p.amount ?? ""}</td>
          <td>${p.payment_method || ""}</td>
          <td>${p.comment || ""}</td>
        </tr>
      `).join("")}
    </table>
  ` : ""}

  ${sections.photos ? `
    <div class="page-break"></div>
    <h2>Фото</h2>
    ${
      Object.keys(photosByDate).length === 0
        ? `<div class="muted">Фото не знайдено.</div>`
        : Object.entries(photosByDate)
            // Можна додати сортування дат, якщо треба, але Object.entries часто зберігає порядок додавання
            .map(([d, imgs]) => `
            <h3>${d}</h3>
            <div class="photos">
              ${imgs.map(src => `
                <div class="photo">
                  <img src="${src}" />
                </div>
              `).join("")}
            </div>
          `).join("")
    }
  ` : ""}

</body>
</html>
`;
}

router.post("/:customId/render", requireAuth, async (req, res) => {
  const startedAt = Date.now();
  try {
    const customId = Number(req.params.customId);
    if (!Number.isFinite(customId)) return res.status(400).json({ error: "Invalid customId" });

    const sections = req.body?.sections || {};
    const data = await loadReportData(customId);
    const html = await buildHtml(data, sections);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForTimeout(300);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });

    await browser.close();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Report-Time-ms", String(Date.now() - startedAt));
    return res.send(pdf);
  } catch (e) {
    console.error("REPORT ERROR:", e?.message);
    return res.status(500).json({ error: "Report generation failed", message: e?.message });
  }
});

export default router;