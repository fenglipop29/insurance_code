import { notImplemented } from '../common/not-implemented.mjs';
import { authRequired } from '../common/middleware.mjs';

export function registerLearningRoutes(app) {
  app.get('/api/learning/courses', notImplemented('getLearningCourses'));
  app.get('/api/learning/courses/:id', notImplemented('getLearningCourseDetail'));
  app.post('/api/learning/courses/:id/complete', authRequired, notImplemented('postLearningCourseComplete'));
  app.get('/api/learning/games', notImplemented('getLearningGames'));
  app.get('/api/learning/tools', notImplemented('getLearningTools'));
}
