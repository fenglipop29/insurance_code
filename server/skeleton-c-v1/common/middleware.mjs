import { resolveUserFromBearer } from './state.mjs';

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
  const allowHeaders = requestAllowHeaders || 'Content-Type, Authorization, x-actor-type, x-actor-id, x-tenant-id, x-client-source, x-client-path';

  res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');
  res.setHeader('Access-Control-Allow-Headers', allowHeaders);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

export function authRequired(req, res, next) {
  const user = resolveUserFromBearer(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  }
  req.user = user;
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
  next();
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
