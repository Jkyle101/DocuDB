// Enforce relative API calls in all environments.
// If an absolute URL is provided by env, fall back to /api.
const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL || "/api").trim();
const normalizedBackendUrl = rawBackendUrl.replace(/\/+$/, "") || "/api";
const isAbsoluteUrl = /^https?:\/\//i.test(normalizedBackendUrl);

export const BACKEND_URL = (isAbsoluteUrl ? "/api" : normalizedBackendUrl) || "/api";
export const UPLOADS_URL = BACKEND_URL === "/api" ? "/uploads" : `${BACKEND_URL}/uploads`;

export function buildUploadUrl(filename, version = 0) {
  const rawName = String(filename || "").trim();
  if (!rawName) return "";

  if (/^https?:\/\//i.test(rawName)) {
    const query = Number(version) > 0 ? `${rawName.includes("?") ? "&" : "?"}v=${Number(version)}` : "";
    return `${rawName}${query}`;
  }

  const safeName = rawName
    .replace(/^\/+/, "")
    .replace(/^api\/uploads\//i, "")
    .replace(/^uploads\//i, "");

  if (!safeName) return "";

  const query = Number(version) > 0 ? `?v=${Number(version)}` : "";
  return `${UPLOADS_URL}/${safeName}${query}`;
}
