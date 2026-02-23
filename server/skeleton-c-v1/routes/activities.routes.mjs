import { notImplemented } from '../common/not-implemented.mjs';
import { authRequired } from '../common/middleware.mjs';

export function registerActivitiesRoutes(app) {
  app.get('/api/activities', notImplemented('getActivities'));
  app.post('/api/activities/:id/complete', authRequired, notImplemented('postActivitiesComplete'));
  app.post('/api/sign-in', authRequired, notImplemented('postSignIn'));
}
