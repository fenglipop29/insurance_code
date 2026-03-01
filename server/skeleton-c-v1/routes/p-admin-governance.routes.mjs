export function registerPAdminGovernanceRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    appendAuditLog,
    hasRole,
    COMPANY_ADMIN_PAGE_MODULES,
    allCompanyAdminPageIds,
  } = deps;

  app.get('/api/p/tenants', tenantContext, permissionRequired('tenant:read'), (req, res) => {
    const state = getState();
    const list = (state.tenants || []).filter((row) => Number(row.id) === Number(req.tenantContext.tenantId) || req.actor.actorId === 9001);
    res.json({ list });
  });

  app.post('/api/p/tenants', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.tenants)) state.tenants = [];
    if (!Array.isArray(state.orgUnits)) state.orgUnits = [];
    if (!Array.isArray(state.teams)) state.teams = [];
    if (!Array.isArray(state.agents)) state.agents = [];
    if (!Array.isArray(state.userRoles)) state.userRoles = [];
    const name = String(req.body?.name || '').trim();
    const type = String(req.body?.type || 'company');
    const statusRaw = String(req.body?.status || 'active').trim().toLowerCase();
    const adminEmail = String(req.body?.adminEmail || '').trim().toLowerCase();
    const initialPassword = String(req.body?.initialPassword || '').trim();
    if (!name) return res.status(400).json({ code: 'TENANT_NAME_REQUIRED', message: '租户名称不能为空' });
    if (!adminEmail) return res.status(400).json({ code: 'ADMIN_EMAIL_REQUIRED', message: '管理员邮箱不能为空' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return res.status(400).json({ code: 'ADMIN_EMAIL_INVALID', message: '管理员邮箱格式错误' });
    }
    if (initialPassword.length < 6) {
      return res.status(400).json({ code: 'ADMIN_PASSWORD_INVALID', message: '初始密码至少6位' });
    }
    const duplicatedAdmin = (state.agents || []).find((x) => String(x.email || '').toLowerCase() === adminEmail);
    if (duplicatedAdmin) {
      return res.status(409).json({ code: 'ADMIN_EMAIL_CONFLICT', message: '管理员邮箱已存在' });
    }

    const row = {
      id: nextId(state.tenants),
      name,
      type: type === 'individual' ? 'individual' : 'company',
      status: ['active', 'inactive', 'disabled'].includes(statusRaw) ? statusRaw : 'active',
      adminEmail,
      createdBy: req.actor.actorId,
      createdAt: new Date().toISOString(),
    };
    state.tenants.push(row);
    const org = {
      id: nextId(state.orgUnits),
      tenantId: Number(row.id),
      name: `${row.name}默认机构`,
      createdAt: new Date().toISOString(),
    };
    state.orgUnits.push(org);
    const team = {
      id: nextId(state.teams),
      tenantId: Number(row.id),
      orgId: Number(org.id),
      name: `${row.name}默认团队`,
      createdAt: new Date().toISOString(),
    };
    state.teams.push(team);
    const adminAgent = {
      id: nextId(state.agents),
      tenantId: Number(row.id),
      orgId: Number(org.id),
      teamId: Number(team.id),
      name: `${row.name}管理员`,
      email: adminEmail,
      account: adminEmail,
      mobile: '',
      password: initialPassword,
      initialPassword,
      role: 'manager',
      status: row.status === 'active' ? 'active' : 'invited',
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
    };
    state.agents.push(adminAgent);
    const companyAdminRole = (state.roles || []).find((x) => String(x.key) === 'company_admin');
    if (companyAdminRole) {
      state.userRoles.push({
        id: nextId(state.userRoles),
        tenantId: Number(row.id),
        userType: 'employee',
        userId: Number(adminAgent.id),
        roleId: Number(companyAdminRole.id),
      });
    }
    appendAuditLog({
      tenantId: req.tenantContext.tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'tenant.create',
      resourceType: 'tenant',
      resourceId: String(row.id),
      result: 'success',
    });
    persistState();
    return res.json({ ok: true, tenant: row });
  });

  app.put('/api/p/tenants/:id', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    const id = Number(req.params.id || 0);
    const row = (state.tenants || []).find((item) => Number(item.id) === id);
    if (!row) return res.status(404).json({ code: 'TENANT_NOT_FOUND', message: '租户不存在' });
    const canManage = req.actor.actorId === 9001 || Number(row.id) === Number(req.tenantContext.tenantId);
    if (!canManage) return res.status(403).json({ code: 'NO_PERMISSION', message: '暂无权限，请联系管理员' });

    const name = String(req.body?.name ?? row.name ?? '').trim();
    const statusRaw = String(req.body?.status ?? row.status ?? 'active').toLowerCase();
    const typeRaw = String(req.body?.type ?? row.type ?? 'company').toLowerCase();
    const adminEmailRaw = String(req.body?.adminEmail ?? row.adminEmail ?? '').trim().toLowerCase();
    if (!name) return res.status(400).json({ code: 'TENANT_NAME_REQUIRED', message: '租户名称不能为空' });
    if (!adminEmailRaw) return res.status(400).json({ code: 'ADMIN_EMAIL_REQUIRED', message: '管理员邮箱不能为空' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmailRaw)) {
      return res.status(400).json({ code: 'ADMIN_EMAIL_INVALID', message: '管理员邮箱格式错误' });
    }
    const duplicatedAdmin = (state.agents || []).find(
      (x) => Number(x.tenantId || 1) !== Number(id) && String(x.email || '').toLowerCase() === adminEmailRaw
    );
    if (duplicatedAdmin) {
      return res.status(409).json({ code: 'ADMIN_EMAIL_CONFLICT', message: '管理员邮箱已存在' });
    }

    row.name = name;
    row.status = ['active', 'inactive', 'disabled'].includes(statusRaw) ? statusRaw : 'active';
    row.type = typeRaw === 'individual' ? 'individual' : 'company';
    row.adminEmail = adminEmailRaw;
    row.updatedAt = new Date().toISOString();

    const tenantAdmins = (state.agents || []).filter(
      (x) => Number(x.tenantId || 1) === Number(id) && String(x.role || '').toLowerCase() === 'manager'
    );
    if (tenantAdmins.length > 0) {
      tenantAdmins.forEach((admin) => {
        admin.email = adminEmailRaw;
        admin.account = adminEmailRaw;
        admin.updatedAt = new Date().toISOString();
      });
    }

    persistState();
    return res.json({ ok: true, tenant: row });
  });

  app.delete('/api/p/tenants/:id', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.tenants)) state.tenants = [];
    const id = Number(req.params.id || 0);
    const index = state.tenants.findIndex((item) => Number(item.id) === id);
    if (index < 0) return res.status(404).json({ code: 'TENANT_NOT_FOUND', message: '租户不存在' });
    const target = state.tenants[index];
    const canManage = req.actor.actorId === 9001 || Number(target.id) === Number(req.tenantContext.tenantId);
    if (!canManage) return res.status(403).json({ code: 'NO_PERMISSION', message: '暂无权限，请联系管理员' });
    state.tenants.splice(index, 1);
    persistState();
    return res.json({ ok: true });
  });

  app.get('/api/p/permissions/matrix', tenantContext, permissionRequired('tenant:read'), (_req, res) => {
    const state = getState();
    res.json({
      roles: state.roles || [],
      permissions: state.permissions || [],
      rolePermissions: state.rolePermissions || [],
      userRoles: state.userRoles || [],
    });
  });

  app.get('/api/p/permissions/company-admin-pages', tenantContext, permissionRequired('tenant:read'), (req, res) => {
    const state = getState();
    const contextTenantId = Number(req.tenantContext?.tenantId || 0);
    if (!Number.isFinite(contextTenantId) || contextTenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }
    const isPlatformAdmin = hasRole(state, req.actor, 'platform_admin');
    const requestedTenantId = Number(req.query?.tenantId || 0);
    const tenantId = isPlatformAdmin && Number.isFinite(requestedTenantId) && requestedTenantId > 0 ? requestedTenantId : contextTenantId;
    if (!isPlatformAdmin && requestedTenantId > 0 && requestedTenantId !== contextTenantId) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '仅可查看本租户权限配置' });
    }
    const rows = (state.companyAdminPagePermissions || []).filter(
      (row) => Number(row.tenantId || 1) === tenantId && String(row.roleKey || 'company_admin') === 'company_admin'
    );
    const enabledByPageId = new Map(rows.map((row) => [String(row.pageId || ''), Boolean(row.enabled)]));
    const modules = COMPANY_ADMIN_PAGE_MODULES.map((module) => ({
      group: String(module.group || ''),
      pages: (module.pages || []).map((page) => ({
        pageId: String(page.pageId || ''),
        pageName: String(page.pageName || ''),
        enabled: enabledByPageId.has(String(page.pageId || '')) ? Boolean(enabledByPageId.get(String(page.pageId || ''))) : false,
      })),
    }));
    return res.json({
      tenantId,
      roleKey: 'company_admin',
      modules,
      grants: modules.flatMap((m) => m.pages),
    });
  });

  app.post('/api/p/permissions/company-admin-pages', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.companyAdminPagePermissions)) state.companyAdminPagePermissions = [];
    const contextTenantId = Number(req.tenantContext?.tenantId || 0);
    if (!Number.isFinite(contextTenantId) || contextTenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }
    const isPlatformAdmin = hasRole(state, req.actor, 'platform_admin');
    const requestedTenantId = Number(req.body?.tenantId || 0);
    const tenantId = isPlatformAdmin && Number.isFinite(requestedTenantId) && requestedTenantId > 0 ? requestedTenantId : contextTenantId;
    if (!isPlatformAdmin && requestedTenantId > 0 && requestedTenantId !== contextTenantId) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '仅可修改本租户权限配置' });
    }
    const grants = Array.isArray(req.body?.grants) ? req.body.grants : [];
    const validPageIds = new Set(allCompanyAdminPageIds());
    const normalized = grants
      .map((row) => ({
        pageId: String(row?.pageId || '').trim(),
        enabled: Boolean(row?.enabled),
      }))
      .filter((row) => row.pageId && validPageIds.has(row.pageId));
    if (!normalized.length) {
      return res.status(400).json({ code: 'PERMISSION_GRANTS_REQUIRED', message: '请至少提交一条页面权限' });
    }
    state.companyAdminPagePermissions = state.companyAdminPagePermissions.filter(
      (row) => !(Number(row.tenantId || 1) === tenantId && String(row.roleKey || 'company_admin') === 'company_admin')
    );
    const now = new Date().toISOString();
    normalized.forEach((row) => {
      state.companyAdminPagePermissions.push({
        id: nextId(state.companyAdminPagePermissions),
        tenantId,
        roleKey: 'company_admin',
        pageId: row.pageId,
        enabled: row.enabled,
        updatedAt: now,
      });
    });
    appendAuditLog({
      tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'company_admin_permission.update',
      resourceType: 'permission_matrix',
      resourceId: String(tenantId),
      result: 'success',
      meta: { grants: normalized },
    });
    persistState();
    return res.json({ ok: true, tenantId, roleKey: 'company_admin', grants: normalized });
  });

  app.post('/api/p/approvals', tenantContext, permissionRequired('approval:write'), (req, res) => {
    const state = getState();
    if (!Array.isArray(state.approvals)) state.approvals = [];
    const row = {
      id: nextId(state.approvals),
      tenantId: req.tenantContext.tenantId,
      requestType: String(req.body?.requestType || 'customer_detail_view'),
      requesterUserType: String(req.body?.requesterUserType || 'employee'),
      requesterUserId: Number(req.body?.requesterUserId || req.actor.actorId),
      reason: String(req.body?.reason || ''),
      scope: req.body?.scope || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    state.approvals.push(row);
    persistState();
    res.json({ ok: true, approval: row });
  });

  app.post('/api/p/approvals/:id/approve', tenantContext, permissionRequired('approval:write'), (req, res) => {
    const state = getState();
    const row = (state.approvals || []).find((item) => Number(item.id) === Number(req.params.id));
    if (!row) return res.status(404).json({ code: 'APPROVAL_NOT_FOUND', message: '审批单不存在' });
    row.status = 'approved';
    row.approvedBy = req.actor.actorId;
    row.approvedAt = new Date().toISOString();
    row.expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    appendAuditLog({
      tenantId: req.tenantContext.tenantId,
      actorType: req.actor.actorType,
      actorId: req.actor.actorId,
      action: 'approval.approve',
      resourceType: 'approval',
      resourceId: String(row.id),
      result: 'success',
    });
    persistState();
    res.json({ ok: true, approval: row });
  });
}
