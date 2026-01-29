import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Хелпер для перевірки прав "Адмін або Офіс"
// Додано super_admin, як у вашій базі
function isAdminOrOffice(role) {
  return role === "admin" || role === "super_admin" || role === "office";
}

function isInstaller(role) {
  return role === "installer";
}

// Отримання даних про працівника, який робить запит
async function getEmployeeCtx(req) {
  const userId = req.user?.id;
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("custom_id, name, role, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * GET /api/timeoff/employees
 */
router.get("/employees", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("custom_id, name")
      .order("name", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/timeoff/upcoming
 */
router.get("/upcoming", requireAuth, async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || "10", 10), 1), 60);
    const toYYYYMMDD = (d) => d.toISOString().split("T")[0];

    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + days);

    const todayStr = toYYYYMMDD(today);
    const endStr = toYYYYMMDD(end);

    const { data, error } = await supabaseAdmin
      .from("attendance")
      .select("*")
      .gte("work_date", todayStr)
      .lte("work_date", endStr)
      .order("work_date", { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/timeoff/upsert
 * Додавання або оновлення вихідного
 */
router.post("/upsert", express.json(), requireAuth, async (req, res, next) => {
  try {
    const employee = await getEmployeeCtx(req);
    if (!employee) return res.status(403).json({ error: "Профіль не знайдено" });

    const role = employee.role;
    const myCustomId = employee.custom_id;
    const { records } = req.body || {};

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Немає записів для збереження" });
    }

    // Якщо це звичайний монтажник, він не може редагувати чужі записи
    if (!isAdminOrOffice(role)) {
      for (const r of records) {
        if (Number(r.employee_custom_id) !== Number(myCustomId)) {
          return res.status(403).json({ error: "Ви можете редагувати тільки свій графік" });
        }
      }
    }

    const allowed = new Set(["OFF", "VACATION", "SICK_LEAVE"]);
    const recordsToUpsert = records.map(r => {
        if (!r.work_date || r.employee_custom_id == null || !allowed.has(r.status)) {
            throw new Error("Некоректні дані запису");
        }
        return {
            ...r,
            is_cancelled: false // При оновленні/створенні робимо запис активним
        };
    });

    const { data, error } = await supabaseAdmin
      .from("attendance")
      .upsert(recordsToUpsert, { onConflict: "employee_custom_id,work_date" });

    if (error) throw error;
    res.json({ ok: true, data: data || [] });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/timeoff/attendance/:id/cancel
 * Логіка скасування вихідного (Soft Delete)
 */
router.patch("/attendance/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const employee = await getEmployeeCtx(req);
    if (!employee) return res.status(403).json({ error: "Профіль не знайдено" });

    const role = employee.role;
    const myCustomId = employee.custom_id;
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) return res.status(400).json({ error: "Невірний ID" });

    // 1. Знаходимо запис в БД, щоб дізнатися чий він
    const { data: row, error: selErr } = await supabaseAdmin
      .from("attendance")
      .select("id, employee_custom_id, is_cancelled")
      .eq("id", id)
      .maybeSingle();

    if (selErr) throw selErr;
    if (!row) return res.status(404).json({ error: "Запис не знайдено" });

    // 2. ГОЛОВНА ПЕРЕВІРКА ПРАВ
    const isMyRecord = Number(row.employee_custom_id) === Number(myCustomId);
    
    // Чи є користувач "Босом" (super_admin або office)
    const isBoss = isAdminOrOffice(role);

    // Логіка:
    // Якщо ти НЕ Бос І це НЕ твій запис -> Заборонено.
    // Якщо ти Бос -> Дозволено (незалежно чий запис).
    // Якщо це твій запис -> Дозволено.
    if (!isBoss && !isMyRecord) {
        return res.status(403).json({ error: "Ви можете скасувати тільки власний вихідний" });
    }
    
    // 3. Виконуємо скасування
    const { error } = await supabaseAdmin
      .from("attendance")
      .update({ is_cancelled: true })
      .eq("id", id);

    if (error) throw error;
    
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;