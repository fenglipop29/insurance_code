import { getState } from './state.mjs';

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function tenantContext(req, _res, next) {
  const user = req.user || null;
  const path = String(req.path || '');
  const isAdminPath = path.startsWith('/api/p/') || path.startsWith('/api/b/');

  if (isAdminPath && !user) {
    return _res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  }

  const tenantId = toInt(user?.tenantId, toInt(req.headers['x-tenant-id'], null));
  const orgId = toInt(user?.orgId, toInt(req.headers['x-org-id'], null));
  const teamId = toInt(user?.teamId, toInt(req.headers['x-team-id'], null));
  const ownerUserId = toInt(user?.ownerUserId, toInt(req.headers['x-owner-user-id'], null));
  const actorType = String(user?.actorType || req.headers['x-actor-type'] || (user ? 'customer' : 'anonymous')).toLowerCase();
  const actorId = toInt(user?.id, toInt(req.headers['x-actor-id'], null));

  req.tenantContext = { tenantId, orgId, teamId, ownerUserId };
  req.actor = { actorType, actorId, tenantId, orgId, teamId };
  next();
}

export function permissionRequired(permissionKey) {
  return (req, res, next) => {
    const state = getState();
    const actor = req.actor || {};
    const roleIds = (state.userRoles || [])
      .filter(
        (row) =>
          Number(row.tenantId) === Number(actor.tenantId) &&
          String(row.userType) === String(actor.actorType) &&
          Number(row.userId) === Number(actor.actorId)
      )
      .map((row) => Number(row.roleId));

    const permission = (state.permissions || []).find((row) => row.key === permissionKey);
    if (!permission) {
      return res.status(500).json({ code: 'PERMISSION_NOT_DEFINED', message: `权限未定义: ${permissionKey}` });
    }

    const granted = (state.rolePermissions || []).some(
      (row) => roleIds.includes(Number(row.roleId)) && Number(row.permissionId) === Number(permission.id)
    );
    if (!granted) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '暂无权限，请联系管理员' });
    }
    return next();
  };
}

export function dataScope(resourceType) {
  return (req, _res, next) => {
    const state = getState();
    const actor = req.actor || {};
    const roleIds = (state.userRoles || [])
      .filter(
        (row) =>
          Number(row.tenantId) === Number(actor.tenantId) &&
          String(row.userType) === String(actor.actorType) &&
          Number(row.userId) === Number(actor.actorId)
      )
      .map((row) => Number(row.roleId));

    const permissionIds = (state.rolePermissions || [])
      .filter((row) => roleIds.includes(Number(row.roleId)))
      .map((row) => Number(row.permissionId));
    const permissionKeys = (state.permissions || [])
      .filter((row) => permissionIds.includes(Number(row.id)))
      .map((row) => row.key);

    const hasTenantAll = permissionKeys.includes('scope:tenant:all');
    const hasTeamAll = permissionKeys.includes('scope:team:all');

    const scope = {
      tenantId: actor.tenantId,
      teamId: actor.teamId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      resourceType,
      hasTenantAll,
      hasTeamAll,
      canAccessCustomer(customer) {
        if (!customer || Number(customer.tenantId) !== Number(actor.tenantId)) return false;
        if (hasTenantAll) return true;
        if (hasTeamAll) return Number(customer.teamId) === Number(actor.teamId);
        if (actor.actorType === 'customer') return Number(customer.id) === Number(actor.actorId);
        if (actor.actorType === 'agent') return Number(customer.ownerUserId) === Number(actor.actorId);
        return false;
      },
    };

    req.dataScope = scope;
    next();
  };
}
