export function registerPAdminMetricRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    appendAuditLog,
    computeMetricCards,
    normalizeMetricEnd,
    normalizeMetricRuleStatus,
    normalizeMetricRemarkMode,
    buildMetricRuleRemark,
    metricRuleKey,
    parseNumber,
    rowDate,
  } = deps;

  app.get('/api/p/metrics/config', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);

    const rules = (state.metricRules || [])
      .filter((row) => Number(row.tenantId || 1) === tenantId)
      .sort((a, b) => {
        const endCmp = String(a.end || '').localeCompare(String(b.end || ''));
        if (endCmp !== 0) return endCmp;
        return Number(a.id || 0) - Number(b.id || 0);
      })
      .map((row) => ({
        id: Number(row.id),
        tenantId: Number(row.tenantId || 1),
        end: normalizeMetricEnd(row.end),
        name: String(row.name || ''),
        formula: String(row.formula || ''),
        period: String(row.period || '每日'),
        source: String(row.source || ''),
        status: normalizeMetricRuleStatus(row.status),
        threshold: String(row.threshold || ''),
        remark: String(row.remark || ''),
        remarkMode: normalizeMetricRemarkMode(row.remarkMode || row.remark_mode || 'sync'),
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      }));

    res.json({
      cardsByEnd: computeMetricCards(state, req.actor),
      rules,
    });
  });

  app.get('/api/p/metrics/share-daily', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);

    const now = new Date();
    const defaultDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const day = String(req.query?.day || defaultDay).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({ code: 'DAY_INVALID', message: 'day 必须为 YYYY-MM-DD' });
    }
    const [yy, mm, dd] = day.split('-').map((x) => Number(x));
    const dayStart = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
    if (Number.isNaN(dayStart.getTime())) {
      return res.status(400).json({ code: 'DAY_INVALID', message: 'day 必须为有效日期' });
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const actorIdRaw = parseNumber(req.query?.actorId, 0);
    const cActorId = parseNumber(req.query?.cActorId, actorIdRaw);
    const bActorId = parseNumber(req.query?.bActorId, actorIdRaw);
    if (cActorId <= 0 && bActorId <= 0) {
      return res.status(400).json({ code: 'ACTOR_ID_REQUIRED', message: '请传 actorId 或 cActorId/bActorId' });
    }

    const dailyCounters = (Array.isArray(state.metricDailyCounters) ? state.metricDailyCounters : []).filter(
      (row) => Number(row?.tenantId || 1) === tenantId && String(row?.statDate || '') === day
    );
    const counterSum = (metricKey, actorId) =>
      dailyCounters
        .filter((row) => String(row?.metricKey || '') === metricKey && parseNumber(row?.actorId, 0) === actorId)
        .reduce((sum, row) => sum + parseNumber(row?.cnt, 0), 0);

    const trackRows = (Array.isArray(state.trackEvents) ? state.trackEvents : []).filter(
      (row) => Number(row?.tenantId || 1) === tenantId
    );
    const fallbackCount = (eventName, actorId) =>
      trackRows.filter((row) => {
        if (parseNumber(row?.actorId, 0) !== actorId) return false;
        if (String(row?.event || '').toLowerCase() !== String(eventName || '').toLowerCase()) return false;
        const dt = rowDate(row, ['createdAt']);
        return Boolean(dt && dt >= dayStart && dt < dayEnd);
      }).length;

    const cShareCounter = cActorId > 0 ? counterSum('c_share_success_cnt', cActorId) : 0;
    const bShareCounter = bActorId > 0 ? counterSum('b_share_success_cnt', bActorId) : 0;
    const cShareCount = cActorId > 0 ? (cShareCounter > 0 ? cShareCounter : fallbackCount('c_share_success', cActorId)) : 0;
    const bShareCount =
      bActorId > 0 ? (bShareCounter > 0 ? bShareCounter : fallbackCount('b_tools_share_success', bActorId)) : 0;

    return res.json({
      day,
      cActorId: cActorId > 0 ? cActorId : null,
      bActorId: bActorId > 0 ? bActorId : null,
      cShareCount,
      bShareCount,
      metricKeys: {
        c: 'c_share_success_cnt',
        b: 'b_share_success_cnt',
      },
      eventNames: {
        c: 'c_share_success',
        b: 'b_tools_share_success',
      },
    });
  });

  app.post('/api/p/metrics/rules', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.metricRules)) state.metricRules = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const name = String(req.body?.name || '').trim();
    const formula = String(req.body?.formula || '').trim();
    const period = String(req.body?.period || '').trim();
    const source = String(req.body?.source || '').trim();
    const end = normalizeMetricEnd(req.body?.end);
    if (!name) return res.status(400).json({ code: 'METRIC_NAME_REQUIRED', message: '指标名称不能为空' });
    if (!formula) return res.status(400).json({ code: 'METRIC_FORMULA_REQUIRED', message: '口径/公式不能为空' });
    if (!period) return res.status(400).json({ code: 'METRIC_PERIOD_REQUIRED', message: '统计周期不能为空' });
    if (!source) return res.status(400).json({ code: 'METRIC_SOURCE_REQUIRED', message: '数据源不能为空' });
    const duplicate = state.metricRules.some(
      (item) => Number(item.tenantId || 1) === tenantId && metricRuleKey(item.end, item.name) === metricRuleKey(end, name)
    );
    if (duplicate) return res.status(409).json({ code: 'METRIC_RULE_DUPLICATE', message: '同端同名指标规则已存在' });

    const remarkMode = normalizeMetricRemarkMode(req.body?.remarkMode ?? req.body?.remark_mode);
    const manualRemark = String(req.body?.remark || '').trim();
    const remark = remarkMode === 'manual' && manualRemark ? manualRemark : buildMetricRuleRemark({ name, formula, period, source });

    const row = {
      id: nextId(state.metricRules),
      tenantId,
      end,
      name,
      formula,
      period,
      source,
      status: normalizeMetricRuleStatus(req.body?.status),
      threshold: String(req.body?.threshold || ''),
      remark,
      remarkMode,
      createdBy: Number(req.actor.actorId || 0) || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.metricRules.push(row);
    appendAuditLog({
      tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'metric_rule.create',
      resourceType: 'metric_rule',
      resourceId: String(row.id),
      result: 'success',
      meta: { end: row.end, name: row.name },
    });
    persistState();
    res.json({ ok: true, rule: row });
  });

  app.put('/api/p/metrics/rules/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.metricRules)) state.metricRules = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const row = state.metricRules.find((item) => Number(item.id) === id && Number(item.tenantId || 1) === tenantId);
    if (!row) return res.status(404).json({ code: 'METRIC_RULE_NOT_FOUND', message: '指标规则不存在' });

    const name = String(req.body?.name || row.name || '').trim();
    const formula = String(req.body?.formula || row.formula || '').trim();
    const period = String(req.body?.period || row.period || '').trim();
    const source = String(req.body?.source || row.source || '').trim();
    const nextEnd = normalizeMetricEnd(req.body?.end || row.end);
    if (!name) return res.status(400).json({ code: 'METRIC_NAME_REQUIRED', message: '指标名称不能为空' });
    if (!formula) return res.status(400).json({ code: 'METRIC_FORMULA_REQUIRED', message: '口径/公式不能为空' });
    if (!period) return res.status(400).json({ code: 'METRIC_PERIOD_REQUIRED', message: '统计周期不能为空' });
    if (!source) return res.status(400).json({ code: 'METRIC_SOURCE_REQUIRED', message: '数据源不能为空' });
    const duplicate = state.metricRules.some(
      (item) =>
        Number(item.id) !== id &&
        Number(item.tenantId || 1) === tenantId &&
        metricRuleKey(item.end, item.name) === metricRuleKey(nextEnd, name)
    );
    if (duplicate) return res.status(409).json({ code: 'METRIC_RULE_DUPLICATE', message: '同端同名指标规则已存在' });

    row.name = name;
    row.formula = formula;
    row.period = period;
    row.source = source;
    row.end = nextEnd;
    row.status = normalizeMetricRuleStatus(req.body?.status || row.status);
    row.threshold = String(req.body?.threshold ?? row.threshold ?? '');
    const remarkMode = normalizeMetricRemarkMode(req.body?.remarkMode ?? req.body?.remark_mode);
    const manualRemark = String(req.body?.remark ?? row.remark ?? '').trim();
    row.remark = remarkMode === 'manual' && manualRemark ? manualRemark : buildMetricRuleRemark({ name, formula, period, source });
    row.remarkMode = remarkMode;
    row.updatedAt = new Date().toISOString();

    appendAuditLog({
      tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'metric_rule.update',
      resourceType: 'metric_rule',
      resourceId: String(row.id),
      result: 'success',
      meta: { end: row.end, name: row.name },
    });
    persistState();
    res.json({ ok: true, rule: row });
  });

  app.delete('/api/p/metrics/rules/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.metricRules)) state.metricRules = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const index = state.metricRules.findIndex((item) => Number(item.id) === id && Number(item.tenantId || 1) === tenantId);
    if (index < 0) return res.status(404).json({ code: 'METRIC_RULE_NOT_FOUND', message: '指标规则不存在' });
    state.metricRules.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });
}
