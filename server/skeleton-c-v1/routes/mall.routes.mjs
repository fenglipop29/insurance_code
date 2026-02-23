import { notImplemented } from '../common/not-implemented.mjs';
import { authRequired } from '../common/middleware.mjs';

export function registerMallRoutes(app) {
  app.get('/api/mall/items', notImplemented('getMallItems'));
  app.post('/api/mall/redeem', authRequired, notImplemented('postMallRedeem'));
}
