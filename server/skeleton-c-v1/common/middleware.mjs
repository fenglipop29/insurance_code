import { resolveActorCsrfToken, resolveSessionFromBearer, resolveUserFromBearer } from './state.mjs';

export function corsMiddleware(req, res, next) {
  const requestOrigin = req.headers.origin;
  const rawOrigins = String(process.env.CORS_ORIGIN || '').trim();
  const configuredOrigins = rawOrigins
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const isLocalDevOrigin = typeof requestOrigin === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin);
  const isConfiguredOrigin = typeof requestOrigin === 'string' && configuredOrigins.includes(requestOrigin);

  if (rawOrigins === '*' || (!configuredOrigins.length && !requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (isLocalDevOrigin || isConfiguredOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  } else if (configuredOrigins.length) {
    res.setHeader('Access-Control-Allow-Origin', configuredOrigins[0]);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  const requestAllowHeaders = String(req.headers['access-control-request-headers'] || '').trim();
  const allowHeaders =
    requestAllowHeaders ||
    'Content-Type, Authorization, x-csrf-token, x-action-confirm, x-actor-type, x-actor-id, x-tenant-id, x-tenant-code, x-tenant-key, x-client-source, x-client-path';

  res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');
  res.setHeader('Access-Control-Allow-Headers', allowHeaders);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

export function authRequired(req, res, next) {
  const session = resolveSessionFromBearer(req.headers.authorization);
  const user = resolveUserFromBearer(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  }
  req.user = user;
  req.session = session;
  next();
}

export function authOptional(req, res, next) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth) {
    req.user = null;
    return next();
  }

  const user = resolveUserFromBearer(auth);
  if (!user) {
    // For optional-auth endpoints, invalid/expired tokens should degrade to anonymous access.
    req.user = null;
    return next();
  }

  req.user = user;
  req.session = resolveSessionFromBearer(auth);
  next();
}

export function adminApiAuthRequired(req, res, next) {
  const path = String(req.path || '');
  const isAdminPath = path.startsWith('/api/p/') || path.startsWith('/api/b/');
  const isLoginPath = path === '/api/p/auth/login' || path === '/api/b/auth/login';
  if (!isAdminPath || isLoginPath) return next();
  return authRequired(req, res, next);
}

function isMutatingMethod(method) {
  const m = String(method || '').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

export function csrfProtection(req, res, next) {
  const enabled = String(process.env.CSRF_PROTECTION || 'true').toLowerCase() === 'true';
  if (!enabled || !isMutatingMethod(req.method)) return next();
  if (req.user && req.session) {
    const csrfHeader = String(req.headers['x-csrf-token'] || '').trim();
    const expected = String(req.session.csrfToken || '').trim();
    if (!csrfHeader || !expected || csrfHeader !== expected) {
      return res.status(403).json({ code: 'CSRF_INVALID', message: 'CSRF 校验失败，请刷新后重试' });
    }
    return next();
  }

  const actorType = String(req.headers['x-actor-type'] || '').trim();
  const actorId = Number(req.headers['x-actor-id'] || 0);
  const tenantId = Number(req.headers['x-tenant-id'] || 0);
  if (!actorType || !actorId || !tenantId) return next();
  const csrfHeader = String(req.headers['x-csrf-token'] || '').trim();
  const expected = resolveActorCsrfToken({ tenantId, actorType, actorId });
  if (!csrfHeader || !expected || csrfHeader !== expected) {
    return res.status(403).json({ code: 'CSRF_INVALID', message: 'CSRF 校验失败，请刷新后重试' });
  }
  return next();
}

export function requireActionConfirmation(actionName = '敏感操作') {
  return (req, res, next) => {
    const enabled = String(process.env.REQUIRE_SENSITIVE_CONFIRM || 'true').toLowerCase() === 'true';
    if (!enabled || !isMutatingMethod(req.method)) return next();
    const confirmed = String(req.headers['x-action-confirm'] || '').trim();
    if (confirmed !== 'YES') {
      return res.status(428).json({
        code: 'ACTION_CONFIRM_REQUIRED',
        message: `${actionName} 需要二次确认`,
      });
    }
    return next();
  };
}

function toIssues(error) {
  return (error?.issues || []).map((item) => ({
    path: Array.isArray(item.path) ? item.path.join('.') : '',
    message: item.message,
  }));
}

export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: '请求参数不合法',
        issues: toIssues(parsed.error),
      });
    }
    req.body = parsed.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params || {});
    if (!parsed.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: '请求参数不合法',
        issues: toIssues(parsed.error),
      });
    }
    req.params = parsed.data;
    next();
  };
}
