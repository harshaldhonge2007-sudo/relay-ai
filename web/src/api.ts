/**
 * Global API helper with role header injection.
 * All fetch calls should go through apiFetch() so the X-Relay-Role header
 * is always present. This is enforced server-side; the client only sets it.
 */

export type RelayRole = 'engineering_lead' | 'successor' | 'contractor';

export const API_BASE = (
  ((import.meta as any).env?.VITE_API_URL as string | undefined) || ''
).replace(/\/$/, '');
export const API_PREFIX = `${API_BASE}/api`;

let _currentRole: RelayRole = 'successor';

export function setApiRole(role: RelayRole) {
  _currentRole = role;
}

export function getApiRole(): RelayRole {
  return _currentRole;
}

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('x-relay-role', _currentRole);
  headers.set('content-type', 'application/json');
  return fetch(`${API_PREFIX}${path}`, { ...options, headers });
}

