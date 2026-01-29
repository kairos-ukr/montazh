// server/src/routes/installations.js
import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// --- HELPERS ---

function paymentStatusFrom(totalCost, paidAmount) {
  const cost = parseFloat(totalCost);
  const paid = parseFloat(paidAmount);

  if (!cost || cost <= 0) return "pending";
  if (!paid || paid < 0) return "pending";

  const pct = (paid / cost) * 100;
  if (pct >= 100) return "paid";
  if (pct > 0) return "partial";
  return "pending";
}

async function getEmployeeByUserId(userId) {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("custom_id,name,role,user_id,email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function normalizeEmptyStringsToNull(obj) {
  const out = { ...(obj || {}) };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

// --- ROUTES ---

// 1. ✅ META для форми: клієнти + працівники
router.get("/installations/meta", requireAuth, async (req, res) => {
  try {
    const [clientsRes, employeesRes] = await Promise.all([
      supabaseAdmin.from("clients").select("custom_id,name,company_name").order("name"),
      supabaseAdmin.from("employees").select("custom_id,name,position,email").order("name"),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (employeesRes.error) throw employeesRes.error;

    return res.json({
      clients: clientsRes.data || [],
      employees: employeesRes.data || [],
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// 2. ✅ EMPLOYEES: Отримання списку працівників
router.get("/employees", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("custom_id, name, position, email, user_id")
      .order("name");

    if (error) throw error;

    return res.json({
      items: data || []
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// 3. ✅ LIST: пошук/фільтри/пагінація
router.get("/installations", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const employee = await getEmployeeByUserId(user.id);

    if (!employee) return res.status(403).json({ error: "Employee profile not found" });

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 6)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "active").trim();
    const payment = String(req.query.payment || "all").trim();
    const company = String(req.query.company || "all").trim();
    const onlyMine = String(req.query.onlyMine || "0") === "1";

    let query = supabaseAdmin
      .from("installations")
      .select(`*, client:clients(*), responsible_employee:employees(*)`, { count: "exact" });

    if (onlyMine && employee?.custom_id) {
      query = query.eq("responsible_emp_id", employee.custom_id);
    }

    if (search.length > 0) {
      const isStrictNumber = /^\d+$/.test(search);
      if (isStrictNumber) {
        query = query.or(`custom_id.eq.${search},client_id.eq.${search}`);
      } else {
        query = query.or(
          `name.ilike.%${search}%,notes.ilike.%${search}%,working_company.ilike.%${search}%`
        );
      }
    } else {
      if (status === "active") {
        query = query.in("status", ["planning", "in_progress", "on_hold"]);
      } else if (status !== "all") {
        query = query.eq("status", status);
      }

      if (payment !== "all") query = query.eq("payment_status", payment);
      if (company !== "all") query = query.eq("working_company", company);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return res.json({
      items: data || [],
      totalCount: count || 0,
      page,
      pageSize,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// 4. ✅ CREATE: Створення нового проекту
router.post("/installations", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const employee = await getEmployeeByUserId(user.id);

    if (!employee) return res.status(403).json({ error: "Employee profile not found" });

    const body = req.body || {};
    if (!body.client_id) return res.status(400).json({ error: "client_id required" });
    if (!body.name) return res.status(400).json({ error: "name required" });

    let payload = { ...body };
    payload.payment_status = paymentStatusFrom(payload.total_cost, payload.paid_amount);
    if (!payload.creator_email) payload.creator_email = user.email || null;
    payload = normalizeEmptyStringsToNull(payload);

    const { data, error } = await supabaseAdmin
      .from("installations")
      .insert([payload])
      .select("custom_id")
      .maybeSingle();

    if (error) throw error;

    return res.status(201).json({ ok: true, custom_id: data?.custom_id || null });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// 5. ✅ UPDATE (PATCH): Оновлення проекту
router.patch("/installations/:custom_id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const employee = await getEmployeeByUserId(user.id);

    if (!employee) return res.status(403).json({ error: "Employee profile not found" });

    const customId = Number(req.params.custom_id);
    if (!Number.isFinite(customId)) return res.status(400).json({ error: "Bad custom_id" });

    let payload = { ...(req.body || {}) };

    if (payload.total_cost !== undefined || payload.paid_amount !== undefined) {
       payload.payment_status = paymentStatusFrom(payload.total_cost, payload.paid_amount);
    }
    
    payload.updated_at = new Date().toISOString();
    payload = normalizeEmptyStringsToNull(payload);
    delete payload.id;
    delete payload.custom_id;

    const { error } = await supabaseAdmin
      .from("installations")
      .update(payload)
      .eq("custom_id", customId);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// 6. ✅ POST ADDITIONAL INFO: Додавання повідомлень
router.post("/additional-info", requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const employee = await getEmployeeByUserId(user.id);
        
        const { installation_custom_id, message_text } = req.body;

        if (!installation_custom_id || !message_text) {
            return res.status(400).json({ 
                error: 'ID об\'єкта та текст повідомлення є обов\'язковими.' 
            });
        }

        const authorName = employee?.name || user.email || "Менеджер";

        const { data, error } = await supabaseAdmin
            .from('project_additional_info')
            .insert({
                installation_custom_id,
                message_text,
                author_name: authorName,
                is_sent_to_telegram: false 
            })
            .select();

        if (error) throw error;

        return res.status(201).json({ success: true, data });
    } catch (e) {
        console.error("Additional Info Error:", e);
        return res.status(500).json({ error: e?.message || "Server error" });
    }
});

// 7. ✅ (НОВЕ) GET ADDITIONAL INFO: Отримання історії повідомлень
router.get("/additional-info/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
             return res.status(400).json({ error: 'ID is required' });
        }

        // Витягуємо повідомлення для конкретного installation_custom_id
        const { data, error } = await supabaseAdmin
            .from('project_additional_info')
            .select('*')
            .eq('installation_custom_id', id)
            .order('created_at', { ascending: false }); // Спочатку нові

        if (error) throw error;

        // Повертаємо об'єкт { data: [...] }, як очікує фронтенд
        return res.json({ data: data || [] });
    } catch (e) {
        console.error("Get Additional Info Error:", e);
        return res.status(500).json({ error: e?.message || "Server error" });
    }
});


// для пошуку об'єкта для звіту 
router.get("/by-custom-id/:customId", async (req, res) => {
  try {
    const customId = Number(req.params.customId);

    if (!Number.isFinite(customId)) {
      return res.status(400).json({ found: false, error: "Invalid customId" });
    }

    // 1) installation
    const { data: inst, error: instErr } = await supabaseAdmin
      .from("installations")
      .select("custom_id, name, station_type, start_date, end_date, client_id")
      .eq("custom_id", customId)
      .maybeSingle();

    if (instErr) {
      console.error("Supabase error (installations):", instErr);
      return res.status(500).json({ found: false });
    }
    if (!inst) return res.status(404).json({ found: false });

    // 2) client (optional, якщо client_id є)
    let client = null;
    if (inst.client_id) {
      const { data: cl, error: clErr } = await supabaseAdmin
        .from("clients")
        .select("custom_id, name, populated_place, phone, oblast")
        .eq("custom_id", inst.client_id)
        .maybeSingle();

      if (clErr) {
        console.error("Supabase error (clients):", clErr);
        // не валимо запит, просто без client
      } else {
        client = cl;
      }
    }

    return res.json({
      found: true,
      installation: {
        custom_id: inst.custom_id,
        name: inst.name,
        station_type: inst.station_type,
        start_date: inst.start_date,
        end_date: inst.end_date,
        client_id: inst.client_id,
      },
      client: client
        ? {
            custom_id: client.custom_id,
            name: client.name,
            populated_place: client.populated_place,
            phone: client.phone,
            oblast: client.oblast,
          }
        : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ found: false });
  }
});


export default router;