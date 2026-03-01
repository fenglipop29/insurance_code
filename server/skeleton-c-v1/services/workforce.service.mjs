function buildError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.exposeMessage = message;
  return err;
}

export function resolveCompanyAdminTenantContext({ state, actor, hasRole, tenantContext, scopeName = '本租户资源' }) {
  if (String(actor?.actorType) !== 'employee' || !hasRole(state, actor, 'company_admin')) {
    throw buildError(403, 'COMPANY_ACCOUNT_REQUIRED', `仅公司账号可管理${scopeName}`);
  }
  const tenantId = Number(tenantContext?.tenantId || 0);
  if (!Number.isFinite(tenantId) || tenantId <= 0) {
    throw buildError(400, 'TENANT_CONTEXT_REQUIRED', '缺少租户上下文');
  }
  const orgId = Number(tenantContext?.orgId || 0);
  return { tenantId, orgId };
}

export function assertPlatformOrCompanyAdmin({ state, actor, hasRole, actionMessage }) {
  const isPlatformAdmin = hasRole(state, actor, 'platform_admin');
  const isCompanyAdmin = hasRole(state, actor, 'company_admin');
  const isAllowed = isPlatformAdmin || (String(actor?.actorType) === 'employee' && isCompanyAdmin);
  if (!isAllowed) {
    throw buildError(403, 'COMPANY_ACCOUNT_REQUIRED', actionMessage);
  }
  return { isPlatformAdmin, isCompanyAdmin };
}

export function toHttpError(err) {
  return {
    status: Number(err?.status || 500),
    code: String(err?.code || 'INTERNAL_ERROR'),
    message: String(err?.exposeMessage || err?.message || '服务异常'),
  };
}
