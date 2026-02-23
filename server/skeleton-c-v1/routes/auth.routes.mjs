import { notImplemented } from '../common/not-implemented.mjs';

export function registerAuthRoutes(app) {
  app.post('/api/auth/send-code', notImplemented('postAuthSendCode'));
  app.post('/api/auth/verify-basic', notImplemented('postAuthVerifyBasic'));
}
