export function registerPAdminLearningRoutes(app, deps) {
  const { tenantContext, permissionRequired, getState, nextId, persistState, hasRole, canOperateTenantTemplates, canAccessTemplate } = deps;

  app.post('/api/p/learning/courses', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = canOperateTenantTemplates(state, req.actor);
    if (!isPlatformAdmin && !isCompanyActor) {
      return res.status(403).json({ code: 'COMPANY_ACCOUNT_REQUIRED', message: '仅平台管理员、公司管理员或业务员可新增学习资料(v2)' });
    }
    if (!Array.isArray(state.learningCourses)) state.learningCourses = [];
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ code: 'COURSE_TITLE_REQUIRED', message: '资料标题不能为空' });
    const media = Array.isArray(req.body?.media) ? req.body.media.slice(0, 6) : [];
    const mediaToUrl = (raw) => {
      if (!raw) return '';
      if (typeof raw === 'string') return raw;
      return String(raw.preview || raw.url || raw.path || raw.name || '');
    };
    const coverUrl = String(req.body?.coverUrl || mediaToUrl(media[0]) || '').trim();
    const rewardPoints = Number(req.body?.rewardPoints ?? req.body?.points ?? 0);
    const row = {
      id: nextId(state.learningCourses),
      tenantId: req.tenantContext.tenantId,
      title,
      category: String(req.body?.category || '通用培训'),
      points: rewardPoints,
      rewardPoints,
      contentType: String(req.body?.contentType || 'article'),
      status: String(req.body?.status || 'published'),
      level: String(req.body?.level || '中级'),
      content: String(req.body?.content || ''),
      coverUrl,
      media,
      createdBy: Number(req.actor.actorId || 0),
      creatorRole: isPlatformAdmin ? 'platform_admin' : isCompanyAdmin ? 'company_admin' : 'agent',
      templateScope: isPlatformAdmin ? 'platform' : 'tenant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.learningCourses.push(row);
    persistState();
    res.json({ ok: true, course: row });
  });

  app.put('/api/p/learning/courses/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const id = Number(req.params.id || 0);
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const source = (state.learningCourses || []).find((item) => Number(item.id) === id);
    if (!source) return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '资料不存在' });
    if (!canAccessTemplate(state, req.actor, source)) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限编辑该学习资料模板' });
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
    if (!title) return res.status(400).json({ code: 'COURSE_TITLE_REQUIRED', message: '资料标题不能为空' });
    row.title = title;
    row.category = String(req.body?.category ?? row.category ?? '通用培训');
    row.points = Number(req.body?.points ?? req.body?.rewardPoints ?? row.points ?? 0);
    row.rewardPoints = row.points;
    row.contentType = String(req.body?.contentType ?? row.contentType ?? 'article');
    row.status = String(req.body?.status ?? row.status ?? 'published');
    row.level = String(req.body?.level ?? row.level ?? '中级');
    row.content = String(req.body?.content ?? row.content ?? '');
    if (Array.isArray(req.body?.media)) row.media = req.body.media.slice(0, 6);
    row.updatedAt = new Date().toISOString();
    persistState();
    return res.json({ ok: true, course: row });
  });

  app.delete('/api/p/learning/courses/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.learningCourses)) state.learningCourses = [];
    const id = Number(req.params.id || 0);
    let index = state.learningCourses.findIndex((item) => Number(item.id) === id);
    if (index < 0) return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: '资料不存在' });
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const target = state.learningCourses[index];
    if (isCompanyAdmin && String(target.creatorRole || '') === 'platform_admin') {
      const tenantId = Number(req.tenantContext.tenantId || 0);
      index = state.learningCourses.findIndex(
        (item) =>
          Number(item.tenantId || 1) === tenantId &&
          Number(item.sourceTemplateId || 0) === Number(target.id || 0) &&
          String(item.creatorRole || '') === 'company_admin'
      );
      if (index < 0) return res.status(403).json({ code: 'NO_PERMISSION', message: '平台模板源数据不可直接删除' });
    }
    if (!canAccessTemplate(state, req.actor, state.learningCourses[index])) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限删除该学习资料模板' });
    }
    state.learningCourses.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });
}
