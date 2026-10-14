// SPDX-License-Identifier: MIT
import type {
  AuthResponse, DashboardSummary, MapMarker, SpringTrends, BlockRollup,
  AlertItem, OverdueItem, KrpRow,
  SpringManaged, UploadResult, UploadHistoryItem, PaginatedReadings,
  KrpManaged, Village,
} from './types';

const TOKEN_KEY = 'jalsakhi.token';
const USER_KEY = 'jalsakhi.user';

// In dev the Vite proxy maps /api → backend. In prod we serve the dashboard
// from the same nginx as the API, so /api is a same-origin path.
const BASE = '/api';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

export const userStore = {
  get: () => { const s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null; },
  set: (u: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, msg: string) { super(msg); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type') && init.body && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  const tok = tokenStore.get();
  if (tok) headers.set('authorization', `Bearer ${tok}`);

  const res = await fetch(BASE + path, { ...init, headers });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const code = data?.error?.code || 'HTTP_' + res.status;
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(res.status, code, msg);
  }
  return data as T;
}
function safeJson(t: string) { try { return JSON.parse(t); } catch { return null; } }

export interface PendingKrp {
  id: string; name: string; phone: string; created_at: string;
  signup_note: string | null; village_id: string | null;
  village_name: string | null; block: string | null; district: string | null;
}

export const api = {
  // auth — backend accepts either phone or email in `identifier`
  login: (identifier: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),

  // KRP approval queue
  pendingKrps: () => request<{ items: PendingKrp[]; count: number }>('/krp/pending'),
  approveKrp: (id: string) =>
    request<{ ok: true }>(`/krp/${id}/approve`, { method: 'POST' }),
  rejectKrp: (id: string, reason: string) =>
    request<{ ok: true }>(`/krp/${id}/reject`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),

  // dashboard
  summary: () => request<DashboardSummary>('/dashboard/summary'),
  map: () => request<{ items: MapMarker[] }>('/dashboard/map'),
  springTrends: (id: string) => request<SpringTrends>(`/dashboard/spring/${id}/trends`),
  blocks: () => request<{ items: BlockRollup[] }>('/dashboard/blocks'),
  alerts: () => request<{ anomalies: AlertItem[]; overdue: OverdueItem[] }>('/dashboard/alerts'),
  krpPerformance: () => request<{ items: KrpRow[] }>('/dashboard/krp-performance'),

  // reminders
  notifyKrp: (krp_id: string, message: string) =>
    request<{ ok: true }>('/reminders/notify', {
      method: 'POST',
      body: JSON.stringify({ krp_id, message }),
    }),

  // raw readings (Excel export feeds off this)
  readings: (params: { spring_id?: string; from?: string; to?: string; kind?: 'discharge' | 'quality'; limit?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return request<{ items: unknown[]; kind: string }>(`/readings?${qs.toString()}`);
  },

  // Spring management
  springsAll: () => request<{ items: SpringManaged[]; count: number }>('/springs/all'),
  springCreate: (data: Record<string, unknown>) => request<{ ok: boolean; spring: SpringManaged }>('/springs', { method: 'POST', body: JSON.stringify(data) }),
  springUpdate: (id: string, data: Record<string, unknown>) => request<{ ok: boolean }>(`/springs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  springDeactivate: (id: string) => request<{ ok: boolean }>(`/springs/${id}/deactivate`, { method: 'PATCH' }),
  springActivate: (id: string) => request<{ ok: boolean }>(`/springs/${id}/activate`, { method: 'PATCH' }),
  springsUpload: (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return request<UploadResult>('/springs/upload', { method: 'POST', body: fd });
  },
  springsUploadHistory: () => request<{ items: UploadHistoryItem[] }>('/springs/upload-history'),

  // Readings explorer
  dashboardReadings: (params: { spring_id?: string; krp_id?: string; kind?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return request<PaginatedReadings>(`/dashboard/readings?${qs.toString()}`);
  },

  // KRP management
  krpAll: () => request<{ items: KrpManaged[]; count: number }>('/krp/all'),
  krpUpdate: (id: string, data: Record<string, unknown>) => request<{ ok: boolean }>(`/krp/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Villages
  villages: () => request<{ items: Village[] }>('/dashboard/villages'),
};
