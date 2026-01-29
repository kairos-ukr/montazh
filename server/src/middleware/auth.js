// src/middleware/auth.js
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export async function requireAuth(req, res, next) {
  try {
    const accessToken = req.cookies?.["sb-access-token"];
    if (!accessToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    req.user = data.user;
    next();
  } catch (e) {
    return res.status(401).json({ error: e?.message || "Unauthorized" });
  }
}
