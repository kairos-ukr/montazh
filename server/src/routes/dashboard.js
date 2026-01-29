// server/src/routes/dashboard.js
import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * Повертає YYYY-MM-DD для Europe/Kyiv, щоб work_date збігався з твоєю логікою "сьогодні".
 * Якщо Intl/timeZone недоступний (рідко), падаємо на локальний час сервера.
 */
function todayISODateKyiv() {
  try {
    // en-CA стабільно дає YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
  } catch {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

function isActiveDayOff(status, isCancelled) {
  // Активний вихідний/відпустка/лікарняний тільки якщо НЕ скасовано
  if (isCancelled) return false;
  return ["OFF", "VACATION", "SICK_LEAVE"].includes(status);
}

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const today = todayISODateKyiv();

    // 1) employee по user_id
    const { data: employee, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("custom_id,name,position,user_id,role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (empErr) throw empErr;

    // Якщо user є, але employee ще не створений — повертаємо пустий дашборд
    if (!employee?.custom_id) {
      return res.json({
        today: {
          attendanceStatus: null,
          attendanceIsCancelled: false,
          isDayOffActive: false,
        },
        todayInstallation: null,
        tasksPreview: [],
        myActiveInstallationsCount: 0,
      });
    }

    const employeeId = employee.custom_id;

    // 2) attendance на сьогодні (беремо status + is_cancelled)
    const { data: attRow, error: attErr } = await supabaseAdmin
      .from("attendance")
      .select("status,is_cancelled")
      .eq("employee_custom_id", employeeId)
      .eq("work_date", today)
      .maybeSingle();

    if (attErr) throw attErr;

    const attendanceStatus = attRow?.status ?? null;
    const attendanceIsCancelled = !!attRow?.is_cancelled;

    const isDayOffActive = isActiveDayOff(attendanceStatus, attendanceIsCancelled);

    // 3) Сьогоднішні призначення (installation_workers)
    // ВАЖЛИВО: беремо notes — це або коментар до об'єкта, або назва ручного завдання
    const { data: todayWorks, error: worksErr } = await supabaseAdmin
      .from("installation_workers")
      .select(`
        id,
        installation_custom_id,
        employee_custom_id,
        work_date,
        notes,
        installations:installation_custom_id (
          custom_id,
          name,
          gps_link,
          latitude,
          longitude,
          client_id
        )
      `)
      .eq("employee_custom_id", employeeId)
      .eq("work_date", today);

    if (worksErr) throw worksErr;

    const works = Array.isArray(todayWorks) ? todayWorks : [];
    const todayCount = works.length;

    // Розділяємо:
    // - призначення на реальний об’єкт (installation_custom_id НЕ NULL)
    // - ручні завдання (installation_custom_id NULL, але notes є)
    const installationWorks = works.filter((w) => w?.installation_custom_id && w?.installations);
    const manualWorks = works.filter((w) => !w?.installation_custom_id && (w?.notes || "").trim());

    // Вибір “головного” запису:
    // 1) якщо є об’єкти — беремо перший об’єкт
    // 2) інакше якщо є ручні — беремо перший ручний
    let primary = null;
    let primaryType = null; // "INSTALLATION" | "MANUAL"

    if (installationWorks.length) {
      primary = installationWorks[0];
      primaryType = "INSTALLATION";
    } else if (manualWorks.length) {
      primary = manualWorks[0];
      primaryType = "MANUAL";
    }

    let todayInstallation = null;

    if (primary) {
      if (primaryType === "INSTALLATION") {
        const inst = primary.installations;

        // Локація клієнта (область + населений пункт)
        let client_place = null;
        if (inst?.client_id) {
          const { data: clientRow, error: clientErr } = await supabaseAdmin
            .from("clients")
            .select("oblast,populated_place,name")
            .eq("custom_id", inst.client_id)
            .maybeSingle();

          if (clientErr) throw clientErr;

          if (clientRow) {
            client_place =
              [clientRow.oblast, clientRow.populated_place].filter(Boolean).join(", ") ||
              clientRow.name ||
              null;
          }
        }

        // Coworkers на цьому ж об’єкті сьогодні
        const { data: coworkRows, error: coworkErr } = await supabaseAdmin
          .from("installation_workers")
          .select(`
            employee_custom_id,
            employees:employee_custom_id (custom_id,name,position)
          `)
          .eq("installation_custom_id", inst.custom_id)
          .eq("work_date", today);

        if (coworkErr) throw coworkErr;

        const coworkers = (coworkRows || [])
          .map((r) => r.employees)
          .filter(Boolean)
          .filter((e) => e.custom_id !== employeeId) // себе прибираємо
          .map((e) => ({
            employee_custom_id: e.custom_id,
            name: e.name,
            position: e.position || null,
          }));

        // Latitude/Longitude інколи можуть прийти як string (numeric), тому нормалізуємо
        const lat = inst?.latitude === null || inst?.latitude === undefined ? null : Number(inst.latitude);
        const lng = inst?.longitude === null || inst?.longitude === undefined ? null : Number(inst.longitude);

        todayInstallation = {
          type: "INSTALLATION",
          installation_custom_id: inst.custom_id,
          installation_name: inst.name,
          client_place,
          gps_link: inst.gps_link || null,
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
          coworkers,

          // Коментар/нотатка саме з installation_workers (те, що ти хотів показувати на Dashboard)
          notes: (primary?.notes || "").trim() || null,

          todayCount,
          hasMoreToday: todayCount > 1,
        };
      } else {
        // Ручне завдання: installation_custom_id = NULL, а "назва" — у notes
        todayInstallation = {
          type: "MANUAL",
          installation_custom_id: null,
          installation_name: (primary?.notes || "").trim() || "Завдання",
          client_place: null,
          gps_link: null,
          latitude: null,
          longitude: null,
          coworkers: [],
          notes: null, // тут notes уже використали як назву
          todayCount,
          hasMoreToday: todayCount > 1,
        };
      }
    }

    // 4) tasks preview (microtasks) — залишив як у тебе
    const { data: tasks, error: tasksErr } = await supabaseAdmin
      .from("microtasks")
      .select("custom_id,task_text,due_date,status,installation_id,created_at,assigned_to")
      .in("status", ["нове", "в процесі"])
      .or(`assigned_to.eq.${employeeId},assigned_to.is.null`)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (tasksErr) throw tasksErr;

    // підтягнемо назви інсталяцій для задач
    const installationIds = [...new Set((tasks || []).map((t) => t.installation_id).filter(Boolean))];

    const instNameMap = new Map();
    if (installationIds.length) {
      const { data: instRows, error: instErr } = await supabaseAdmin
        .from("installations")
        .select("id,name")
        .in("id", installationIds);

      if (instErr) throw instErr;

      (instRows || []).forEach((r) => instNameMap.set(r.id, r.name));
    }

    // сортування: прострочені вверх, потім по due_date
    const startOfToday = new Date(new Date().toDateString()).getTime();

    const tasksPreview = (tasks || [])
      .map((t) => ({
        custom_id: t.custom_id,
        task_text: t.task_text,
        due_date: t.due_date,
        installation_name: t.installation_id ? instNameMap.get(t.installation_id) || null : null,
      }))
      .sort((a, b) => {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;

        const aOver = ad < startOfToday;
        const bOver = bd < startOfToday;

        if (aOver !== bOver) return aOver ? -1 : 1;
        return ad - bd;
      })
      .slice(0, 5);

    // 5) myActiveInstallationsCount — як у тебе
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const yyyy = since.getFullYear();
    const mm = String(since.getMonth() + 1).padStart(2, "0");
    const dd = String(since.getDate()).padStart(2, "0");
    const sinceDate = `${yyyy}-${mm}-${dd}`;

    const { data: activeRows, error: activeErr } = await supabaseAdmin
      .from("installation_workers")
      .select("installation_custom_id")
      .eq("employee_custom_id", employeeId)
      .gte("work_date", sinceDate);

    if (activeErr) throw activeErr;

    const myActiveInstallationsCount = new Set((activeRows || []).map((r) => r.installation_custom_id)).size;

    return res.json({
      today: {
        attendanceStatus,
        attendanceIsCancelled,
        isDayOffActive,
      },
      todayInstallation,
      tasksPreview,
      myActiveInstallationsCount,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

export default router;
