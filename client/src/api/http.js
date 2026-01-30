// client/src/api/http.js

const API_BASE = "https://montazh.kairosost38500.workers.dev";

// ключі для sessionStorage
const ACCESS_TOKEN_KEY = "sb_access_token";
const REFRESH_TOKEN_KEY = "sb_refresh_token";

// щоб не було нескінченних refresh-циклів
let isRefreshing = false;
let refreshPromise = null;

/**
 * Універсальний HTTP-запит:
 * - cookies (credentials: include) → ПК / Android
 * - Authorization Bearer → iPhone Safari fallback
 * - auto refresh access_token
 */
async function request(path, options = {}, retry = true) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const method = (options.method || "GET").toUpperCase();

  const headers = { ...(options.headers || {}) };

  // Content-Type тільки якщо є body
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // 🔐 Bearer fallback (Safari)
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, {
    ...options,
    method,
    credentials: "include",
    cache: "no-store",
    headers,
  });

  // якщо access token протух
  if (res.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request(path, options, false);
    }
  }

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data;
}

/**
 * Refresh session:
 * - cookie refresh (ПК / Android)
 * - header refresh (Safari)
 */
async function refreshSession() {
  if (isRefreshing) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

      const headers = {};
      if (refreshToken) {
        headers["x-refresh-token"] = refreshToken;
      }

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
      });

      if (!res.ok) return false;

      const data = await res.json();

      if (data?.access_token) {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      }
      if (data?.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }

      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
    }
  })();

  return refreshPromise;
}

// ---- API helpers ----

export const apiGet = (path) =>
  request(path, { method: "GET" });

export const apiPost = async (path, body) => {
  const data = await request(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });

  // 🔑 логін — зберігаємо токени
  if (path === "/api/auth/sign-in" && data?.access_token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
  }

  // 🚪 логаут — чистимо все
  if (path === "/api/auth/sign-out") {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  return data;
};

export const apiPatch = (path, body) =>
  request(path, {
    method: "PATCH",
    body: JSON.stringify(body ?? {}),
  });

export const apiDelete = (path) =>
  request(path, { method: "DELETE" });

export const clearSession = () => {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};
