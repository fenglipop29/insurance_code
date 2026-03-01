import { assertPlatformOrCompanyAdmin, resolveCompanyAdminTenantContext, toHttpError } from '../services/workforce.service.mjs';

export function registerPAdminWorkforceRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    requireActionConfirmation,
    getState,
    nextId,
    persistState,
    hasRole,
    ensureTenantTeams,
    assignCustomerByMobile,
    systemAssignCustomers,
  } = deps;

  app.get('/api/p/employees', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    let tenantId = 0;
    let orgId = 0;
    try {
      ({ tenantId, orgId } = resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户员工',
      }));
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const teams = ensureTenantTeams(state, tenantId, orgId);
    const teamMap = new Map(teams.map((row) => [Number(row.id), String(row.name || '')]));
    const list = (state.agents || [])
      .filter((row) => Number(row.tenantId) === tenantId)
      .map((row) => ({
        ...row,
        teamName: teamMap.get(Number(row.teamId || 0)) || `团队 ${Number(row.teamId || 0)}`,
        password: undefined,
      }));
    res.json({ list });
  });

  app.get('/api/p/teams', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    let tenantId = 0;
    let orgId = 0;
    try {
      ({ tenantId, orgId } = resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户团队',
      }));
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const list = ensureTenantTeams(state, tenantId, orgId)
      .map((row) => ({
        id: Number(row.id),
        tenantId,
        orgId: Number(row.orgId || 0),
        name: String(row.name || ''),
        createdAt: row.createdAt || new Date().toISOString(),
      }))
      .sort((a, b) => Number(a.id) - Number(b.id));
    res.json({ list });
  });

  app.post('/api/p/teams', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    let tenantId = 0;
    let orgId = 0;
    try {
      ({ tenantId, orgId } = resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户团队',
      }));
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    if (!Array.isArray(state.teams)) state.teams = [];
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ code: 'TEAM_NAME_REQUIRED', message: '团队名称不能为空' });
    const exists = state.teams.find((row) => Number(row.tenantId || 0) === tenantId && String(row.name || '').trim() === name);
    if (exists) return res.status(409).json({ code: 'TEAM_NAME_EXISTS', message: '团队名称已存在' });
    const row = {
      id: nextId(state.teams),
      tenantId,
      orgId: orgId > 0 ? orgId : null,
      name,
      createdAt: new Date().toISOString(),
    };
    state.teams.push(row);
    persistState();
    res.json({ ok: true, team: row });
  });

  app.put('/api/p/teams/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    let tenantId = 0;
    try {
      ({ tenantId } = resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户团队',
      }));
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ code: 'TEAM_ID_REQUIRED', message: '团队ID不能为空' });
    const row = (state.teams || []).find((x) => Number(x.id) === id && Number(x.tenantId || 0) === tenantId);
    if (!row) return res.status(404).json({ code: 'TEAM_NOT_FOUND', message: '团队不存在' });
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ code: 'TEAM_NAME_REQUIRED', message: '团队名称不能为空' });
    const duplicated = (state.teams || []).find(
      (x) => Number(x.id) !== id && Number(x.tenantId || 0) === tenantId && String(x.name || '').trim() === name
    );
    if (duplicated) return res.status(409).json({ code: 'TEAM_NAME_EXISTS', message: '团队名称已存在' });
    row.name = name;
    row.updatedAt = new Date().toISOString();
    persistState();
    res.json({ ok: true, team: row });
  });

  app.delete('/api/p/teams/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    let tenantId = 0;
    try {
      ({ tenantId } = resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户团队',
      }));
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ code: 'TEAM_ID_REQUIRED', message: '团队ID不能为空' });
    const index = (state.teams || []).findIndex((x) => Number(x.id) === id && Number(x.tenantId || 0) === tenantId);
    if (index < 0) return res.status(404).json({ code: 'TEAM_NOT_FOUND', message: '团队不存在' });
    const hasMembers = (state.agents || []).some((x) => Number(x.tenantId || 0) === tenantId && Number(x.teamId || 0) === id);
    if (hasMembers) {
      return res.status(409).json({ code: 'TEAM_HAS_MEMBERS', message: '团队下存在员工，无法删除' });
    }
    state.teams.splice(index, 1);
    persistState();
    res.json({ ok: true });
  });

  app.get('/api/p/customers', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    try {
      assertPlatformOrCompanyAdmin({
        state,
        actor: req.actor,
        hasRole,
        actionMessage: '仅平台管理员或公司账号可查看客户分配',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const tenantId = Number(req.tenantContext.tenantId);
    const agentMap = new Map((state.agents || []).filter((row) => Number(row.tenantId) === tenantId).map((row) => [Number(row.id), row]));
    const list = (state.users || [])
      .filter((row) => Number(row.tenantId || 0) === tenantId)
      .map((row) => {
        const owner = agentMap.get(Number(row.ownerUserId || 0));
        return {
          id: Number(row.id),
          name: String(row.name || ''),
          mobile: String(row.mobile || ''),
          ownerUserId: Number(row.ownerUserId || 0),
          ownerName: owner ? String(owner.name || owner.email || owner.account || '') : '',
          orgId: Number(row.orgId || 1),
          teamId: Number(row.teamId || 1),
        };
      });
    res.json({ list });
  });

  app.post('/api/p/customers/system-assign', tenantContext, permissionRequired('customer:write'), requireActionConfirmation('客户系统分配'), (req, res) => {
    const state = getState();
    try {
      assertPlatformOrCompanyAdmin({
        state,
        actor: req.actor,
        hasRole,
        actionMessage: '仅平台管理员或公司账号可执行系统分配',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }

    const tenantId = Number(req.tenantContext.tenantId);
    const agentId = Number(req.body?.agentId || 0);
    const customerIds = Array.isArray(req.body?.customerIds)
      ? req.body.customerIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    if (!agentId) return res.status(400).json({ code: 'AGENT_REQUIRED', message: 'agentId 不能为空' });
    if (!customerIds.length) {
      return res.status(400).json({ code: 'CUSTOMER_IDS_REQUIRED', message: 'customerIds 不能为空，禁止默认全量分配' });
    }

    const agent = (state.agents || []).find((row) => Number(row.id) === agentId && Number(row.tenantId || 1) === tenantId);
    if (!agent) return res.status(404).json({ code: 'AGENT_NOT_FOUND', message: '员工不存在或不在当前租户' });

    const allCustomers = (state.users || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const selected = allCustomers.filter((row) => customerIds.includes(Number(row.id)));

    return res.json(
      systemAssignCustomers({
        state,
        tenantId,
        actor: req.actor,
        agent,
        customers: selected,
      })
    );
  });

  app.post('/api/p/customers/assign-by-mobile', tenantContext, permissionRequired('customer:write'), requireActionConfirmation('客户归属绑定'), (req, res) => {
    const state = getState();
    try {
      assertPlatformOrCompanyAdmin({
        state,
        actor: req.actor,
        hasRole,
        actionMessage: '仅平台管理员或公司账号可执行客户绑定',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }

    const mobile = String(req.body?.mobile || '').trim();
    const agentId = Number(req.body?.agentId || 0);
    if (!/^1\d{10}$/.test(mobile)) {
      return res.status(400).json({ code: 'CUSTOMER_MOBILE_INVALID', message: '客户手机号格式错误' });
    }
    if (!agentId) {
      return res.status(400).json({ code: 'AGENT_REQUIRED', message: 'agentId 不能为空' });
    }

    const agent = (state.agents || []).find((row) => Number(row.id) === agentId);
    if (!agent) return res.status(404).json({ code: 'AGENT_NOT_FOUND', message: '员工不存在' });

    const customer = (state.users || []).find((row) => String(row.mobile || '') === mobile);
    if (!customer) {
      return res.status(404).json({ code: 'CUSTOMER_NOT_FOUND', message: '客户不存在，请先让客户在C端注册/登录' });
    }
    return res.json(
      assignCustomerByMobile({
        state,
        actor: req.actor,
        mobile,
        agent,
        customer,
      })
    );
  });

  app.post('/api/p/employees', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    try {
      resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户员工',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    if (!Array.isArray(state.agents)) state.agents = [];
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const mobile = String(req.body?.mobile || '').trim();
    const role = String(req.body?.role || 'salesperson');
    const initialPassword = String(req.body?.initialPassword || '123456');
    const defaultOrgId = Number(req.tenantContext.orgId || 0);
    const teamId = Number(req.body?.teamId || 0);
    const orgId = Number(req.body?.orgId || defaultOrgId || 0);
    if (!name) return res.status(400).json({ code: 'EMPLOYEE_NAME_REQUIRED', message: '员工姓名不能为空' });
    if (!email) return res.status(400).json({ code: 'EMPLOYEE_EMAIL_REQUIRED', message: '员工邮箱不能为空' });
    if (!mobile) return res.status(400).json({ code: 'EMPLOYEE_MOBILE_REQUIRED', message: '员工手机号不能为空' });
    if (!/^1\d{10}$/.test(mobile)) return res.status(400).json({ code: 'EMPLOYEE_MOBILE_INVALID', message: '手机号格式错误，请输入11位手机号' });
    if (!Number.isFinite(teamId) || teamId < 1) return res.status(400).json({ code: 'EMPLOYEE_TEAM_INVALID', message: '团队ID必须是大于0的数字' });
    const team = ensureTenantTeams(state, Number(req.tenantContext.tenantId || 0), orgId).find((x) => Number(x.id) === teamId);
    if (!team) return res.status(400).json({ code: 'EMPLOYEE_TEAM_NOT_FOUND', message: '请选择有效团队' });
    const duplicated = (state.agents || []).find(
      (x) =>
        Number(x.tenantId || 1) === Number(req.tenantContext.tenantId) &&
        (String(x.email || '').toLowerCase() === email.toLowerCase() || String(x.mobile || '') === mobile)
    );
    if (duplicated) {
      return res.status(409).json({ code: 'EMPLOYEE_ACCOUNT_CONFLICT', message: '邮箱或手机号已存在' });
    }

    const row = {
      id: nextId(state.agents),
      tenantId: req.tenantContext.tenantId,
      orgId,
      teamId,
      name,
      email,
      mobile,
      account: email,
      password: initialPassword,
      initialPassword,
      role,
      status: 'invited',
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
    };
    state.agents.push(row);
    if (!Array.isArray(state.userRoles)) state.userRoles = [];
    const roleKey = role === 'manager' ? 'company_admin' : role === 'support' ? 'team_lead' : 'agent';
    const matchedRole = (state.roles || []).find((x) => x.key === roleKey);
    if (matchedRole) {
      const userType = roleKey === 'agent' ? 'agent' : 'employee';
      const exists = (state.userRoles || []).some(
        (x) =>
          Number(x.tenantId) === Number(req.tenantContext.tenantId) &&
          String(x.userType) === userType &&
          Number(x.userId) === Number(row.id) &&
          Number(x.roleId) === Number(matchedRole.id)
      );
      if (!exists) {
        state.userRoles.push({
          id: nextId(state.userRoles),
          tenantId: req.tenantContext.tenantId,
          userType,
          userId: Number(row.id),
          roleId: Number(matchedRole.id),
        });
      }
    }
    persistState();
    return res.json({
      ok: true,
      employee: {
        ...row,
        password: undefined,
      },
      initialPassword,
    });
  });

  app.put('/api/p/employees/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    try {
      resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户员工',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const id = Number(req.params.id || 0);
    const row = (state.agents || []).find(
      (item) => Number(item.id) === id && Number(item.tenantId || 1) === Number(req.tenantContext.tenantId)
    );
    if (!row) return res.status(404).json({ code: 'EMPLOYEE_NOT_FOUND', message: '员工不存在' });
    const name = String(req.body?.name ?? row.name ?? '').trim();
    const email = String(req.body?.email ?? row.email ?? '').trim();
    const mobile = String(req.body?.mobile ?? row.mobile ?? '').trim();
    if (!name || !email || !mobile) return res.status(400).json({ code: 'EMPLOYEE_PARAMS_INVALID', message: '员工姓名、邮箱、手机号不能为空' });
    if (!/^1\d{10}$/.test(mobile)) return res.status(400).json({ code: 'EMPLOYEE_MOBILE_INVALID', message: '手机号格式错误，请输入11位手机号' });
    const nextTeamId = Number(req.body?.teamId ?? row.teamId ?? 0);
    const nextOrgId = Number(req.body?.orgId ?? row.orgId ?? 0);
    if (!Number.isFinite(nextTeamId) || nextTeamId < 1) {
      return res.status(400).json({ code: 'EMPLOYEE_TEAM_INVALID', message: '团队ID必须是大于0的数字' });
    }
    row.name = name;
    row.email = email;
    row.mobile = mobile;
    row.role = String(req.body?.role ?? row.role ?? 'salesperson');
    const team = ensureTenantTeams(state, Number(req.tenantContext.tenantId || 0), nextOrgId).find((x) => Number(x.id) === nextTeamId);
    if (!team) {
      return res.status(400).json({ code: 'EMPLOYEE_TEAM_NOT_FOUND', message: '请选择有效团队' });
    }
    row.teamId = nextTeamId;
    row.orgId = nextOrgId;
    row.status = String(req.body?.status ?? row.status ?? 'active');
    row.lastActiveAt = row.lastActiveAt || new Date().toISOString();
    row.updatedAt = new Date().toISOString();
    if (!Array.isArray(state.userRoles)) state.userRoles = [];
    const roleKey = row.role === 'manager' ? 'company_admin' : row.role === 'support' ? 'team_lead' : 'agent';
    const matchedRole = (state.roles || []).find((x) => x.key === roleKey);
    state.userRoles = (state.userRoles || []).filter(
      (x) =>
        !(
          Number(x.tenantId) === Number(req.tenantContext.tenantId) &&
          Number(x.userId) === Number(row.id) &&
          (String(x.userType) === 'employee' || String(x.userType) === 'agent')
        )
    );
    if (matchedRole) {
      state.userRoles.push({
        id: nextId(state.userRoles),
        tenantId: req.tenantContext.tenantId,
        userType: roleKey === 'agent' ? 'agent' : 'employee',
        userId: Number(row.id),
        roleId: Number(matchedRole.id),
      });
    }
    persistState();
    return res.json({ ok: true, employee: { ...row, password: undefined } });
  });

  app.delete('/api/p/employees/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const state = getState();
    try {
      resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户员工',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    if (!Array.isArray(state.agents)) state.agents = [];
    const id = Number(req.params.id || 0);
    const index = state.agents.findIndex(
      (item) => Number(item.id) === id && Number(item.tenantId || 1) === Number(req.tenantContext.tenantId)
    );
    if (index < 0) return res.status(404).json({ code: 'EMPLOYEE_NOT_FOUND', message: '员工不存在' });
    state.agents.splice(index, 1);
    if (Array.isArray(state.userRoles)) {
      state.userRoles = state.userRoles.filter(
        (item) => !(Number(item.userId) === id && Number(item.tenantId || 1) === Number(req.tenantContext.tenantId))
      );
    }
    persistState();
    return res.json({ ok: true });
  });
}
