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

    const tenantId = Number(req.tenantContext?.tenantId || 0);
    const orgId = Number(req.tenantContext?.orgId || 0);
    const teamId = Number(req.tenantContext?.teamId || 0);
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }

    appendTrackEvent({
      event,
      properties,
      actorType: req.actor?.actorType || 'anonymous',
      actorId: Number(req.actor?.actorId || 0),
      tenantId,
      orgId: Number.isFinite(orgId) && orgId > 0 ? orgId : null,
      teamId: Number.isFinite(teamId) && teamId > 0 ? teamId : null,
      path: String(req.headers['x-client-path'] || ''),
      source: String(req.headers['x-client-source'] || 'web'),
      userAgent: String(req.headers['user-agent'] || ''),
    });
    persistState();
    return res.json({ ok: true });
  });
}
