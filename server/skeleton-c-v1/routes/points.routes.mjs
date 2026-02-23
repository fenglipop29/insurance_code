import { notImplemented } from '../common/not-implemented.mjs';
import { authRequired } from '../common/middleware.mjs';

export function registerPointsRoutes(app) {
  app.get('/api/points/summary', authRequired, notImplemented('getPointsSummary'));
  app.get('/api/points/transactions', authRequired, notImplemented('getPointsTransactions'));
}
