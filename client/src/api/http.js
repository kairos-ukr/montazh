// client/src/api/http.js

const API_BASE = `http://${window.location.hostname}:5000`;


/**
 * Універсальна функція запиту.
 * - credentials: "include" щоб літали куки
 * - НЕ ставимо Content-Type на GET (інакше буде OPTIONS preflight)
 * - cache: "no-store" щоб /me не ловив 304 по ETag
 */
async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const method = (options.method || "GET").toUpperCase();

  // Копіюємо headers, але не нав’язуємо Content-Type для GET
  const headers = {
    ...(options.headers || {}),
  };

  // Content-Type ставимо тільки якщо реально є body
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const config = {
    ...options,
    method,
    credentials: "include",
    cache: "no-store",
    headers,
  };

  const res = await fetch(url, config);

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errorMsg = data?.error || `HTTP Error ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const apiGet = (path) => request(path, { method: "GET" });

export const apiPost = (path, body) =>
  request(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });

export const apiPatch = (path, body) =>
  request(path, {
    method: "PATCH",
    body: JSON.stringify(body ?? {}),
  });

export const apiDelete = (path) => request(path, { method: "DELETE" });
