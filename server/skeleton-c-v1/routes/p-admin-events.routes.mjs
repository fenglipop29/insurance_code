export function registerPAdminEventRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    appendAuditLog,
    normalizeEventStatus,
    normalizeEventType,
    normalizeCollectMethod,
    eventSchemaTemplateById,
    toEventStatusCode,
  } = deps;

  app.get('/api/p/events/definitions', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const query = String(req.query?.q || req.query?.query || '').trim().toLowerCase();
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const typeFilter = String(req.query?.type || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const listRaw = (state.eventDefinitions || []).filter((row) => Number(row.tenantId || 1) === Number(req.tenantContext.tenantId));
    const filtered = listRaw
      .filter((row) => {
        const status = normalizeEventStatus(row.status);
        const type = normalizeEventType(row.eventType);
        const matchQuery = !query || String(row.eventName || '').toLowerCase().includes(query) || String(row.eventId || '').includes(query);
        const matchStatus = !statusFilter || status === normalizeEventStatus(statusFilter);
        const matchType = !typeFilter || type === normalizeEventType(typeFilter);
        return matchQuery && matchStatus && matchType;
      })
      .sort((a, b) => Number(a.eventId || 0) - Number(b.eventId || 0));
    const paged = filtered.slice(offset, offset + pageSize).map((row) => ({
      id: Number(row.id),
      eventId: Number(row.eventId || 0),
      eventName: String(row.eventName || ''),
      eventType: normalizeEventType(row.eventType),
      description: String(row.description || ''),
      collectMethod: normalizeCollectMethod(row.collectMethod),
      status: normalizeEventStatus(row.status),
      statusCode: toEventStatusCode(row.status),
      schema: row.schema || {},
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString(),
    }));
    res.json({
      list: paged,
      total: filtered.length,
      page,
      pageSize,
    });
  });

  app.post('/api/p/events/definitions', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.eventDefinitions)) state.eventDefinitions = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const eventId = Number(req.body?.eventId || 0);
    const eventName = String(req.body?.eventName || '').trim();
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return res.status(400).json({ code: 'EVENT_ID_REQUIRED', message: '事件ID不能为空且必须为数字' });
    }
    if (!eventName) {
      return res.status(400).json({ code: 'EVENT_NAME_REQUIRED', message: '事件名称不能为空' });
    }
    const type = normalizeEventType(req.body?.eventType);
    const method = normalizeCollectMethod(req.body?.collectMethod);
    const status = normalizeEventStatus(req.body?.status);
    const syncSchemaWithEvent = Boolean(req.body?.syncSchemaWithEvent);
    let schema = req.body?.schema && typeof req.body.schema === 'object' ? req.body.schema : {};
    const templateSchema = eventSchemaTemplateById(eventId);
    if ((syncSchemaWithEvent || !Object.keys(schema || {}).length) && templateSchema) {
      schema = templateSchema;
    }
    const now = new Date().toISOString();
    let row = state.eventDefinitions.find(
      (item) =>
        Number(item.tenantId || 1) === tenantId &&
        (Number(item.eventId || 0) === eventId || Number(item.id || 0) === Number(req.body?.id || 0))
    );
    if (row) {
      if (row.eventType === 'system') {
        const oldEventId = Number(row.eventId || 0);
        row.eventName = eventName;
        row.description = String(req.body?.description || row.description || '');
        row.collectMethod = method;
        row.status = status;
        row.eventId = eventId;
        if (Number(oldEventId) !== Number(eventId) && templateSchema) {
          row.schema = templateSchema;
        } else {
          row.schema = schema;
        }
        row.schema = syncSchemaWithEvent && templateSchema ? templateSchema : row.schema;
        row.updatedAt = now;
      } else {
        const oldEventId = Number(row.eventId || 0);
        row.eventId = eventId;
        row.eventName = eventName;
        row.eventType = type;
        row.description = String(req.body?.description || '');
        row.collectMethod = method;
        row.status = status;
        row.schema = Number(oldEventId) !== Number(eventId) && templateSchema ? templateSchema : schema;
        if (syncSchemaWithEvent && templateSchema) row.schema = templateSchema;
        row.updatedAt = now;
      }
    } else {
      if (state.eventDefinitions.some((item) => Number(item.tenantId || 1) === tenantId && Number(item.eventId || 0) === eventId)) {
        return res.status(409).json({ code: 'EVENT_ID_CONFLICT', message: '事件ID已存在' });
      }
      row = {
        id: nextId(state.eventDefinitions),
        tenantId,
        eventId,
        eventName,
        eventType: type,
        description: String(req.body?.description || ''),
        collectMethod: method,
        status,
        schema,
        createdBy: Number(req.actor.actorId || 0) || null,
        createdAt: now,
        updatedAt: now,
      };
      state.eventDefinitions.push(row);
    }
    appendAuditLog({
      tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'event_definition.save',
      resourceType: 'event_definition',
      resourceId: String(row.id),
      result: 'success',
      meta: { eventId: row.eventId, eventName: row.eventName, status: row.status },
    });
    persistState();
    return res.json({
      ok: true,
      item: {
        id: Number(row.id),
        eventId: Number(row.eventId),
        eventName: String(row.eventName),
        eventType: normalizeEventType(row.eventType),
        description: String(row.description || ''),
        collectMethod: normalizeCollectMethod(row.collectMethod),
        status: normalizeEventStatus(row.status),
        statusCode: toEventStatusCode(row.status),
        schema: row.schema || {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  });

  app.post('/api/p/events/definitions/:id/status', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.eventDefinitions)) state.eventDefinitions = [];
    const id = Number(req.params.id || 0);
    const row = state.eventDefinitions.find(
      (item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === Number(req.tenantContext.tenantId || 0)
    );
    if (!row) return res.status(404).json({ code: 'EVENT_NOT_FOUND', message: '事件定义不存在' });
    row.status = normalizeEventStatus(req.body?.status);
    row.updatedAt = new Date().toISOString();
    persistState();
    return res.json({ ok: true });
  });

  app.delete('/api/p/events/definitions/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.eventDefinitions)) state.eventDefinitions = [];
    const id = Number(req.params.id || 0);
    const index = state.eventDefinitions.findIndex(
      (item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === Number(req.tenantContext.tenantId || 0)
    );
    if (index < 0) return res.status(404).json({ code: 'EVENT_NOT_FOUND', message: '事件定义不存在' });
    if (normalizeEventType(state.eventDefinitions[index].eventType) === 'system') {
      return res.status(400).json({ code: 'SYSTEM_EVENT_CANNOT_DELETE', message: '系统预置事件不允许删除' });
    }
    state.eventDefinitions.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });
}
