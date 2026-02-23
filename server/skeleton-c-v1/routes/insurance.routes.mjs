import { notImplemented } from '../common/not-implemented.mjs';
import { authRequired } from '../common/middleware.mjs';

export function registerInsuranceRoutes(app) {
  app.get('/api/insurance/overview', notImplemented('getInsuranceOverview'));
  app.get('/api/insurance/policies', notImplemented('getInsurancePolicies'));
  app.get('/api/insurance/policies/:id', notImplemented('getInsurancePolicyDetail'));
  app.post('/api/insurance/policies/scan', notImplemented('postInsurancePolicyScan'));
  app.post('/api/insurance/policies', authRequired, notImplemented('postInsurancePolicyCreate'));
}
