import express from 'express';
import { corsMiddleware } from './common/middleware.mjs';
import { registerHealthRoutes } from './routes/health.routes.mjs';
import { registerAuthRoutes } from './routes/auth.routes.mjs';
import { registerUserRoutes } from './routes/user.routes.mjs';
import { registerActivitiesRoutes } from './routes/activities.routes.mjs';
import { registerPointsRoutes } from './routes/points.routes.mjs';
import { registerMallRoutes } from './routes/mall.routes.mjs';
import { registerRedemptionsRoutes } from './routes/redemptions.routes.mjs';
import { registerLearningRoutes } from './routes/learning.routes.mjs';
import { registerInsuranceRoutes } from './routes/insurance.routes.mjs';
import { registerOrdersRoutes } from './routes/orders.routes.mjs';
import { registerBAdminRoutes } from './routes/b-admin.routes.mjs';
import { registerPAdminRoutes } from './routes/p-admin.routes.mjs';
import { registerTrackRoutes } from './routes/track.routes.mjs';

export function createSkeletonApp() {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerActivitiesRoutes(app);
  registerPointsRoutes(app);
  registerMallRoutes(app);
  registerRedemptionsRoutes(app);
  registerOrdersRoutes(app);
  registerLearningRoutes(app);
  registerInsuranceRoutes(app);
  registerBAdminRoutes(app);
  registerPAdminRoutes(app);
  registerTrackRoutes(app);

  return app;
}
