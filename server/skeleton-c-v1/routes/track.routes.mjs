import { tenantContext } from '../common/access-control.mjs';
import { authOptional } from '../common/middleware.mjs';
import { appendTrackEvent, persistState } from '../common/state.mjs';

export function registerTrackRoutes(app) {
  app.post('/api/track/events', authOptional, tenantContext, (req, res) => {
    const event = String(req.body?.event || '').trim();
    if (!event) {
      return res.status(400).json({ code: 'EVENT_REQUIRED', message: 'event 不能为空' });
    }

    const properties = req.body?.properties && typeof req.body.properties === 'object' ? req.body.properties : {};

    appendTrackEvent({
      event,
      properties,
      actorType: req.actor?.actorType || 'anonymous',
      actorId: Number(req.actor?.actorId || 0),
      tenantId: Number(req.tenantContext?.tenantId || 1),
      orgId: Number(req.tenantContext?.orgId || 1),
      teamId: Number(req.tenantContext?.teamId || 1),
      path: String(req.headers['x-client-path'] || ''),
      source: String(req.headers['x-client-source'] || 'web'),
      userAgent: String(req.headers['user-agent'] || ''),
    });
    persistState();
    return res.json({ ok: true });
  });
}
