// Enforce relative API calls in all environments.
// If an absolute URL is provided by env, fall back to /api.
const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL || "/api").trim();
const isAbsoluteUrl = /^https?:\/\//i.test(rawBackendUrl);

export const BACKEND_URL = (isAbsoluteUrl ? "/api" : rawBackendUrl)
  .replace(/\/+$/, "") || "/api";
