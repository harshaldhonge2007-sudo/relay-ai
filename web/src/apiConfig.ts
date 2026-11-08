/**
 * Central API configuration for RELAY AI web frontend.
 * Reads VITE_API_URL from environment variables (e.g. for Vercel pointing to Render)
 * or defaults to relative path (for local proxy / Docker Nginx).
 */
export const API_BASE = (
  ((import.meta as any).env?.VITE_API_URL as string | undefined) || ""
).replace(/\/$/, "");
export const API_PREFIX = `${API_BASE}/api`;


