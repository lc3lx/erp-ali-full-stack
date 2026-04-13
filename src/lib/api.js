function normalizeApiBase(raw) {
  const base = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!base) return "";
  try {
    const url = new URL(base);
    const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      url.protocol === "http:" &&
      !isLocalHost
    ) {
      url.protocol = "https:";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    return base;
  }
  return base;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE)

const TOKEN_KEY = 'container_token'
const USER_KEY = 'container_user'

/** @type {() => void} */
let unauthorizedHandler = () => {}

/** Register session callback (e.g. from AuthProvider) for unauthorized responses */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = typeof fn === 'function' ? fn : () => {}
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function buildQuery(obj) {
  const p = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    p.set(k, String(v))
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

/**
 * @param {string} path - e.g. "/containers" (without /api/v1); may include ?query
 * @param {RequestInit & { query?: Record<string, string | number | boolean | undefined> }} options
 */
export async function apiRequest(path, options = {}) {
  const rawPath = typeof path === 'string' ? path : String(path)
  const normalized = rawPath.startsWith('/') ? rawPath : `/${rawPath}`

  const { query, ...init } = options
  const qs =
    query && Object.keys(query).length ? buildQuery(/** @type {Record<string, string>} */ (query)) : ''
  const url = `${API_BASE}/api/v1${normalized}${qs}`
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getStoredToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res
  try {
    res = await fetch(url, { ...init, headers })
  } catch (e) {
    const err = new Error(
      'تعذّر الاتصال بالخادم. تأكد أن الباك اند يعمل على المنفذ 4000 (npm run dev داخل مجلّد backend).',
    )
    err.cause = e
    throw err
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  // Only auto-logout on 401 (invalid/expired token).
  // 403 usually means permission/business rule issue and user should stay logged in.
  if (res.status === 401) {
    setStoredSession(null, null)
    unauthorizedHandler()
  }

  if (!res.ok) {
    const msg =
      data?.error?.message || (data?.success === false && data?.error?.message) || data?.message || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.body = data
    throw err
  }
  // استجابة موحّدة: { success, data, error } — أو الشكل القديم بدون غلاف
  if (data && data.success === true && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return data.data
  }
  return data
}

export const api = {
  /** @param {string} path @param {Record<string, string | number | boolean | undefined>} [query] */
  get(path, query) {
    const p = path.startsWith('/') ? path : `/${path}`
    const qs = query && Object.keys(query).length ? buildQuery(query) : ''
    return apiRequest(`${p}${qs}`, { method: 'GET' })
  },
  post(path, body) {
    const p = path.startsWith('/') ? path : `/${path}`
    return apiRequest(p, { method: 'POST', body: JSON.stringify(body) })
  },
  patch(path, body) {
    const p = path.startsWith('/') ? path : `/${path}`
    return apiRequest(p, { method: 'PATCH', body: JSON.stringify(body) })
  },
  put(path, body) {
    const p = path.startsWith('/') ? path : `/${path}`
    return apiRequest(p, { method: 'PUT', body: JSON.stringify(body) })
  },
  delete(path) {
    const p = path.startsWith('/') ? path : `/${path}`
    return apiRequest(p, { method: 'DELETE' })
  },
}
