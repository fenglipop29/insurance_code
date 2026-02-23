import { notImplemented } from '../common/not-implemented.mjs';
import { authRequired } from '../common/middleware.mjs';

export function registerUserRoutes(app) {
  app.get('/api/bootstrap', notImplemented('getBootstrap'));
  app.get('/api/me', authRequired, notImplemented('getMe'));
}
