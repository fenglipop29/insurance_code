export function registerPAdminActivityRoutes(app, deps) {
  const { tenantContext, permissionRequired, getState, nextId, persistState, hasRole, canOperateTenantTemplates, canAccessTemplate, decoratePlatformTemplateRow } = deps;

  app.get('/api/p/activities', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const list = (state.activities || [])
      .filter((row) => canAccessTemplate(state, req.actor, row))
      .map((row) => {
        const creatorRole = String(row.creatorRole || '');
        if (isCompanyAdmin && creatorRole === 'platform_admin') {
          return {
            ...row,
            status: 'offline',
            isPlatformTemplate: true,
            templateTag: '平台模板',
          };
        }
        return decoratePlatformTemplateRow(row);
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    res.json({ activities: list });
  });

  app.post('/api/p/activities', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = canOperateTenantTemplates(state, req.actor);
    if (!isPlatformAdmin && !isCompanyActor) {
      return res.status(403).json({ code: 'COMPANY_ACCOUNT_REQUIRED', message: '仅平台管理员、公司管理员或业务员可发布活动(v2)' });
    }
    if (!Array.isArray(state.activities)) state.activities = [];
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ code: 'ACTIVITY_TITLE_REQUIRED', message: '活动标题不能为空' });
    const row = {
      id: nextId(state.activities),
      tenantId: req.tenantContext.tenantId,
      title,
      category: String(req.body?.category || 'task'),
      rewardPoints: Number(req.body?.rewardPoints || 0),
      sortOrder: Number(req.body?.sortOrder || state.activities.length + 1),
      participants: 0,
      content: String(req.body?.content || ''),
      media: Array.isArray(req.body?.media) ? req.body.media.slice(0, 6) : [],
      status: String(req.body?.status || 'online'),
      createdBy: Number(req.actor.actorId || 0),
      creatorRole: isPlatformAdmin ? 'platform_admin' : isCompanyAdmin ? 'company_admin' : 'agent',
      templateScope: isPlatformAdmin ? 'platform' : 'tenant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.activities.push(row);
    persistState();
    res.json({ ok: true, activity: row });
  });

  app.put('/api/p/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const id = Number(req.params.id || 0);
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const source = (state.activities || []).find((item) => Number(item.id) === id);
    if (!source) return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' });
    if (!canAccessTemplate(state, req.actor, source)) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限编辑该活动模板' });
    }
    const row = source;
    if (isCompanyAdmin && String(source.creatorRole || '') === 'platform_admin') {
      row.sourceTemplateId = Number(source.sourceTemplateId || source.id || 0);
      row.platformTemplate = true;
      row.templateTag = '平台模板';
      row.creatorRole = 'company_admin';
      row.templateScope = 'tenant';
      row.tenantId = tenantId;
      row.createdBy = Number(req.actor.actorId || source.createdBy || 0);
    }
    const title = String(req.body?.title ?? row.title ?? '').trim();
    if (!title) return res.status(400).json({ code: 'ACTIVITY_TITLE_REQUIRED', message: '活动标题不能为空' });
    row.title = title;
    row.category = String(req.body?.category ?? row.category ?? 'task');
    row.rewardPoints = Number(req.body?.rewardPoints ?? row.rewardPoints ?? 0);
    row.sortOrder = Number(req.body?.sortOrder ?? row.sortOrder ?? 1);
    row.content = String(req.body?.content ?? row.content ?? '');
    row.status = String(req.body?.status ?? row.status ?? 'online');
    if (Array.isArray(req.body?.media)) row.media = req.body.media.slice(0, 6);
    row.updatedAt = new Date().toISOString();
    persistState();
    return res.json({ ok: true, activity: row });
  });

  app.delete('/api/p/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.activities)) state.activities = [];
    const id = Number(req.params.id || 0);
    let index = state.activities.findIndex((item) => Number(item.id) === id);
    if (index < 0) return res.status(404).json({ code: 'ACTIVITY_NOT_FOUND', message: '活动不存在' });
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const target = state.activities[index];
    if (isCompanyAdmin && String(target.creatorRole || '') === 'platform_admin') {
      const tenantId = Number(req.tenantContext.tenantId || 0);
      index = state.activities.findIndex(
        (item) =>
          Number(item.tenantId || 1) === tenantId &&
          Number(item.sourceTemplateId || 0) === Number(target.id || 0) &&
          String(item.creatorRole || '') === 'company_admin'
      );
      if (index < 0) return res.status(403).json({ code: 'NO_PERMISSION', message: '平台模板源数据不可直接删除' });
    }
    if (!canAccessTemplate(state, req.actor, state.activities[index])) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限删除该活动模板' });
    }
    state.activities.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });
}
