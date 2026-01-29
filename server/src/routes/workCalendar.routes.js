// server/src/routes/workCalendar.routes.js
import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const EDIT_ROLES = ["admin", "super_admin", "office"];

function isValidDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isPastDate(dateStr) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return dateStr < todayStr;
}

function getRole(req) {
  return req.employee?.role || null;
}

function canManage(req) {
  const role = getRole(req);
  return !!role && EDIT_ROLES.includes(role);
}

/**
 * GET /api/work-calendar/week?start=YYYY-MM-DD
 * ПН–СБ (6 днів)
 */
router.get("/week", requireAuth, async (req, res) => {
  try {
    const start = req.query.start;
    if (!isValidDateStr(start)) {
      return res.status(400).json({ error: "Invalid start date. Use YYYY-MM-DD" });
    }
    const end = addDaysStr(start, 5);

    const [instRes, empRes, attRes, workRes] = await Promise.all([
      supabaseAdmin
        .from("installations")
        .select("custom_id, name, status")
        .neq("status", "completed")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("employees")
        .select("custom_id, name, department, position")
        .order("name"),

      // attendance: беремо is_cancelled і враховуємо його
      supabaseAdmin
        .from("attendance")
        .select("employee_custom_id, work_date, status, is_cancelled")
        .gte("work_date", start)
        .lte("work_date", end)
        .in("status", ["OFF", "VACATION", "SICK_LEAVE"]),

      supabaseAdmin
        .from("installation_workers")
        .select("installation_custom_id, employee_custom_id, work_date, notes")
        .gte("work_date", start)
        .lte("work_date", end),
    ]);

    if (instRes.error) throw instRes.error;
    if (empRes.error) throw empRes.error;
    if (attRes.error) throw attRes.error;
    if (workRes.error) throw workRes.error;

    const installations = instRes.data || [];
    const employees = empRes.data || [];

    // timeOffMap = тільки активні відсутності (is_cancelled !== true)
    const timeOffMap = {};
    (attRes.data || []).forEach((item) => {
      if (item.is_cancelled === true) return;

      if (!timeOffMap[item.work_date]) timeOffMap[item.work_date] = {};
      timeOffMap[item.work_date][item.employee_custom_id] = item.status;
    });

    /**
     * assignmentsByDate:
     * КЛЮЧОВЕ: групуємо по (installationId + notes),
     * щоб два виїзди на один об'єкт з різними коментарями НЕ зливались.
     */
    const assignmentsByDate = {};
    (workRes.data || []).forEach((item) => {
      const date = item.work_date;
      if (!assignmentsByDate[date]) assignmentsByDate[date] = [];

      const instId = item.installation_custom_id ? String(item.installation_custom_id) : "custom";
      const notes = (item.notes || "").toString();

      const groupKey = `${instId}::${notes}`; // <-- головний фікс

      let group = assignmentsByDate[date].find((g) => g._groupKey === groupKey);

      if (!group) {
        group = {
          id: `${date}:${groupKey}`,
          _groupKey: groupKey,
          installationId: instId === "custom" ? "custom" : instId,
          notes,
          workers: [],
        };
        assignmentsByDate[date].push(group);
      }

      if (item.employee_custom_id) group.workers.push(item.employee_custom_id);
    });

    return res.json({
      canManageSchedule: canManage(req),
      installations,
      employees,
      timeOffMap,
      assignmentsByDate,
    });
  } catch (e) {
    console.error("GET /api/work-calendar/week error:", e);
    return res.status(500).json({ error: "Failed to load week data" });
  }
});

/**
 * POST /api/work-calendar/day/save
 * body: { date: "YYYY-MM-DD", assignments: [{installationId, notes, workers: []}] }
 */
router.post("/day/save", requireAuth, async (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: "Forbidden" });

    const { date, assignments } = req.body;

    if (!isValidDateStr(date)) return res.status(400).json({ error: "Invalid date. Use YYYY-MM-DD" });
    if (isPastDate(date)) return res.status(400).json({ error: "Past dates are read-only" });
    if (!Array.isArray(assignments)) return res.status(400).json({ error: "assignments must be an array" });

    const records = [];
    for (const a of assignments) {
      const installationId = a?.installationId ?? null;
      const notes = (a?.notes ?? "").toString();
      const workers = Array.isArray(a?.workers) ? a.workers : [];

      if (!installationId) continue;

      // custom: вимагаємо “назву/опис”
      if (installationId === "custom" && !notes.trim()) continue;

      for (const wId of workers) {
        if (!wId) continue;
        records.push({
          work_date: date,
          installation_custom_id: installationId === "custom" ? null : installationId,
          employee_custom_id: wId,
          notes, // <-- тут зберігається коментар і для normal і для custom
          work_hours: 8,
        });
      }
    }

    // простий варіант: на день повний перезапис
    const delRes = await supabaseAdmin.from("installation_workers").delete().eq("work_date", date);
    if (delRes.error) throw delRes.error;

    if (records.length > 0) {
      const insRes = await supabaseAdmin.from("installation_workers").insert(records);
      if (insRes.error) throw insRes.error;
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/work-calendar/day/save error:", e);
    return res.status(500).json({ error: "Failed to save day" });
  }
});

/**
 * POST /api/work-calendar/day/absence
 * body: { date, employee_custom_id, status }
 */
router.post("/day/absence", requireAuth, async (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: "Forbidden" });

    const { date, employee_custom_id, status } = req.body;

    if (!isValidDateStr(date)) return res.status(400).json({ error: "Invalid date" });
    if (!employee_custom_id) return res.status(400).json({ error: "Missing employee_custom_id" });
    if (!["OFF", "VACATION", "SICK_LEAVE"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    if (isPastDate(date)) return res.status(400).json({ error: "Past dates are read-only" });

    const upRes = await supabaseAdmin
      .from("attendance")
      .upsert(
        { employee_custom_id, work_date: date, status, is_cancelled: false },
        { onConflict: "employee_custom_id, work_date" }
      );

    if (upRes.error) throw upRes.error;

    const delRes = await supabaseAdmin
      .from("installation_workers")
      .delete()
      .eq("work_date", date)
      .eq("employee_custom_id", employee_custom_id);

    if (delRes.error) throw delRes.error;

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/work-calendar/day/absence error:", e);
    return res.status(500).json({ error: "Failed to set absence" });
  }
});

/**
 * POST /api/work-calendar/day/absence/cancel
 * body: { date, employee_custom_id }
 */
router.post("/day/absence/cancel", requireAuth, async (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: "Forbidden" });

    const { date, employee_custom_id } = req.body;

    if (!isValidDateStr(date)) return res.status(400).json({ error: "Invalid date" });
    if (!employee_custom_id) return res.status(400).json({ error: "Missing employee_custom_id" });
    if (isPastDate(date)) return res.status(400).json({ error: "Past dates are read-only" });

    const updRes = await supabaseAdmin
      .from("attendance")
      .update({ is_cancelled: true })
      .eq("employee_custom_id", employee_custom_id)
      .eq("work_date", date);

    if (updRes.error) throw updRes.error;

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/work-calendar/day/absence/cancel error:", e);
    return res.status(500).json({ error: "Failed to cancel absence" });
  }
});

export default router;


