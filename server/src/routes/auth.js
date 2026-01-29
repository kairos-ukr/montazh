// src/routes/auth.js
import express from "express";
import { createClient } from "@supabase/supabase-js"; // Статичний імпорт
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { setAuthCookies, clearAuthCookies } from "../lib/cookies.js"; // Імпорт утиліт

const router = express.Router();

// Створюємо Anon клієнт для логіна (це дешева операція)
// Або можна винести в окремий файл lib/supabaseAnon.js, якщо хочете
const getAnonClient = () => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
};

// --- SIGN IN ---
router.post("/auth/sign-in", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const anon = getAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({ email, password });

    if (error) return res.status(401).json({ error: error.message });
    if (!data?.session) return res.status(401).json({ error: "No session returned" });

    setAuthCookies(res, data.session);
    return res.json({ ok: true, user: data.user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- SIGN UP ---
router.post("/auth/sign-up", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const anon = getAnonClient();
    const { data, error } = await anon.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    // Створюємо профіль через admin (Service Role), бо Trigger може не спрацювати або його нема
    if (data?.user) {
      const { error: profileErr } = await supabaseAdmin.from("user_site").insert({
        user_id: data.user.id,
        first_name: firstName || "",
        last_name: lastName || "",
        email,
      });
      
      if (profileErr) {
        console.error("Profile creation error:", profileErr);
        // Не блокуємо відповідь, але логуємо помилку
      }
    }

    return res.json({
      ok: true,
      needsEmailConfirmation: !data?.session,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- ME ---
router.get("/auth/me", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const user = req.user;

    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return res.json({ user, employee: employee || null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- REFRESH ---
router.post("/auth/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.["sb-refresh-token"];
    if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

    const anon = getAnonClient();
    const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data?.session) return res.status(401).json({ error: "Refresh failed" });

    setAuthCookies(res, data.session);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- SIGN OUT ---
router.post("/auth/sign-out", async (req, res) => {
  clearAuthCookies(res);
  return res.json({ ok: true });
});

export default router;