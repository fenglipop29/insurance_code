export function registerPAdminMallRoutes(app, deps) {
  const { tenantContext, permissionRequired, getState, nextId, persistState, hasRole, canOperateTenantTemplates, canAccessTemplate } = deps;

  app.get('/api/p/mall/products', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const products = Array.isArray(state.pProducts) ? state.pProducts : [];
    const source = products.length ? products : state.mallItems || [];
    const list = source
      .filter((item) => canAccessTemplate(state, req.actor, item))
      .map((item, idx) => ({
        id: Number(item.id || idx + 1),
        title: String(item.title || item.name || '').trim(),
        points: Number(item.points ?? item.pointsCost ?? 0),
        stock: Number(item.stock ?? 0),
        sortOrder: Number(item.sortOrder ?? idx + 1),
        category: String(item.category || '实物礼品 (Gift)'),
        description: String(item.description || ''),
        limitPerUser: Boolean(item.limitPerUser),
        vipOnly: Boolean(item.vipOnly),
        enableCountdown: Boolean(item.enableCountdown),
        status: isCompanyAdmin && String(item.creatorRole || '') === 'platform_admin'
          ? 'inactive'
          : String(item.status || (item.isActive ? 'active' : 'inactive') || 'inactive'),
        updatedAt: item.updatedAt || new Date().toISOString(),
        media: Array.isArray(item.media) ? item.media.slice(0, 6) : [],
        isPlatformTemplate: Boolean(
          item.platformTemplate || Number(item.sourceTemplateId || 0) > 0 || String(item.creatorRole || '') === 'platform_admin'
        ),
        templateTag:
          item.platformTemplate || Number(item.sourceTemplateId || 0) > 0 || String(item.creatorRole || '') === 'platform_admin'
            ? '平台模板'
            : '',
      }));
    res.json({ list });
  });

  app.post('/api/p/mall/products', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = canOperateTenantTemplates(state, req.actor);
    if (!isPlatformAdmin && !isCompanyActor) {
      return res.status(403).json({ code: 'COMPANY_ACCOUNT_REQUIRED', message: '仅平台管理员、公司管理员或业务员可管理积分商城(v2)' });
    }
    if (!Array.isArray(state.pProducts)) state.pProducts = [];
    if (!Array.isArray(state.mallItems)) state.mallItems = [];
    const title = String(req.body?.title || '').trim();
    const points = Number(req.body?.points ?? req.body?.pointsCost ?? 0);
    const stock = Number(req.body?.stock || 0);
    if (!title) return res.status(400).json({ code: 'PRODUCT_TITLE_REQUIRED', message: '商品标题不能为空' });

    const media = Array.isArray(req.body?.media) ? req.body.media.slice(0, 6) : [];
    const status = String(req.body?.status || 'active');
    const row = {
      id: nextId(state.pProducts),
      tenantId: req.tenantContext.tenantId,
      title,
      points,
      stock,
      sortOrder: Number(req.body?.sortOrder || state.pProducts.length + 1),
      category: String(req.body?.category || '实物礼品 (Gift)'),
      description: String(req.body?.description || ''),
      limitPerUser: Boolean(req.body?.limitPerUser),
      vipOnly: Boolean(req.body?.vipOnly),
      enableCountdown: Boolean(req.body?.enableCountdown),
      media,
      createdBy: Number(req.actor.actorId || 0),
      creatorRole: isPlatformAdmin ? 'platform_admin' : isCompanyAdmin ? 'company_admin' : 'agent',
      templateScope: isPlatformAdmin ? 'platform' : 'tenant',
      status,
      updatedAt: new Date().toISOString(),
    };
    state.pProducts.push(row);
    state.mallItems.push({
      id: nextId(state.mallItems),
      name: row.title,
      pointsCost: row.points,
      stock: row.stock,
      isActive: ['active', 'online', 'published', 'on', '进行中', '生效'].includes(status.toLowerCase()),
      media,
      description: row.description,
      tenantId: row.tenantId,
      createdBy: row.createdBy,
      creatorRole: row.creatorRole,
      templateScope: row.templateScope,
    });
    persistState();
    res.json({ ok: true, product: row });
  });

  app.put('/api/p/mall/products/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const id = Number(req.params.id || 0);
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const source = (state.pProducts || []).find((item) => Number(item.id) === id);
    if (!source) return res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: '商品不存在' });
    if (!canAccessTemplate(state, req.actor, source)) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限编辑该商城模板' });
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
    if (!title) return res.status(400).json({ code: 'PRODUCT_TITLE_REQUIRED', message: '商品标题不能为空' });
    row.title = title;
    row.points = Number(req.body?.points ?? req.body?.pointsCost ?? row.points ?? 0);
    row.stock = Number(req.body?.stock ?? row.stock ?? 0);
    row.sortOrder = Number(req.body?.sortOrder ?? row.sortOrder ?? 1);
    row.category = String(req.body?.category ?? row.category ?? '实物礼品 (Gift)');
    row.description = String(req.body?.description ?? row.description ?? '');
    row.limitPerUser = Boolean(req.body?.limitPerUser ?? row.limitPerUser);
    row.vipOnly = Boolean(req.body?.vipOnly ?? row.vipOnly);
    row.enableCountdown = Boolean(req.body?.enableCountdown ?? row.enableCountdown);
    row.status = String(req.body?.status ?? row.status ?? 'active');
    if (Array.isArray(req.body?.media)) row.media = req.body.media.slice(0, 6);
    row.updatedAt = new Date().toISOString();
    persistState();
    return res.json({ ok: true, product: row });
  });

  app.delete('/api/p/mall/products/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.pProducts)) state.pProducts = [];
    const id = Number(req.params.id || 0);
    let index = state.pProducts.findIndex((item) => Number(item.id) === id);
    if (index < 0) return res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: '商品不存在' });
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const target = state.pProducts[index];
    if (isCompanyAdmin && String(target.creatorRole || '') === 'platform_admin') {
      const tenantId = Number(req.tenantContext.tenantId || 0);
      index = state.pProducts.findIndex(
        (item) =>
          Number(item.tenantId || 1) === tenantId &&
          Number(item.sourceTemplateId || 0) === Number(target.id || 0) &&
          String(item.creatorRole || '') === 'company_admin'
      );
      if (index < 0) return res.status(403).json({ code: 'NO_PERMISSION', message: '平台模板源数据不可直接删除' });
    }
    if (!canAccessTemplate(state, req.actor, state.pProducts[index])) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限删除该商城模板' });
    }
    state.pProducts.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });

  app.get('/api/p/mall/activities', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const mallSaved = Array.isArray(state.mallActivities) ? state.mallActivities : [];
    const legacy = Array.isArray(state.bCustomerActivities) ? state.bCustomerActivities : [];
    const source = mallSaved.length ? mallSaved : legacy;
    const list = source
      .filter((item) => canAccessTemplate(state, req.actor, item))
      .map((item, idx) => ({
        id: Number(item.id || idx + 1),
        title: String(item.title || item.name || '').trim(),
        displayTitle: String(item.displayTitle || item.title || item.name || '').trim(),
        type: String(item.type || item.category || 'task'),
        rewardPoints: Number(item.rewardPoints ?? item.points ?? 0),
        sortOrder: Number(item.sortOrder ?? idx + 1),
        description: String(item.description || ''),
        status: isCompanyAdmin && String(item.creatorRole || '') === 'platform_admin' ? 'inactive' : String(item.status || 'active'),
        updatedAt: item.updatedAt || new Date().toISOString(),
        media: Array.isArray(item.media) ? item.media.slice(0, 6) : [],
        isPlatformTemplate: Boolean(
          item.platformTemplate || Number(item.sourceTemplateId || 0) > 0 || String(item.creatorRole || '') === 'platform_admin'
        ),
        templateTag:
          item.platformTemplate || Number(item.sourceTemplateId || 0) > 0 || String(item.creatorRole || '') === 'platform_admin'
            ? '平台模板'
            : '',
      }));
    res.json({ list });
  });

  app.get('/api/p/strategies', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const source = Array.isArray(state.pActivities) && state.pActivities.length ? state.pActivities : state.activities || [];
    const list = source.slice(0, 6).map((item, idx) => {
      const id = Number(item.id || idx + 1);
      const matchedCustomers = 80 + idx * 24;
      return {
        id: `POLICY-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(id).padStart(2, '0')}`,
        name: String(item.title || item.name || `策略${id}`),
        status: idx % 4 === 3 ? 'draft' : 'active',
        lastExecutedAt: idx % 4 === 3 ? null : new Date(Date.now() - idx * 3600 * 1000).toISOString(),
        priority: idx % 2 === 0 ? 'P1' : 'P2',
        frequency: idx % 2 === 0 ? '每1小时' : '每天09:00',
        matchedCustomers,
        successRate: Math.max(88, 99 - idx * 3),
        tenantId: req.tenantContext.tenantId,
      };
    });
    res.json({ list });
  });

  app.post('/api/p/mall/activities', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = canOperateTenantTemplates(state, req.actor);
    if (!isPlatformAdmin && !isCompanyActor) {
      return res.status(403).json({ code: 'COMPANY_ACCOUNT_REQUIRED', message: '仅平台管理员、公司管理员或业务员可管理积分商城(v2)' });
    }
    if (!Array.isArray(state.mallActivities)) state.mallActivities = [];
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ code: 'ACTIVITY_TITLE_REQUIRED', message: '活动标题不能为空' });
    const row = {
      id: nextId(state.mallActivities),
      tenantId: req.tenantContext.tenantId,
      title,
      displayTitle: String(req.body?.displayTitle || title),
      type: String(req.body?.type || 'task'),
      rewardPoints: Number(req.body?.rewardPoints || 0),
      sortOrder: Number(req.body?.sortOrder || state.pActivities.length + 1),
      description: String(req.body?.description || ''),
      media: Array.isArray(req.body?.media) ? req.body.media.slice(0, 6) : [],
      createdBy: Number(req.actor.actorId || 0),
      creatorRole: isPlatformAdmin ? 'platform_admin' : isCompanyAdmin ? 'company_admin' : 'agent',
      templateScope: isPlatformAdmin ? 'platform' : 'tenant',
      sourceDomain: 'mall',
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    state.mallActivities.push(row);
    persistState();
    res.json({ ok: true, activity: row });
  });

  app.put('/api/p/mall/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    const id = Number(req.params.id || 0);
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const source = (state.mallActivities || []).find((item) => Number(item.id) === id);
    if (!source) return res.status(404).json({ code: 'MALL_ACTIVITY_NOT_FOUND', message: '活动不存在' });
    if (!canAccessTemplate(state, req.actor, source)) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限编辑该商城活动模板' });
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
    row.displayTitle = String(req.body?.displayTitle ?? row.displayTitle ?? title);
    row.type = String(req.body?.type ?? row.type ?? 'task');
    row.rewardPoints = Number(req.body?.rewardPoints ?? row.rewardPoints ?? 0);
    row.sortOrder = Number(req.body?.sortOrder ?? row.sortOrder ?? 1);
    row.description = String(req.body?.description ?? row.description ?? '');
    row.status = String(req.body?.status ?? row.status ?? 'active');
    if (Array.isArray(req.body?.media)) row.media = req.body.media.slice(0, 6);
    row.updatedAt = new Date().toISOString();
    persistState();
    return res.json({ ok: true, activity: row });
  });

  app.delete('/api/p/mall/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.mallActivities)) state.mallActivities = [];
    const id = Number(req.params.id || 0);
    let index = state.mallActivities.findIndex((item) => Number(item.id) === id);
    if (index < 0) return res.status(404).json({ code: 'MALL_ACTIVITY_NOT_FOUND', message: '活动不存在' });
    const isCompanyAdmin = hasRole(state, req.actor, 'company_admin');
    const target = state.mallActivities[index];
    if (isCompanyAdmin && String(target.creatorRole || '') === 'platform_admin') {
      const tenantId = Number(req.tenantContext.tenantId || 0);
      index = state.mallActivities.findIndex(
        (item) =>
          Number(item.tenantId || 1) === tenantId &&
          Number(item.sourceTemplateId || 0) === Number(target.id || 0) &&
          String(item.creatorRole || '') === 'company_admin'
      );
      if (index < 0) return res.status(403).json({ code: 'NO_PERMISSION', message: '平台模板源数据不可直接删除' });
    }
    if (!canAccessTemplate(state, req.actor, state.mallActivities[index])) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限删除该商城活动模板' });
    }
    state.mallActivities.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });
}
