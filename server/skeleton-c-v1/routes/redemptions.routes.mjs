import { notImplemented } from '../common/not-implemented.mjs';
import { authRequired } from '../common/middleware.mjs';

export function registerRedemptionsRoutes(app) {
  app.get('/api/redemptions', authRequired, notImplemented('getRedemptions'));
  app.post('/api/redemptions/:id/writeoff', authRequired, notImplemented('postRedemptionsWriteoff'));
}
