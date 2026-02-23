import { authRequired } from '../common/middleware.mjs';
import { getBalance, getState } from '../common/state.mjs';

export function registerPointsRoutes(app) {
  app.get('/api/points/summary', authRequired, (req, res) => {
    return res.json({ balance: getBalance(req.user.id) });
  });

  app.get('/api/points/transactions', authRequired, (req, res) => {
    const state = getState();
    const list = state.pointTransactions
      .filter((t) => t.userId === req.user.id)
      .sort((a, b) => b.id - a.id);

    return res.json({ list });
  });
}
