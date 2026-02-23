import { resolveUserFromBearer } from './state.mjs';

export function corsMiddleware(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
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
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  }

  req.user = user;
  next();
}
