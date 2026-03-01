import { describe, expect, it } from 'vitest';
import { canAccessTemplate } from '../server/skeleton-c-v1/common/template-visibility.mjs';

const baseState = {
  roles: [
    { id: 1, key: 'company_admin' },
    { id: 2, key: 'team_lead' },
    { id: 3, key: 'agent' },
  ],
  userRoles: [
    { tenantId: 2, userType: 'employee', userId: 101, roleId: 1 },
    { tenantId: 2, userType: 'employee', userId: 102, roleId: 2 },
    { tenantId: 2, userType: 'agent', userId: 201, roleId: 3 },
  ],
  users: [{ id: 501, ownerUserId: 201, tenantId: 2 }],
};

describe('template visibility', () => {
  it('customer only sees owner agent templates', () => {
    const actor = { actorType: 'customer', actorId: 501, tenantId: 2 };
    const ownedItem = { tenantId: 2, createdBy: 201, creatorRole: 'agent' };
    const otherItem = { tenantId: 2, createdBy: 999, creatorRole: 'agent' };

    expect(canAccessTemplate(baseState, actor, ownedItem)).toBe(true);
    expect(canAccessTemplate(baseState, actor, otherItem)).toBe(false);
  });

  it('team lead can see same-tenant agent templates', () => {
    const actor = { actorType: 'employee', actorId: 102, tenantId: 2 };
    const sameTenant = { tenantId: 2, createdBy: 201, creatorRole: 'agent' };
    const otherTenant = { tenantId: 3, createdBy: 201, creatorRole: 'agent' };

    expect(canAccessTemplate(baseState, actor, sameTenant)).toBe(true);
    expect(canAccessTemplate(baseState, actor, otherTenant)).toBe(false);
  });
});
