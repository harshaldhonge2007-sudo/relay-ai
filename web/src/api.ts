/**
 * Global API helper with server-issued session tokens.
 * demo authentication — not for production.
 *
 * Roles are NEVER asserted directly by headers; the client calls /auth/demo-login
 * to obtain a signed token and passes it via Authorization: Bearer <token>.
 */

export type RelayRole = 'engineering_lead' | 'successor' | 'contractor';
export type DemoUserKey = 'lead' | 'successor' | 'contractor';

export const ROLE_TO_USER: Record<RelayRole, DemoUserKey> = {
  engineering_lead: 'lead',
  successor: 'successor',
  contractor: 'contractor',
};

export const API_BASE = (
  ((import.meta as any).env?.VITE_API_URL as string | undefined) || ''
).replace(/\/$/, '');
export const API_PREFIX = `${API_BASE}/api`;

let _currentRole: RelayRole = 'successor';
let _currentToken: string | null = null;

// Initialize from session storage if present
if (typeof window !== 'undefined' && window.sessionStorage) {
  _currentToken = sessionStorage.getItem('relay_demo_token');
  const savedRole = sessionStorage.getItem('relay_demo_role') as RelayRole | null;
  if (savedRole && (savedRole === 'engineering_lead' || savedRole === 'successor' || savedRole === 'contractor')) {
    _currentRole = savedRole;
  }
}

export async function setApiRole(role: RelayRole): Promise<string> {
  _currentRole = role;
  const user = ROLE_TO_USER[role];
  try {
    const res = await fetch(`${API_PREFIX}/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
    if (res.ok) {
      const data = await res.json();
      _currentToken = data.token;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('relay_demo_token', data.token);
        sessionStorage.setItem('relay_demo_role', role);
      }
      return data.token;
    }
  } catch (err) {
    console.warn('[demo authentication] Failed to exchange token:', err);
  }
  return _currentToken || '';
}

export function getApiRole(): RelayRole {
  return _currentRole;
}

export function getApiToken(): string | null {
  return _currentToken;
}

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (_currentToken) {
    headers.set('authorization', `Bearer ${_currentToken}`);
  }
  // X-Relay-Role header only indicates desired demo user key, NEVER directly asserts role
  headers.set('x-relay-role', _currentRole);
  headers.set('content-type', 'application/json');
  return fetch(`${API_PREFIX}${path}`, { ...options, headers });
}

