import { authRequired } from '../common/middleware.mjs';
import { appendPoints, getBalance, getState, nextId, persistState } from '../common/state.mjs';

export function registerLearningRoutes(app) {
  app.get('/api/learning/courses', (_req, res) => {
    const state = getState();
    const categories = new Set(['全部', ...state.learningCourses.map((c) => c.category)]);
    return res.json({
      categories: [...categories],
      courses: [...state.learningCourses].sort((a, b) => a.id - b.id),
    });
  });

  app.get('/api/learning/courses/:id', (req, res) => {
    const state = getState();
    const id = Number(req.params.id);
    const course = state.learningCourses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '课程不存在' });
    }
    return res.json({ course });
  });

  app.post('/api/learning/courses/:id/complete', authRequired, (req, res) => {
    const state = getState();
    const id = Number(req.params.id);
    const course = state.learningCourses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '课程不存在' });
    }

    const exists = state.courseCompletions.find((x) => x.userId === req.user.id && x.courseId === id);
    if (exists) {
      return res.json({
        ok: true,
        duplicated: true,
        reward: 0,
        balance: getBalance(req.user.id),
        message: '该课程已领取过积分',
      });
    }

    state.courseCompletions.push({
      id: nextId(state.courseCompletions),
      userId: req.user.id,
      courseId: id,
      pointsAwarded: course.points,
      createdAt: new Date().toISOString(),
    });
    appendPoints(req.user.id, 'earn', course.points, 'course_complete', String(id), `完成课程 ${course.title}`);
    persistState();

    return res.json({
      ok: true,
      duplicated: false,
      reward: course.points,
      balance: getBalance(req.user.id),
    });
  });

  app.get('/api/learning/games', (_req, res) => {
    const state = getState();
    return res.json({ games: [...state.learningGames].sort((a, b) => a.id - b.id) });
  });

  app.get('/api/learning/tools', (_req, res) => {
    const state = getState();
    return res.json({ tools: [...state.learningTools].sort((a, b) => a.id - b.id) });
  });
}
