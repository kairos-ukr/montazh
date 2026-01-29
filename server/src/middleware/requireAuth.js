// src/middleware/requireAuth.js
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export async function requireAuth(req, res, next) {
  try {
    // 1) cookie token
    const accessToken = req.cookies?.["sb-access-token"];
    if (!accessToken) {
      return res.status(401).json({ error: "Not authenticated (no token)" });
    }

    // 2) verify via Supabase
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    req.user = data.user;

    // 3) attach employee (ВАЖЛИВО: це твоя “справжня” роль)
    // беремо по user_id; якщо раптом немає — fallback по email
    let employee = null;

    const empByUserId = await supabaseAdmin
      .from("employees")
      .select("id, custom_id, name, email, role, tier, user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!empByUserId.error && empByUserId.data) {
      employee = empByUserId.data;
    } else {
      const email = data.user.email;
      if (email) {
        const empByEmail = await supabaseAdmin
          .from("employees")
          .select("id, custom_id, name, email, role, tier, user_id")
          .eq("email", email)
          .maybeSingle();

        if (!empByEmail.error && empByEmail.data) {
          employee = empByEmail.data;
        }
      }
    }

    req.employee = employee; // може бути null — тоді це VIEW

    return next();
  } catch (e) {
    console.error("Auth Middleware Error:", e);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
