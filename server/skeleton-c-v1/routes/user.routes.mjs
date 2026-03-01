import { authOptional, authRequired } from '../common/middleware.mjs';
import { formatUser, getBalance, persistState } from '../common/state.mjs';

export function registerUserRoutes(app) {
  app.get('/api/bootstrap', authOptional, (req, res) => {
    const user = req.user || null;
    return res.json({
      user: user ? formatUser(user) : null,
      balance: user ? getBalance(user.id) : 0,
      csrfToken: req.session?.csrfToken || null,
      tabs: ['home', 'learning', 'activities', 'insurance', 'profile'],
    });
  });

  app.get('/api/me', authRequired, (req, res) => {
    req.user.lastActiveAt = new Date().toISOString();
    req.user.deviceInfo = req.user.deviceInfo || String(req.headers['user-agent'] || '');
    persistState();
    return res.json({
      user: formatUser(req.user),
      balance: getBalance(req.user.id),
      csrfToken: req.session?.csrfToken || null,
    });
  });
}
