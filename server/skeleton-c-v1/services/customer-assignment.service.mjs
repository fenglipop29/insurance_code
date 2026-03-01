import { appendAuditLog, persistState } from '../common/state.mjs';

export function systemAssignCustomers({
  state,
  tenantId,
  actor,
  agent,
  customers,
}) {
  const assignedAt = new Date().toISOString();
  const assigned = [];
  customers.forEach((customer) => {
    const nextOrgId = Number(agent.orgId);
    const nextTeamId = Number(agent.teamId);
    if (!Number.isFinite(nextOrgId) || !Number.isFinite(nextTeamId)) return;
    customer.ownerUserId = Number(agent.id);
    customer.orgId = nextOrgId;
    customer.teamId = nextTeamId;
    customer.updatedAt = assignedAt;
    assigned.push({
      id: Number(customer.id),
      name: String(customer.name || ''),
      mobile: String(customer.mobile || ''),
    });
  });

  appendAuditLog({
    tenantId: Number(tenantId),
    actorType: actor.actorType,
    actorId: actor.actorId,
    action: 'customer.system.assign',
    resourceType: 'customer',
    resourceId: `${assigned.length}`,
    result: 'success',
    meta: { agentId: Number(agent.id), assignedCount: assigned.length },
  });
  persistState();

  return {
    ok: true,
    assignedCount: assigned.length,
    agent: {
      id: Number(agent.id),
      name: String(agent.name || agent.email || ''),
      email: String(agent.email || ''),
    },
    customers: assigned,
  };
}

export function assignCustomerByMobile({
  state,
  actor,
  mobile,
  agent,
  customer,
}) {
  const nextTenantId = Number(agent.tenantId);
  const nextOrgId = Number(agent.orgId);
  const nextTeamId = Number(agent.teamId);
  if (!Number.isFinite(nextTenantId) || !Number.isFinite(nextOrgId) || !Number.isFinite(nextTeamId)) {
    return {
      ok: false,
      code: 'AGENT_SCOPE_INVALID',
      message: '员工租户组织信息不完整，无法分配客户',
    };
  }

  customer.tenantId = nextTenantId;
  customer.orgId = nextOrgId;
  customer.teamId = nextTeamId;
  customer.ownerUserId = Number(agent.id);
  customer.updatedAt = new Date().toISOString();

  appendAuditLog({
    tenantId: nextTenantId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    action: 'customer.assign.by_mobile',
    resourceType: 'customer',
    resourceId: String(customer.id),
    result: 'success',
    meta: { mobile, agentId: Number(agent.id) },
  });
  persistState();

  return {
    ok: true,
    customer: {
      id: Number(customer.id),
      mobile: String(customer.mobile || ''),
      tenantId: nextTenantId,
      ownerUserId: Number(customer.ownerUserId || 0),
    },
    agent: {
      id: Number(agent.id),
      tenantId: nextTenantId,
    },
  };
}
