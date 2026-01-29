import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Перевірка наявності змінних
if (!url || !key) {
  throw new Error(
    `Missing env: SUPABASE_URL=${!!url}, SUPABASE_SERVICE_ROLE_KEY=${!!key}`
  );
}

// Експортуємо сам об'єкт клієнта під іменем 'supabaseAdmin'
// Це саме те, що очікують інші файли (import { supabaseAdmin } from ...)
export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false },
});