import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  resolveActorCsrfToken: vi.fn(() => 'csrf-actor-1'),
  resolveSessionFromBearer: vi.fn(() => ({ csrfToken: 'csrf-user-1' })),
  resolveUserFromBearer: vi.fn(() => ({ id: 1 })),
}));

import { csrfProtection, requireActionConfirmation } from '../server/skeleton-c-v1/common/middleware.mjs';

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

describe('security middleware', () => {
  it('rejects mutating actor request when csrf token invalid', () => {
    process.env.CSRF_PROTECTION = 'true';
    const req: any = {
      method: 'POST',
      headers: {
        'x-tenant-id': '2',
        'x-actor-type': 'employee',
        'x-actor-id': '9001',
        'x-csrf-token': 'wrong-token',
      },
      user: null,
      session: null,
    };
    const res = createRes();
    const next = vi.fn();
    csrfProtection(req, res as any, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requires x-action-confirm on sensitive operation', () => {
    process.env.REQUIRE_SENSITIVE_CONFIRM = 'true';
    const req: any = { method: 'POST', headers: {} };
    const res = createRes();
    const next = vi.fn();
    requireActionConfirmation('积分兑换')(req, res as any, next);
    expect(res.statusCode).toBe(428);
    expect(next).not.toHaveBeenCalled();
  });
});
