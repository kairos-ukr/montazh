// server/src/routes/equipment2.routes.js
import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Мінімальний захист запису: якщо в employees немає запису — це VIEW (як у твоєму middleware)
function requireWriteAccess(req, res, next) {
  if (!req.employee) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

function sbOrThrow(resObj) {
  if (resObj.error) {
    const msg = resObj.error.message || "Supabase error";
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }
  return resObj.data;
}

// GET all data for EquipmentPage (one request)
router.get("/data", requireAuth, async (req, res) => {
  try {
    const [eqRes, instRes, instEqRes, empRes] = await Promise.all([
      supabaseAdmin.from("equipment").select("*").order("name"),
      supabaseAdmin
        .from("installations")
        .select("*, clients!inner(name)")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("installed_equipment")
        .select("*, equipment:equipment_id(*), employees:employee_custom_id(name, phone)")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("employees").select("custom_id, name, phone").order("name"),
    ]);

    const equipment = sbOrThrow(eqRes);
    const installations = sbOrThrow(instRes);
    const installedEquipment = sbOrThrow(instEqRes);
    const employees = sbOrThrow(empRes);

    return res.json({ equipment, installations, installedEquipment, employees });
  } catch (e) {
    console.error("GET /api/equipment2/data error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

// -------------------- equipment (catalog) --------------------

router.post("/equipment", requireAuth, requireWriteAccess, async (req, res) => {
  try {
    const { name, category, power_kw, manufacturer } = req.body || {};

    const payload = {
      name: name ?? "",
      category: category || null,
      power_kw: power_kw === "" || power_kw === null || power_kw === undefined ? null : Number(power_kw),
      manufacturer: manufacturer || null,
    };

    const r = await supabaseAdmin.from("equipment").insert([payload]);
    sbOrThrow(r);
    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/equipment2/equipment error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

router.patch("/equipment/:id", requireAuth, requireWriteAccess, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { name, category, power_kw, manufacturer } = req.body || {};
    const payload = {
      name: name ?? "",
      category: category || null,
      power_kw: power_kw === "" || power_kw === null || power_kw === undefined ? null : Number(power_kw),
      manufacturer: manufacturer || null,
    };

    const r = await supabaseAdmin.from("equipment").update(payload).eq("id", id);
    sbOrThrow(r);
    return res.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/equipment2/equipment/:id error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

router.delete("/equipment/:id", requireAuth, requireWriteAccess, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const r = await supabaseAdmin.from("equipment").delete().eq("id", id);
    sbOrThrow(r);
    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/equipment2/equipment/:id error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

// -------------------- installed_equipment (assignment/details) --------------------

router.post("/installed-equipment", requireAuth, requireWriteAccess, async (req, res) => {
  try {
    const body = req.body || {};

    const payload = {
      installation_custom_id: body.installation_custom_id,
      equipment_id: body.equipment_id ? Number(body.equipment_id) : null,
      quantity: body.quantity ? Number(body.quantity) : 1,
      // деталі можуть бути порожні — логіка сторінки така
      serial_number: body.serial_number ?? null,
      login: body.login ?? null,
      password: body.password ?? null,
      employee_custom_id:
        body.employee_custom_id === "" || body.employee_custom_id === null || body.employee_custom_id === undefined
          ? null
          : Number(body.employee_custom_id),
    };

    const r = await supabaseAdmin.from("installed_equipment").insert([payload]);
    sbOrThrow(r);
    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/equipment2/installed-equipment error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

router.patch("/installed-equipment/:id", requireAuth, requireWriteAccess, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const body = req.body || {};
    const payload = {
      login: body.login ?? null,
      password: body.password ?? null,
      serial_number: body.serial_number ?? null,
      employee_custom_id:
        body.employee_custom_id === "" || body.employee_custom_id === null || body.employee_custom_id === undefined
          ? null
          : Number(body.employee_custom_id),
    };

    const r = await supabaseAdmin.from("installed_equipment").update(payload).eq("id", id);
    sbOrThrow(r);
    return res.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/equipment2/installed-equipment/:id error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

router.delete("/installed-equipment/:id", requireAuth, requireWriteAccess, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const r = await supabaseAdmin.from("installed_equipment").delete().eq("id", id);
    sbOrThrow(r);
    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/equipment2/installed-equipment/:id error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
});

export default router;
