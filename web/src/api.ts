/**
 * Global API helper with server-issued session tokens and standalone offline fallback.
 *
 * Roles are NEVER asserted directly by headers; the client calls /auth/demo-login
 * to obtain a signed token and passes it via Authorization: Bearer <token>.
 *
 * If the backend API is unreachable or not yet deployed (e.g. standalone Vercel preview),
 * it seamlessly serves the authentic seed demo fixtures so the UI is 100% functional.
 */

import { handleMockApi } from './fixtures/mockApi';

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
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      _currentToken = data.token;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('relay_demo_token', data.token);
        sessionStorage.setItem('relay_demo_role', role);
      }
      return data.token;
    }
  } catch {
    // Offline / Standalone preview fallback
  }

  // Graceful standalone fallback
  const mockRes = handleMockApi('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ user }),
  }, role);
  const data = await mockRes.json();
  _currentToken = data.token;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.setItem('relay_demo_token', data.token);
    sessionStorage.setItem('relay_demo_role', role);
  }
  return data.token;
}

export function getApiRole(): RelayRole {
  return _currentRole;
}

export function getApiToken(): string | null {
  return _currentToken;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (_currentToken) {
    headers.set('authorization', `Bearer ${_currentToken}`);
  }
  // X-Relay-Role header only indicates desired demo user key, NEVER directly asserts role
  headers.set('x-relay-role', _currentRole);
  headers.set('content-type', 'application/json');

  // Try real backend API if available
  try {
    const res = await fetch(`${API_PREFIX}${path}`, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    // If the server answered with valid JSON, return it
    if (res.ok && contentType.includes('application/json')) {
      return res;
    }
    // If Vercel rewrote /api to index.html or returned 404, fall through to mock
  } catch {
    // Network / CORS / Offline error — fall through to mock
  }

  // Standalone offline fallback
  return handleMockApi(path, options, _currentRole);
}
