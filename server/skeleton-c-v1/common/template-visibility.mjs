export function hasRole(state, { tenantId, userType, userId }, roleKey) {
  const roles = Array.isArray(state?.roles) ? state.roles : [];
  const userRoles = Array.isArray(state?.userRoles) ? state.userRoles : [];
  const roleIds = userRoles
    .filter(
      (row) =>
        Number(row.tenantId) === Number(tenantId) &&
        String(row.userType) === String(userType) &&
        Number(row.userId) === Number(userId)
    )
    .map((row) => Number(row.roleId));
  return roles.some((role) => roleIds.includes(Number(role.id)) && String(role.key) === String(roleKey));
}

function actorIdentity(actor = {}) {
  return {
    tenantId: Number(actor.tenantId || 1),
    userType: String(actor.actorType || 'employee'),
    userId: Number(actor.actorId || 0),
  };
}

function resolveCreatorRole(state, item = {}) {
  const createdBy = Number(item.createdBy || 0);
  if (!createdBy) return 'unknown';
  const explicitRole = String(item.creatorRole || '').trim();
  if (explicitRole) return explicitRole;
  if (String(item.templateScope || '').toLowerCase() === 'platform') return 'platform_admin';
  const tenantId = Number(item.tenantId || 1);
  if (hasRole(state, { tenantId, userType: 'employee', userId: createdBy }, 'platform_admin')) return 'platform_admin';
  if (hasRole(state, { tenantId, userType: 'employee', userId: createdBy }, 'company_admin')) return 'company_admin';
  if (hasRole(state, { tenantId, userType: 'employee', userId: createdBy }, 'team_lead')) return 'team_lead';
  if (hasRole(state, { tenantId, userType: 'agent', userId: createdBy }, 'agent')) return 'agent';
  return 'unknown';
}

function resolveActorRole(state, actor = {}) {
  const identity = actorIdentity(actor);
  if (hasRole(state, identity, 'platform_admin')) return 'platform_admin';
  if (hasRole(state, identity, 'company_admin')) return 'company_admin';
  if (hasRole(state, identity, 'team_lead')) return 'team_lead';
  if (hasRole(state, identity, 'agent')) return 'agent';
  return 'unknown';
}

export function isPlatformTemplate(state, item = {}) {
  const creatorRole = resolveCreatorRole(state, item);
  if (creatorRole === 'platform_admin') return true;
  const createdBy = Number(item.createdBy || 0);
  if (!createdBy) return false;
  return hasRole(state, { tenantId: Number(item.tenantId || 1), userType: 'employee', userId: createdBy }, 'platform_admin');
}

export function canAccessTemplate(state, actor = {}, item = {}) {
  const actorRole = resolveActorRole(state, actor);
  const creatorRole = resolveCreatorRole(state, item);
  const sameTenant = Number(item.tenantId || 1) === Number(actor.tenantId || 1);
  const sameCreator = Number(item.createdBy || 0) === Number(actor.actorId || 0);
  // Backward compatibility:
  // old seeded/runtime rows may miss creatorRole/userRoles, yielding "unknown".
  // For same-tenant tenant-scope content, treat unknown as tenant-side templates.
  const tenantSideRoles = ['company_admin', 'team_lead', 'agent', 'unknown'];

  if (actorRole === 'platform_admin') {
    // 平台管理员仅看自己创建的平台模板
    return creatorRole === 'platform_admin' && sameCreator;
  }
  if (actorRole === 'company_admin') {
    // 公司管理员可看平台模板 + 本租户模板
    if (creatorRole === 'platform_admin') return true;
    return sameTenant && tenantSideRoles.includes(creatorRole);
  }
  if (actorRole === 'team_lead') {
    // 团队主管可看本租户模板（不直接看平台模板）
    return sameTenant && tenantSideRoles.includes(creatorRole);
  }
  if (actorRole === 'agent') {
    // 业务员可看本租户模板（不直接看平台模板）
    return sameTenant && tenantSideRoles.includes(creatorRole);
  }
  if (String(actor.actorType || '') === 'customer') {
    const customers = Array.isArray(state?.users) ? state.users : [];
    const customer = customers.find((row) => Number(row.id) === Number(actor.actorId || 0));
    // 客户视角严格按“归属业务员”过滤：仅展示 ownerUserId 对应业务员创建且生效的内容。
    if (!customer) return false;
    const ownerUserId = Number(customer.ownerUserId || 0);
    if (ownerUserId <= 0) return false;
    return sameTenant && Number(item.createdBy || 0) === ownerUserId;
  }
  return false;
}
