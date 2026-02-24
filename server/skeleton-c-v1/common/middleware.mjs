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

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
