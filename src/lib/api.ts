const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:4000';
const TOKEN_KEY = 'insurance_token';

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
};

export type TrackPayload = {
  event: string;
  properties?: Record<string, unknown>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
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
    }
    const err = new Error((data as any).message || '请求失败');
    (err as any).code = (data as any).code;
    throw err;
  }
  return data as T;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = {
  health: () => request<{ ok: boolean; service: string }>('/api/health'),

  sendCode: (mobile: string) =>
    request<{ ok: boolean; message: string; dev_code?: string }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    }),

  verifyBasic: (name: string, mobile: string, code: string) =>
    request<{ token: string; user: User }>('/api/auth/verify-basic', {
      method: 'POST',
      body: JSON.stringify({ name, mobile, code }),
    }),

  me: () => request<{ user: User; balance: number }>('/api/me'),

  activities: () =>
    request<{ activities: Activity[]; balance: number; taskProgress: { total: number; completed: number } }>('/api/activities'),

  completeActivity: (id: number) =>
    request<{ ok: boolean; reward: number; balance: number }>(`/api/activities/${id}/complete`, {
      method: 'POST',
    }),

  signIn: () => request<{ ok: boolean; reward: number; balance: number }>('/api/sign-in', { method: 'POST' }),

  pointsSummary: () => request<{ balance: number }>('/api/points/summary'),

  pointsTransactions: () => request<{ list: any[] }>('/api/points/transactions'),
  pointsDetail: () => request<{ balance: number; groups: PointDetailGroup[] }>('/api/points/detail'),

  mallItems: () => request<{ items: any[] }>('/api/mall/items'),

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
      body: JSON.stringify({ itemId }),
    }),

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
