import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminApiAuthRequired, corsMiddleware, csrfProtection } from './common/middleware.mjs';
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
import { registerUploadsRoutes } from './routes/uploads.routes.mjs';

export function createSkeletonApp() {
  const app = express();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadsDir = path.resolve(__dirname, '../data/uploads');

  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);
  app.use(adminApiAuthRequired);
  app.use(csrfProtection);
  app.use('/uploads', express.static(uploadsDir));

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
  registerUploadsRoutes(app);

  return app;
}
