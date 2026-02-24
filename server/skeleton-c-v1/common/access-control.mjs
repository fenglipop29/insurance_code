import { getState } from './state.mjs';

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function tenantContext(req, _res, next) {
  const user = req.user || null;
  const tenantId = toInt(req.headers['x-tenant-id'], toInt(user?.tenantId, 1));
  const orgId = toInt(req.headers['x-org-id'], toInt(user?.orgId, 1));
  const teamId = toInt(req.headers['x-team-id'], toInt(user?.teamId, 1));
  const ownerUserId = toInt(req.headers['x-owner-user-id'], toInt(user?.ownerUserId, toInt(user?.id, 0)));
  const actorType = String(req.headers['x-actor-type'] || (user ? 'customer' : 'employee')).toLowerCase();
  const actorId = toInt(req.headers['x-actor-id'], toInt(user?.id, 9001));

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
