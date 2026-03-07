// Backend URL strategy:
// 1) If VITE_BACKEND_URL is a real URL, use it (explicit override)
// 2) If VITE_BACKEND_URL=auto or empty, auto-detect from current browser host
//    e.g. if you open http://192.168.1.25:5173, backend becomes http://192.168.1.25:3001
const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL || "").trim();
const explicitBackendUrl = rawBackendUrl.toLowerCase() === "auto" ? "" : rawBackendUrl;
const currentProtocol = window.location.protocol === "https:" ? "https:" : "http:";
const currentHost = window.location.hostname;
const backendPort = (import.meta.env.VITE_BACKEND_PORT || "3001").trim();

export const BACKEND_URL =
  explicitBackendUrl || `${currentProtocol}//${currentHost}:${backendPort}`;
