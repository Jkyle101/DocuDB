// For production deployment, use the current host with port 3001
// For development, use localhost:3001
const isProduction = import.meta.env.PROD;
const currentHost = window.location.hostname;

export const BACKEND_URL = isProduction
  ? `http://${currentHost}:3001`
  : (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001");
