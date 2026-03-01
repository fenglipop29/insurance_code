import { clearCache, getCache, setCache } from './cache';
import type { MeResponse, PointsSummaryResponse, VerifyBasicResponse } from '../types/contracts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:4000';
const TOKEN_KEY = 'insurance_token';
const CSRF_KEY = 'insurance_csrf_token';
const TENANT_ID_KEY = 'insurance_tenant_id';
const TENANT_CODE_KEY = 'insurance_tenant_code';
const ME_CACHE_KEY = 'insurance_cache_me';
const POINTS_SUMMARY_CACHE_KEY = 'insurance_cache_points_summary';
const DEFAULT_CACHE_TTL_MS = 30 * 1000;

export type User = {
  id: number;
  name: string;
  mobile: string;
  is_verified_basic: boolean;
  verified_at?: string | null;
};

export type LearningCourse = {
  id: number;
  title: string;
  desc: string;
  type: 'video' | 'comic' | 'article';
  typeLabel: string;
  progress: number;
  timeLeft: string;
  image: string;
  action: string;
  color: string;
  btnColor: string;
  points: number;
  category: string;
  content: string;
  media?: Array<any>;
  videoUrl?: string;
  status?: string;
};

export type LearningGame = {
  id: number;
  title: string;
  desc: string;
  category: string;
  difficulty: number;
  bestScore: string;
  color: string;
  lightColor: string;
  textColor: string;
};

export type LearningTool = {
  id: number;
  title: string;
  desc: string;
  color: string;
  bg: string;
};

export type InsurancePolicy = {
  id: number;
  company: string;
  name: string;
  type: string;
  icon: 'stethoscope' | 'heart-pulse' | 'shield';
  amount: number;
  nextPayment: string;
  status: string;
  applicant: string;
  insured: string;
  periodStart: string;
  periodEnd: string;
  annualPremium: number;
  paymentPeriod: string;
  coveragePeriod: string;
  responsibilities: Array<{ name: string; desc: string; limit: number }>;
  paymentHistory: Array<{ date: string; amount: number; note: string; status: string }>;
  policyNo: string;
};

export type PointDetailItem = {
  id: number;
  title: string;
  amount: number;
  balance?: number;
  direction: 'in' | 'out';
  source: string;
  createdAt: string;
};

export type PointDetailGroup = {
  key: string;
  label: string;
  items: PointDetailItem[];
};

export type Activity = {
  id: number;
  title: string;
  category: string;
  rewardPoints: number;
  sortOrder: number;
  participants?: number;
  completed?: boolean;
  canComplete?: boolean;
  image?: string;
  cover?: string;
  media?: Array<any>;
  description?: string;
  status?: string;
};

export type TrackPayload = {
  event: string;
  properties?: Record<string, unknown>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const csrfToken = getCsrfToken();
  const tenantId = getTenantId();
  const tenantCode = getTenantCode();
  const method = String(init?.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (token && csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['x-csrf-token'] = csrfToken;
  }
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (!tenantId && tenantCode) headers['x-tenant-code'] = tenantCode;
  let res: Response | null = null;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error('网络连接失败');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && (data as any).code === 'UNAUTHORIZED') {
      clearToken();
      clearCsrfToken();
    }
    const err = new Error((data as any).message || '请求失败');
    (err as any).code = (data as any).code;
    throw err;
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    clearCache(ME_CACHE_KEY, POINTS_SUMMARY_CACHE_KEY);
  }
  return data as T;
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getCsrfToken() {
  return sessionStorage.getItem(CSRF_KEY) || '';
}

export function setCsrfToken(token: string) {
  if (!token) return;
  sessionStorage.setItem(CSRF_KEY, token);
}

export function clearCsrfToken() {
  sessionStorage.removeItem(CSRF_KEY);
}

function readTenantFromUrl() {
  if (typeof window === 'undefined') return { tenantId: '', tenantCode: '' };
  const params = new URLSearchParams(window.location.search || '');
  const tenantId = String(params.get('tenantId') || params.get('tid') || '').trim();
  const tenantCode = String(params.get('tenantCode') || params.get('tenantKey') || '').trim();
  return { tenantId, tenantCode };
}

export function getTenantId() {
  if (typeof window === 'undefined') return '';
  const fromUrl = readTenantFromUrl();
  if (fromUrl.tenantId) {
    localStorage.setItem(TENANT_ID_KEY, fromUrl.tenantId);
    return fromUrl.tenantId;
  }
  return String(localStorage.getItem(TENANT_ID_KEY) || '').trim();
}

export function getTenantCode() {
  if (typeof window === 'undefined') return '';
  const fromUrl = readTenantFromUrl();
  if (fromUrl.tenantCode) {
    localStorage.setItem(TENANT_CODE_KEY, fromUrl.tenantCode);
    return fromUrl.tenantCode;
  }
  return String(localStorage.getItem(TENANT_CODE_KEY) || '').trim();
}

export const api = {
  health: () => request<{ ok: boolean; service: string }>('/api/health'),

  sendCode: (mobile: string) =>
    request<{ ok: boolean; message: string; dev_code?: string }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    }),

  verifyBasic: (name: string, mobile: string, code: string) =>
    request<VerifyBasicResponse>('/api/auth/verify-basic', {
      method: 'POST',
      body: JSON.stringify({
        name,
        mobile,
        code,
        tenantId: getTenantId() ? Number(getTenantId()) : undefined,
        tenantCode: !getTenantId() && getTenantCode() ? getTenantCode() : undefined,
      }),
    }).then((resp) => {
      setCsrfToken(resp.csrfToken || '');
      return resp;
    }),

  me: async () => {
    const cached = getCache<MeResponse>(ME_CACHE_KEY);
    if (cached) return cached;
    const resp = await request<MeResponse>('/api/me');
    if (resp.csrfToken) setCsrfToken(resp.csrfToken);
    setCache(ME_CACHE_KEY, resp, DEFAULT_CACHE_TTL_MS);
    return resp;
  },

  activities: () =>
    request<{ activities: Activity[]; balance: number; taskProgress: { total: number; completed: number } }>('/api/activities'),

  completeActivity: (id: number) =>
    request<{ ok: boolean; reward: number; balance: number }>(`/api/activities/${id}/complete`, {
      method: 'POST',
    }),

  signIn: () => request<{ ok: boolean; reward: number; balance: number }>('/api/sign-in', { method: 'POST' }),

  pointsSummary: async () => {
    const cached = getCache<PointsSummaryResponse>(POINTS_SUMMARY_CACHE_KEY);
    if (cached) return cached;
    const resp = await request<PointsSummaryResponse>('/api/points/summary');
    setCache(POINTS_SUMMARY_CACHE_KEY, resp, DEFAULT_CACHE_TTL_MS);
    return resp;
  },

  pointsTransactions: () => request<{ list: any[] }>('/api/points/transactions'),
  pointsDetail: () => request<{ balance: number; groups: PointDetailGroup[] }>('/api/points/detail'),

  mallItems: () => request<{ items: any[] }>('/api/mall/items'),
  mallActivities: () => request<{ list: any[] }>('/api/mall/activities'),

  redeem: (itemId: number) =>
    request<{
      ok: boolean;
      token: string;
      balance: number;
      redemption: {
        id: number;
        orderNo: string;
        itemName: string;
        pointsCost: number;
        status: string;
        expiresAt: string;
        writeoffToken: string;
      };
    }>('/api/mall/redeem', {
      method: 'POST',
      headers: { 'x-action-confirm': 'YES' },
      body: JSON.stringify({ itemId }),
    }),

  joinMallActivity: (id: number) =>
    request<{ ok: boolean; duplicated: boolean; reward: number; balance: number; activity?: { id: number; title: string } }>(
      `/api/mall/activities/${id}/join`,
      {
        method: 'POST',
      }
    ),

  redemptions: () => request<{ list: any[] }>('/api/redemptions'),

  writeoff: (id: number, token?: string) =>
    request<{ ok: boolean }>(`/api/redemptions/${id}/writeoff`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  learningCourses: () => request<{ categories: string[]; courses: LearningCourse[] }>('/api/learning/courses'),

  learningCourseDetail: (id: number) => request<{ course: LearningCourse }>(`/api/learning/courses/${id}`),

  completeCourse: (id: number) =>
    request<{ ok: boolean; duplicated: boolean; reward: number; balance: number; message?: string }>(`/api/learning/courses/${id}/complete`, {
      method: 'POST',
    }),

  learningGames: () => request<{ games: LearningGame[] }>('/api/learning/games'),

  learningTools: () => request<{ tools: LearningTool[] }>('/api/learning/tools'),

  insuranceOverview: () =>
    request<{
      summary: { totalCoverage: number; healthScore: number; activePolicies: number; annualPremium: number };
      familyMembers: Array<{ id: number; name: string; avatar: string; score: number; coveredTypes: string[] }>;
      reminders: Array<{ id: number; title: string; desc: string; tag: string; actionText: string; kind: string }>;
    }>('/api/insurance/overview'),

  insurancePolicies: () => request<{ policies: InsurancePolicy[] }>('/api/insurance/policies'),

  insurancePolicyDetail: (id: number) => request<{ policy: InsurancePolicy }>(`/api/insurance/policies/${id}`),

  scanPolicy: () =>
    request<{ ok: boolean; data: any }>('/api/insurance/policies/scan', {
      method: 'POST',
    }),

  createPolicy: (payload: {
    company: string;
    name: string;
    applicant: string;
    insured: string;
    date: string;
    paymentPeriod: string;
    coveragePeriod: string;
    amount: number;
    firstPremium: number;
    type?: string;
  }) =>
    request<{ ok: boolean; policy: InsurancePolicy }>('/api/insurance/policies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  trackEvent: (payload: TrackPayload) =>
    request<{ ok: boolean }>('/api/track/events', {
      method: 'POST',
      headers: {
        'x-client-source': 'c-web',
        'x-client-path': typeof window === 'undefined' ? '' : window.location.pathname,
      },
      body: JSON.stringify(payload),
    }),
};
