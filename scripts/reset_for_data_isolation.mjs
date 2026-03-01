import { closeState, getState, initializeState, persistState } from '../server/skeleton-c-v1/common/state.mjs';

function nowIso() {
  return new Date().toISOString();
}

(async () => {
  await initializeState();
  const state = getState();

  const before = {
    tenants: (state.tenants || []).length,
    agents: (state.agents || []).length,
    users: (state.users || []).length,
    trackEvents: (state.trackEvents || []).length,
    pointTransactions: (state.pointTransactions || []).length,
    eventDefinitions: (state.eventDefinitions || []).length,
    metricRules: (state.metricRules || []).length,
    pTagRules: (state.pTagRules || []).length,
    pActivities: (state.pActivities || []).length,
    pProducts: (state.pProducts || []).length,
    learningCourses: (state.learningCourses || []).length,
  };

  const preserved = {
    eventDefinitions: Array.isArray(state.eventDefinitions) ? [...state.eventDefinitions] : [],
    metricRules: Array.isArray(state.metricRules) ? [...state.metricRules] : [],
    pTagRules: Array.isArray(state.pTagRules) ? [...state.pTagRules] : [],
    pTags: Array.isArray(state.pTags) ? [...state.pTags] : [],
    pTagRuleJobs: Array.isArray(state.pTagRuleJobs) ? [...state.pTagRuleJobs] : [],
    pTagRuleJobLogs: Array.isArray(state.pTagRuleJobLogs) ? [...state.pTagRuleJobLogs] : [],
    pActivities: Array.isArray(state.pActivities) ? [...state.pActivities] : [],
    pProducts: Array.isArray(state.pProducts) ? [...state.pProducts] : [],
  };

  const t = nowIso();
  state.tenants = [
    { id: 1, name: '平台租户', status: 'active', type: 'company', createdAt: t },
    { id: 2, name: '隔离租户A', status: 'active', type: 'company', createdAt: t },
    { id: 3, name: '隔离租户B', status: 'active', type: 'company', createdAt: t },
    { id: 4, name: '隔离租户C', status: 'active', type: 'company', createdAt: t },
  ];

  state.orgUnits = [
    { id: 1, tenantId: 1, name: '平台机构', createdAt: t },
    { id: 2, tenantId: 2, name: '租户A机构', createdAt: t },
    { id: 3, tenantId: 3, name: '租户B机构', createdAt: t },
    { id: 4, tenantId: 4, name: '租户C机构', createdAt: t },
  ];

  state.teams = [
    { id: 1, tenantId: 1, orgId: 1, name: '平台团队', createdAt: t },
    { id: 2, tenantId: 2, orgId: 2, name: '租户A团队', createdAt: t },
    { id: 3, tenantId: 3, orgId: 3, name: '租户B团队', createdAt: t },
    { id: 4, tenantId: 4, orgId: 4, name: '租户C团队', createdAt: t },
  ];

  state.agents = [
    {
      id: 8201,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '租户A管理员',
      status: 'active',
      role: 'manager',
      account: 'tenanta_admin',
      email: 'tenanta_admin@demo.local',
      mobile: '13810000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: t,
    },
    {
      id: 8202,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '租户A业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenanta_agent1',
      email: 'tenanta_agent1@demo.local',
      mobile: '13810000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: t,
    },
    {
      id: 8301,
      tenantId: 3,
      orgId: 3,
      teamId: 3,
      name: '租户B管理员',
      status: 'active',
      role: 'manager',
      account: 'tenantb_admin',
      email: 'tenantb_admin@demo.local',
      mobile: '13820000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: t,
    },
    {
      id: 8302,
      tenantId: 3,
      orgId: 3,
      teamId: 3,
      name: '租户B业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenantb_agent1',
      email: 'tenantb_agent1@demo.local',
      mobile: '13820000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: t,
    },
    {
      id: 8401,
      tenantId: 4,
      orgId: 4,
      teamId: 4,
      name: '租户C管理员',
      status: 'active',
      role: 'manager',
      account: 'tenantc_admin',
      email: 'tenantc_admin@demo.local',
      mobile: '13830000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: t,
    },
    {
      id: 8402,
      tenantId: 4,
      orgId: 4,
      teamId: 4,
      name: '租户C业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenantc_agent1',
      email: 'tenantc_agent1@demo.local',
      mobile: '13830000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: t,
    },
  ];

  state.users = [];
  state.approvals = [];
  state.auditLogs = [];
  state.trackEvents = [];
  state.metricDailyUv = [];
  state.metricDailyCounters = [];
  state.metricHourlyCounters = [];
  state.idempotencyRecords = [];
  state.domainEvents = [];
  state.outboxEvents = [];
  state.smsCodes = [];
  state.sessions = [];
  state.activityCompletions = [];
  state.signIns = [];
  state.pointAccounts = [];
  state.pointTransactions = [];
  state.redemptions = [];
  state.orders = [];
  state.orderPayments = [];
  state.orderFulfillments = [];
  state.orderRefunds = [];
  state.bCustomerTags = [];
  state.bCustomerTagRels = [];
  state.bCustomerActivities = [];
  state.bWriteOffRecords = [];
  state.mallActivities = [];
  state.learningCourses = [];
  state.courseCompletions = [];
  state.learningGames = [];
  state.learningTools = [];
  state.insuranceSummary = {};
  state.familyMembers = [];
  state.insuranceReminders = [];
  state.policies = [];

  state.activities = [];
  state.mallItems = [];

  state.eventDefinitions = preserved.eventDefinitions;
  state.metricRules = preserved.metricRules;
  state.pTags = preserved.pTags;
  state.pTagRules = preserved.pTagRules;
  state.pTagRuleJobs = preserved.pTagRuleJobs;
  state.pTagRuleJobLogs = preserved.pTagRuleJobLogs;
  state.pActivities = preserved.pActivities;
  state.pProducts = preserved.pProducts;
  state.pLearningMaterials = [];

  const roleByKey = new Map((state.roles || []).map((r) => [String(r.key || ''), Number(r.id)]));
  state.userRoles = [
    { id: 1, tenantId: 1, userType: 'employee', userId: 9001, roleId: roleByKey.get('platform_admin') || 1 },
    { id: 2, tenantId: 2, userType: 'employee', userId: 8201, roleId: roleByKey.get('company_admin') || 2 },
    { id: 3, tenantId: 2, userType: 'agent', userId: 8202, roleId: roleByKey.get('agent') || 4 },
    { id: 4, tenantId: 3, userType: 'employee', userId: 8301, roleId: roleByKey.get('company_admin') || 2 },
    { id: 5, tenantId: 3, userType: 'agent', userId: 8302, roleId: roleByKey.get('agent') || 4 },
    { id: 6, tenantId: 4, userType: 'employee', userId: 8401, roleId: roleByKey.get('company_admin') || 2 },
    { id: 7, tenantId: 4, userType: 'agent', userId: 8402, roleId: roleByKey.get('agent') || 4 },
  ];

  persistState();
  await closeState();

  const after = {
    tenants: state.tenants.length,
    agents: state.agents.length,
    users: state.users.length,
    trackEvents: state.trackEvents.length,
    pointTransactions: state.pointTransactions.length,
    eventDefinitions: state.eventDefinitions.length,
    metricRules: state.metricRules.length,
    pTagRules: state.pTagRules.length,
    pActivities: state.pActivities.length,
    pProducts: state.pProducts.length,
    learningCourses: state.learningCourses.length,
  };

  console.log(JSON.stringify({ ok: true, before, after }, null, 2));
})();
