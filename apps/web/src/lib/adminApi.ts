import { getSupabase } from './supabaseClient';

async function getToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export function fetchUsers(q = '', page = 1, limit = 20) {
  const params = new URLSearchParams({ q, page: String(page), limit: String(limit) });
  return adminFetch(`/api/admin/users?${params}`);
}

export function fetchUser(userId: string) {
  return adminFetch(`/api/admin/users/${userId}`);
}

export function patchUser(userId: string, body: Record<string, unknown>) {
  return adminFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function fetchRooms() {
  return adminFetch('/api/admin/rooms');
}

export function closeRoom(roomCode: string) {
  return adminFetch('/api/admin/rooms', {
    method: 'DELETE',
    body: JSON.stringify({ roomCode }),
  });
}

export function fetchAuditLog(page = 1, limit = 50) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return adminFetch(`/api/admin/audit?${params}`);
}
