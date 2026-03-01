import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  appendAuditLog: vi.fn(),
  persistState: vi.fn(),
}));

import { assignCustomerByMobile, systemAssignCustomers } from '../server/skeleton-c-v1/services/customer-assignment.service.mjs';

describe('customer assignment service', () => {
  it('system assign updates owner/team/org for selected customers', () => {
    const customers: Array<any> = [
      { id: 1, name: 'A', mobile: '13800000001' },
      { id: 2, name: 'B', mobile: '13800000002' },
    ];
    const result = systemAssignCustomers({
      state: {},
      tenantId: 2,
      actor: { actorType: 'employee', actorId: 9001 },
      agent: { id: 201, orgId: 20, teamId: 30, name: 'agent' },
      customers,
    });

    expect(result.assignedCount).toBe(2);
    expect(customers.every((c) => c.ownerUserId === 201 && c.orgId === 20 && c.teamId === 30)).toBe(true);
  });

  it('assign by mobile updates tenant ownership', () => {
    const customer = { id: 10, mobile: '13800000010', ownerUserId: 0, tenantId: 1, orgId: 1, teamId: 1 };
    const result = assignCustomerByMobile({
      state: {},
      actor: { actorType: 'employee', actorId: 9001 },
      mobile: '13800000010',
      agent: { id: 301, tenantId: 8, orgId: 80, teamId: 81 },
      customer,
    });

    expect(customer.ownerUserId).toBe(301);
    expect(customer.tenantId).toBe(8);
    expect(result.customer.ownerUserId).toBe(301);
  });
});
