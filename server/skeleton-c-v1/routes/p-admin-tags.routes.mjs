export function registerPAdminTagRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    normalizeTagType,
    normalizeTagStatus,
    normalizeTagRuleStatus,
    ensureTagSeeds,
    buildTagJobCustomerMetrics,
    evaluateTagRuleByCustomer,
    resolveTagRuleOutputValue,
    collectCustomerIdsForTagJob,
  } = deps;

  app.get('/api/p/tags', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const query = String(req.query?.q || req.query?.query || '').trim().toLowerCase();
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;

    const listRaw = (state.pTags || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const filtered = listRaw
      .filter((row) => {
        const status = normalizeTagStatus(row.status);
        const matchQuery =
          !query ||
          String(row.tagName || '').toLowerCase().includes(query) ||
          String(row.tagCode || '').toLowerCase().includes(query) ||
          String(row.source || '').toLowerCase().includes(query);
        const matchStatus = !statusFilter || status === normalizeTagStatus(statusFilter);
        return matchQuery && matchStatus;
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

    const paged = filtered.slice(offset, offset + pageSize).map((row) => ({
      id: Number(row.id || 0),
      tenantId,
      tagCode: String(row.tagCode || ''),
      tagName: String(row.tagName || ''),
      tagType: normalizeTagType(row.tagType),
      source: String(row.source || 'manual'),
      description: String(row.description || ''),
      status: normalizeTagStatus(row.status),
      valueSchema: row.valueSchema && typeof row.valueSchema === 'object' ? row.valueSchema : {},
      hitCount: Number(row.hitCount || 0),
      createdBy: Number(row.createdBy || 0) || null,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    }));
    return res.json({ list: paged, total: filtered.length, page, pageSize });
  });

  app.post('/api/p/tags', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pTags)) state.pTags = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.body?.id || 0);
    const tagCode = String(req.body?.tagCode || '').trim();
    const tagName = String(req.body?.tagName || '').trim();
    const tagType = normalizeTagType(req.body?.tagType);
    const source = String(req.body?.source || 'manual').trim() || 'manual';
    const description = String(req.body?.description || '').trim();
    const status = normalizeTagStatus(req.body?.status);
    const valueSchema = req.body?.valueSchema && typeof req.body.valueSchema === 'object' ? req.body.valueSchema : {};
    if (!tagCode) return res.status(400).json({ code: 'TAG_CODE_REQUIRED', message: '标签编码不能为空' });
    if (!tagName) return res.status(400).json({ code: 'TAG_NAME_REQUIRED', message: '标签名称不能为空' });
    const duplicate = state.pTags.some(
      (row) => Number(row.tenantId || 1) === tenantId && Number(row.id || 0) !== id && String(row.tagCode || '') === tagCode
    );
    if (duplicate) return res.status(409).json({ code: 'TAG_CODE_CONFLICT', message: '标签编码已存在' });
    const now = new Date().toISOString();
    let row = state.pTags.find((item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === tenantId);
    if (row) {
      row.tagCode = tagCode;
      row.tagName = tagName;
      row.tagType = tagType;
      row.source = source;
      row.description = description;
      row.status = status;
      row.valueSchema = valueSchema;
      row.updatedAt = now;
    } else {
      row = {
        id: nextId(state.pTags),
        tenantId,
        tagCode,
        tagName,
        tagType,
        source,
        description,
        status,
        valueSchema,
        hitCount: 0,
        createdBy: Number(req.actor.actorId || 0) || null,
        createdAt: now,
        updatedAt: now,
      };
      state.pTags.push(row);
    }
    persistState();
    return res.json({ ok: true, item: row });
  });

  app.post('/api/p/tags/:id/status', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const row = (state.pTags || []).find((item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === tenantId);
    if (!row) return res.status(404).json({ code: 'TAG_NOT_FOUND', message: '标签不存在' });
    row.status = normalizeTagStatus(req.body?.status);
    row.updatedAt = new Date().toISOString();
    persistState();
    return res.json({ ok: true });
  });

  app.delete('/api/p/tags/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pTags)) state.pTags = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const index = state.pTags.findIndex((item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === tenantId);
    if (index < 0) return res.status(404).json({ code: 'TAG_NOT_FOUND', message: '标签不存在' });
    const inUse = (state.pTagRules || []).some((row) => {
      if (Number(row.tenantId || 1) !== tenantId) return false;
      const ids = Array.isArray(row.targetTagIds) ? row.targetTagIds.map((x) => Number(x || 0)) : [Number(row.targetTagId || 0)];
      return ids.includes(Number(id));
    });
    if (inUse) return res.status(409).json({ code: 'TAG_IN_USE', message: '标签已被规则使用，不能删除' });
    state.pTags.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });

  app.get('/api/p/tag-rules', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const query = String(req.query?.q || req.query?.query || '').trim().toLowerCase();
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const tagIdFilter = Number(req.query?.tagId || 0);
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const tagMap = new Map((state.pTags || []).filter((row) => Number(row.tenantId || 1) === tenantId).map((row) => [Number(row.id), row]));
    const listRaw = (state.pTagRules || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const filtered = listRaw
      .filter((row) => {
        const status = normalizeTagRuleStatus(row.status);
        const targetIds = Array.isArray(row.targetTagIds) && row.targetTagIds.length ? row.targetTagIds.map((x) => Number(x || 0)) : [Number(row.targetTagId || 0)];
        const tag = tagMap.get(Number(targetIds[0] || 0));
        const matchQuery =
          !query ||
          String(row.ruleName || '').toLowerCase().includes(query) ||
          String(row.ruleCode || '').toLowerCase().includes(query) ||
          String(tag?.tagName || '').toLowerCase().includes(query);
        const matchStatus = !statusFilter || status === normalizeTagRuleStatus(statusFilter);
        const matchTag = !tagIdFilter || targetIds.includes(tagIdFilter);
        return matchQuery && matchStatus && matchTag;
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const paged = filtered.slice(offset, offset + pageSize).map((row) => ({
      id: Number(row.id || 0),
      tenantId,
      ruleCode: String(row.ruleCode || ''),
      ruleName: String(row.ruleName || ''),
      targetTagId: Number((Array.isArray(row.targetTagIds) && row.targetTagIds[0]) || row.targetTagId || 0),
      targetTagIds: Array.isArray(row.targetTagIds) && row.targetTagIds.length ? row.targetTagIds.map((x) => Number(x || 0)) : [Number(row.targetTagId || 0)],
      targetTagName: String(tagMap.get(Number((Array.isArray(row.targetTagIds) && row.targetTagIds[0]) || row.targetTagId || 0))?.tagName || ''),
      targetTagNames: (Array.isArray(row.targetTagIds) && row.targetTagIds.length ? row.targetTagIds : [row.targetTagId])
        .map((x) => String(tagMap.get(Number(x || 0))?.tagName || ''))
        .filter(Boolean),
      priority: Number(row.priority || 100),
      status: normalizeTagRuleStatus(row.status),
      conditionDsl: row.conditionDsl && typeof row.conditionDsl === 'object' ? row.conditionDsl : {},
      outputExpr: row.outputExpr && typeof row.outputExpr === 'object' ? row.outputExpr : {},
      effectiveStartAt: row.effectiveStartAt || null,
      effectiveEndAt: row.effectiveEndAt || null,
      createdBy: Number(row.createdBy || 0) || null,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    }));
    return res.json({ list: paged, total: filtered.length, page, pageSize });
  });

  app.post('/api/p/tag-rules', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pTagRules)) state.pTagRules = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.body?.id || 0);
    const ruleCode = String(req.body?.ruleCode || '').trim();
    const ruleName = String(req.body?.ruleName || '').trim();
    const targetTagIdsRaw = Array.isArray(req.body?.targetTagIds)
      ? req.body.targetTagIds.map((x) => Number(x || 0)).filter((x) => x > 0)
      : [];
    const targetTagId = Number(req.body?.targetTagId || targetTagIdsRaw[0] || 0);
    const targetTagIds = targetTagIdsRaw.length ? [...new Set(targetTagIdsRaw)] : targetTagId > 0 ? [targetTagId] : [];
    const priority = Math.max(1, Number(req.body?.priority || 100));
    const status = normalizeTagRuleStatus(req.body?.status);
    const conditionDsl = req.body?.conditionDsl && typeof req.body.conditionDsl === 'object' ? req.body.conditionDsl : {};
    const outputExpr = req.body?.outputExpr && typeof req.body.outputExpr === 'object' ? req.body.outputExpr : {};
    const effectiveStartAt = req.body?.effectiveStartAt || null;
    const effectiveEndAt = req.body?.effectiveEndAt || null;
    if (!ruleCode) return res.status(400).json({ code: 'RULE_CODE_REQUIRED', message: '规则编码不能为空' });
    if (!ruleName) return res.status(400).json({ code: 'RULE_NAME_REQUIRED', message: '规则名称不能为空' });
    if (!targetTagIds.length) return res.status(400).json({ code: 'TARGET_TAG_REQUIRED', message: '请选择目标标签' });
    const allTargetTagsExist = targetTagIds.every((tid) =>
      (state.pTags || []).some((row) => Number(row.tenantId || 1) === tenantId && Number(row.id || 0) === Number(tid))
    );
    if (!allTargetTagsExist) return res.status(404).json({ code: 'TARGET_TAG_NOT_FOUND', message: '目标标签不存在' });
    const duplicate = state.pTagRules.some(
      (row) => Number(row.tenantId || 1) === tenantId && Number(row.id || 0) !== id && String(row.ruleCode || '') === ruleCode
    );
    if (duplicate) return res.status(409).json({ code: 'RULE_CODE_CONFLICT', message: '规则编码已存在' });
    const now = new Date().toISOString();
    let row = state.pTagRules.find((item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === tenantId);
    if (row) {
      row.ruleCode = ruleCode;
      row.ruleName = ruleName;
      row.targetTagId = targetTagIds[0];
      row.targetTagIds = targetTagIds;
      row.priority = priority;
      row.status = status;
      row.conditionDsl = conditionDsl;
      row.outputExpr = outputExpr;
      row.effectiveStartAt = effectiveStartAt;
      row.effectiveEndAt = effectiveEndAt;
      row.updatedAt = now;
    } else {
      row = {
        id: nextId(state.pTagRules),
        tenantId,
        ruleCode,
        ruleName,
        targetTagId: targetTagIds[0],
        targetTagIds,
        priority,
        status,
        conditionDsl,
        outputExpr,
        effectiveStartAt,
        effectiveEndAt,
        createdBy: Number(req.actor.actorId || 0) || null,
        createdAt: now,
        updatedAt: now,
      };
      state.pTagRules.push(row);
    }
    persistState();
    return res.json({ ok: true, item: row });
  });

  app.post('/api/p/tag-rules/:id/status', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const row = (state.pTagRules || []).find((item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === tenantId);
    if (!row) return res.status(404).json({ code: 'RULE_NOT_FOUND', message: '规则不存在' });
    row.status = normalizeTagRuleStatus(req.body?.status);
    row.updatedAt = new Date().toISOString();
    persistState();
    return res.json({ ok: true });
  });

  app.delete('/api/p/tag-rules/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pTagRules)) state.pTagRules = [];
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const index = state.pTagRules.findIndex((item) => Number(item.id || 0) === id && Number(item.tenantId || 1) === tenantId);
    if (index < 0) return res.status(404).json({ code: 'RULE_NOT_FOUND', message: '规则不存在' });
    state.pTagRules.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });

  app.post('/api/p/tag-rule-jobs', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const seeded = ensureTagSeeds(state, tenantId);
    if (seeded) persistState();
    if (!Array.isArray(state.pTagRuleJobs)) state.pTagRuleJobs = [];
    if (!Array.isArray(state.pTagRuleJobLogs)) state.pTagRuleJobLogs = [];
    const now = new Date().toISOString();
    const jobType = String(req.body?.jobType || 'delta').trim().toLowerCase();
    const triggerType = String(req.body?.triggerType || 'manual').trim().toLowerCase();
    const scope = req.body?.scope && typeof req.body.scope === 'object' ? req.body.scope : {};
    const tenantRules = (state.pTagRules || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const targetRuleIdsRaw = Array.isArray(req.body?.targetRuleIds) ? req.body.targetRuleIds.map((x) => Number(x || 0)).filter((x) => x > 0) : [];
    const targetRuleIds = targetRuleIdsRaw.length ? targetRuleIdsRaw : tenantRules.filter((x) => String(x.status || '') === 'active').map((x) => Number(x.id));
    if (!targetRuleIds.length) {
      return res.status(400).json({ code: 'TARGET_RULE_REQUIRED', message: '请至少选择一条规则' });
    }

    const customerIds = collectCustomerIdsForTagJob(state, tenantId);
    const job = {
      id: nextId(state.pTagRuleJobs),
      tenantId,
      jobType: ['full', 'delta', 'replay'].includes(jobType) ? jobType : 'delta',
      triggerType: ['manual', 'schedule', 'publish'].includes(triggerType) ? triggerType : 'manual',
      status: 'running',
      targetRuleIds,
      scope,
      startedAt: now,
      endedAt: null,
      totalCustomers: customerIds.length,
      successCustomers: 0,
      failedCustomers: 0,
      errorSummary: '',
      createdAt: now,
    };
    state.pTagRuleJobs.push(job);

    const selectedRules = tenantRules.filter((row) => targetRuleIds.includes(Number(row.id)));
    const customerMetricMap = buildTagJobCustomerMetrics(state, tenantId, customerIds);
    const logs = [];
    let nextLogId = nextId(state.pTagRuleJobLogs);
    let successCustomers = 0;
    customerIds.forEach((customerId) => {
      selectedRules.forEach((rule) => {
        const customerMetrics = customerMetricMap.get(Number(customerId)) || {};
        const evalResult = evaluateTagRuleByCustomer(rule, customerMetrics);
        const hit = Boolean(evalResult.hit);
        logs.push({
          id: nextLogId++,
          jobId: Number(job.id),
          tenantId,
          customerId: Number(customerId),
          ruleId: Number(rule.id),
          result: hit ? 'hit' : 'miss',
          outputValue: hit ? resolveTagRuleOutputValue(rule, customerMetrics) : null,
          reason: String(evalResult.reason || (hit ? 'condition matched' : 'condition not matched')),
          createdAt: now,
        });
      });
      successCustomers += 1;
    });
    state.pTagRuleJobLogs.push(...logs);
    job.successCustomers = successCustomers;
    job.failedCustomers = Math.max(0, customerIds.length - successCustomers);
    job.status = job.failedCustomers > 0 ? 'partial_success' : 'success';
    job.endedAt = new Date().toISOString();

    persistState();
    return res.json({ ok: true, item: job });
  });

  app.get('/api/p/tag-rule-jobs', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const all = (state.pTagRuleJobs || [])
      .filter((row) => Number(row.tenantId || 1) === tenantId)
      .filter((row) => !statusFilter || String(row.status || '').toLowerCase() === statusFilter)
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const list = all.slice(offset, offset + pageSize);
    return res.json({ list, total: all.length, page, pageSize });
  });

  app.get('/api/p/tag-rule-jobs/:id', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const item = (state.pTagRuleJobs || []).find((row) => Number(row.id || 0) === id && Number(row.tenantId || 1) === tenantId);
    if (!item) return res.status(404).json({ code: 'JOB_NOT_FOUND', message: '任务不存在' });
    return res.json({ item });
  });

  app.get('/api/p/tag-rule-jobs/:id/logs', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const resultFilter = String(req.query?.result || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(500, Math.max(1, Number(req.query?.pageSize || 50)));
    const offset = (page - 1) * pageSize;
    const all = (state.pTagRuleJobLogs || [])
      .filter((row) => Number(row.jobId || 0) === id && Number(row.tenantId || 1) === tenantId)
      .filter((row) => !resultFilter || String(row.result || '').toLowerCase() === resultFilter)
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const list = all.slice(offset, offset + pageSize);
    return res.json({ list, total: all.length, page, pageSize });
  });
}
