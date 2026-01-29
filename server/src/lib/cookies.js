// server/src/lib/cookies.js

export function cookieOptions() {
  // Перевірка: чи ми на проді?
  // Але для надійності на localhost краще явно задати false
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true, // Захист від XSS (JS не бачить куку)
    
    // !!! ВАЖЛИВО !!!
    // Якщо тут буде true на localhost (http), браузер НЕ збереже куку.
    // Тому жорстко ставимо false, якщо ми не в продакшні.
    secure: isProd, 
    
    // "Lax" - найкращий варіант для localhost. 
    // "None" вимагає secure: true.
    sameSite: isProd ? "none" : "lax",
    
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 днів
  };
}

export function setAuthCookies(res, session) {
  const opts = cookieOptions();
  res.cookie("sb-access-token", session.access_token, opts);
  res.cookie("sb-refresh-token", session.refresh_token, opts);
}

export function clearAuthCookies(res) {
  const opts = cookieOptions();
  res.clearCookie("sb-access-token", opts);
  res.clearCookie("sb-refresh-token", opts);
}