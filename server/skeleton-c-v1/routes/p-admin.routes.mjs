import { permissionRequired, tenantContext } from '../common/access-control.mjs';
import { requireActionConfirmation } from '../common/middleware.mjs';
import { appendAuditLog, createActorSession, getState, nextId, persistState, resolveSessionFromBearer, upsertActorCsrfToken } from '../common/state.mjs';
import { canAccessTemplate } from '../common/template-visibility.mjs';
import { registerPAdminActivityRoutes } from './p-admin-activities.routes.mjs';
import { registerPAdminEventRoutes } from './p-admin-events.routes.mjs';
import { registerPAdminGovernanceRoutes } from './p-admin-governance.routes.mjs';
import { registerPAdminLearningRoutes } from './p-admin-learning.routes.mjs';
import { registerPAdminMallRoutes } from './p-admin-mall.routes.mjs';
import { registerPAdminMetricRoutes } from './p-admin-metrics.routes.mjs';
import { registerPAdminOpsRoutes } from './p-admin-ops.routes.mjs';
import { registerPAdminTagRoutes } from './p-admin-tags.routes.mjs';
import { registerPAdminWorkforceRoutes } from './p-admin-workforce.routes.mjs';
import { listSnapshots, latestSnapshot, rebuildDailySnapshot, runReconciliation } from '../services/analytics.service.mjs';
import { assignCustomerByMobile, systemAssignCustomers } from '../services/customer-assignment.service.mjs';
import { refundOrder } from '../services/commerce.service.mjs';
import os from 'node:os';

function hasRole(state, actor, roleKey) {
  const roleIds = (state.userRoles || [])
    .filter(
      (row) =>
        Number(row.tenantId) === Number(actor.tenantId) &&
        String(row.userType) === String(actor.actorType) &&
        Number(row.userId) === Number(actor.actorId)
    )
    .map((row) => Number(row.roleId));
  return (state.roles || []).some((role) => roleIds.includes(Number(role.id)) && String(role.key) === String(roleKey));
}

function canOperateTenantTemplates(state, actor) {
  const isPlatformAdmin = hasRole(state, actor, 'platform_admin');
  const isCompanyAdmin = hasRole(state, actor, 'company_admin');
  const isTeamLead = hasRole(state, actor, 'team_lead');
  const isAgent = hasRole(state, actor, 'agent');
  const actorType = String(actor?.actorType || '');
  const isCompanyActor = (actorType === 'employee' && (isCompanyAdmin || isTeamLead)) || (actorType === 'agent' && isAgent);
  return { isPlatformAdmin, isCompanyAdmin, isTeamLead, isAgent, isCompanyActor };
}

function ensureTenantTeams(state, tenantId, orgId = 1) {
  if (!Array.isArray(state.teams)) state.teams = [];
  const tid = Number(tenantId || 0);
  if (!Number.isFinite(tid) || tid <= 0) return [];
  const existing = state.teams.filter((row) => Number(row.tenantId || 0) === tid);
  return existing;
}

function decoratePlatformTemplateRow(row = {}) {
  if (!row || typeof row !== 'object') return row;
  const isPlatformTemplate = Boolean(
    row.platformTemplate || Number(row.sourceTemplateId || 0) > 0 || String(row.creatorRole || '') === 'platform_admin'
  );
  if (!isPlatformTemplate) return row;
  return {
    ...row,
    isPlatformTemplate: true,
    templateTag: '平台模板',
  };
}

const METRIC_CARD_SEEDS = {
  c: [
    { key: 'c_dau', name: 'C端日活 (DAU)', value: '12,840', trend: '↑ 8.2%', trendType: 'up', hint: '' },
    { key: 'c_stay_duration', name: '人均停留时长', value: '8.2分钟', trend: '↑ 1.5%', trendType: 'up', hint: '' },
    { key: 'c_open_rate', name: '内容打开率', value: '68.2%', trend: '↑ 3.1%', trendType: 'up', hint: '' },
    { key: 'c_signin_rate', name: '签到率', value: '42.5%', trend: '持平', trendType: 'flat', hint: '' },
    { key: 'c_login_streak_days', name: '连续登录天数', value: '7天', trend: '↑ 1天', trendType: 'up', hint: '' },
    { key: 'c_signin_streak_days', name: '连续签到天数', value: '5天', trend: '↑ 1天', trendType: 'up', hint: '' },
    { key: 'c_signin_person_days', name: '签到人天', value: '1,248', trend: '↑ 56', trendType: 'up', hint: '' },
    { key: 'c_policy_rate', name: '保单托管率', value: '34.6%', trend: '↑ 2.8%', trendType: 'up', hint: '' },
  ],
  b: [
    { key: 'b_dau', name: 'B端日活 (DAU)', value: '3,421', trend: '↑ 5.4%', trendType: 'up', hint: '' },
    { key: 'b_interaction_rate', name: '客户互动率', value: '68.2%', trend: '↑ 2.1%', trendType: 'up', hint: '' },
    { key: 'b_remind_click_rate', name: '智能提醒点击率', value: '42.5%', trend: '↓ 0.8%', trendType: 'down', hint: '' },
    { key: 'b_retention_7d', name: '7日留存率', value: '71.3%', trend: '↑ 1.5%', trendType: 'up', hint: '' },
    { key: 'b_content_publish_cnt', name: '内容发布数', value: '2,845', trend: '↑ 12%', trendType: 'up', hint: '' },
    { key: 'b_writeoff_cnt', name: '核销单数', value: '1,284', trend: '↑ 8.2%', trendType: 'up', hint: '' },
  ],
  p: [
    { key: 'p_tenant_total', name: '租户总数', value: '1,284', trend: '↑ 28', trendType: 'up', hint: '' },
    { key: 'p_tenant_active', name: '活跃租户', value: '956', trend: '活跃率 74.6%', trendType: 'flat', hint: '' },
    { key: 'p_premium_mtd', name: '本月签单总额', value: '¥8,560,000', trend: '↑ 15.2%', trendType: 'up', hint: '' },
    { key: 'p_interaction_avg', name: '人均客户互动数', value: '23.4', trend: '↑ 8.2%', trendType: 'up', hint: '' },
    { key: 'p_team_rank', name: '团队业绩排行', value: 'Top 5', trend: '李晓梅 ¥1,240k', trendType: 'flat', hint: '' },
    { key: 'p_product_pref', name: '险种偏好', value: '重疾险 40%', trend: '医疗险 25%', trendType: 'flat', hint: '' },
  ],
  system: [
    { key: 'sys_alert_today', name: '今日告警', value: '12', trend: '待处理 3', trendType: 'down', hint: '' },
    { key: 'sys_api_uptime', name: 'API可用性', value: '99.98%', trend: '近24小时', trendType: 'up', hint: '' },
    { key: 'sys_api_avg_rt', name: '平均响应时间', value: '145ms', trend: '↓ 12ms', trendType: 'up', hint: '' },
    { key: 'sys_server_load', name: '服务器负载', value: '64.2%', trend: 'CPU 78%', trendType: 'flat', hint: '' },
    { key: 'sys_db_conn', name: '数据库连接数', value: '284', trend: '正常', trendType: 'up', hint: '' },
    { key: 'sys_error_rate', name: '错误率', value: '0.02%', trend: '低于阈值', trendType: 'up', hint: '' },
  ],
};

const METRIC_CARD_DEFINITIONS = {
  c: [
    { key: 'c_dau', name: 'C端日活 (DAU)' },
    { key: 'c_stay_duration', name: '人均停留时长' },
    { key: 'c_open_rate', name: '内容打开率' },
    { key: 'c_signin_rate', name: '签到率' },
    { key: 'c_login_streak_days', name: '连续登录天数' },
    { key: 'c_signin_streak_days', name: '连续签到天数' },
    { key: 'c_signin_person_days', name: '签到人天' },
    { key: 'c_policy_rate', name: '保单托管率' },
  ],
  b: [
    { key: 'b_dau', name: 'B端日活 (DAU)' },
    { key: 'b_interaction_rate', name: '客户互动率' },
    { key: 'b_remind_click_rate', name: '智能提醒点击率' },
    { key: 'b_retention_7d', name: '7日留存率' },
    { key: 'b_content_publish_cnt', name: '内容发布数' },
    { key: 'b_writeoff_cnt', name: '核销单数' },
  ],
  p: [
    { key: 'p_tenant_total', name: '租户总数' },
    { key: 'p_tenant_active', name: '活跃租户' },
    { key: 'p_premium_mtd', name: '本月签单总额' },
    { key: 'p_interaction_avg', name: '人均客户互动数' },
    { key: 'p_team_rank', name: '团队业绩排行' },
    { key: 'p_product_pref', name: '险种偏好' },
  ],
  system: [
    { key: 'sys_alert_today', name: '今日告警' },
    { key: 'sys_api_uptime', name: 'API可用性' },
    { key: 'sys_api_avg_rt', name: '平均响应时间' },
    { key: 'sys_server_load', name: '服务器负载' },
    { key: 'sys_db_conn', name: '数据库连接数' },
    { key: 'sys_error_rate', name: '错误率' },
  ],
};

const METRIC_RULE_SEEDS = {
  c: [
    { name: 'C端日活 (DAU)', formula: '当日有任意行为的客户数', period: '每日', source: '行为表' },
    { name: '人均停留时长', formula: '总停留时长 / 活跃客户数', period: '每日', source: '行为表' },
    { name: '内容打开率', formula: '打开人数 / 推送人数 × 100%', period: '每日', source: '内容推送日志' },
    { name: '签到率', formula: '签到人数 / 活跃客户数 × 100%', period: '每日', source: '签到表' },
    { name: '30天登录次数(C端)', formula: '单客30天登录次数(C端) = count(distinct login_date) where user_id=指定客户 and login_time in 最近30天', period: '每日', source: 'p_sessions' },
    { name: '30天签到次数(C端)', formula: '单客30天签到次数(C端) = count(distinct sign_date) where user_id=指定客户 and sign_date in 最近30天', period: '每日', source: 'c_sign_ins' },
    { name: '30天签到天数(C端)', formula: '单客30天签到天数(C端) = count(distinct sign_date) where user_id=指定客户 and sign_date in 最近30天', period: '近30天', source: 'c_sign_ins' },
    {
      name: '单客日分享次数(C端)',
      formula: '单客日分享次数(C端) = count(*) where event_name = c_share_success and actor_id = 指定客户ID and stat_date = 指定日期',
      period: '每日',
      source: 'p_track_events / p_metric_counter_daily',
    },
    { name: '连续登录天数', formula: '连续登录天数(单客) = 某客户按登录日期去重后，连续自然日登录天数', period: '累计', source: '登录日志' },
    { name: '连续签到天数', formula: '连续签到天数(单客) = 某客户按签到日期去重后，连续自然日签到天数', period: '累计', source: 'c_sign_ins' },
    { name: '签到人天', formula: '签到人天 = count(distinct customer_id, sign_date)', period: '累计', source: 'c_sign_ins' },
    { name: '积分兑换率', formula: '兑换人数 / 有积分余额客户数 × 100%', period: '每日', source: '兑换表' },
    { name: '保单托管率', formula: '托管保单客户数 / 总客户数 × 100%', period: '实时累计', source: '保单表' },
  ],
  b: [
    { name: 'B端日活 (DAU)', formula: '当日登录业务员数', period: '每日', source: '登录日志' },
    { name: '30天登录次数(B端)', formula: '单客30天登录次数(B端) = count(distinct login_date) where event_name like b_login% and actor_id=该客户所属顾问 and event_time in 最近30天', period: '每日', source: 'p_track_events' },
    { name: '客户互动率', formula: '有互动的客户数 / 客户总数 × 100%', period: '每日', source: '行为表' },
    { name: '智能提醒点击率', formula: '点击提醒数 / 推送提醒数 × 100%', period: '每日', source: '提醒日志' },
    {
      name: '单人日分享次数(B端)',
      formula: '单人日分享次数(B端) = count(*) where event_name = b_tools_share_success and actor_id = 指定人员ID and stat_date = 指定日期',
      period: '每日',
      source: 'p_track_events / p_metric_counter_daily',
    },
    { name: '7日留存率', formula: '注册后第7天登录人数 / 注册人数 × 100%', period: '按批次', source: '注册+登录表' },
    { name: '内容发布数', formula: '业务员发布的内容总数', period: '每日', source: '内容表' },
    { name: '核销单数', formula: '当日完成的核销笔数', period: '每日', source: '核销表' },
  ],
  p: [
    { name: '租户总数', formula: '状态为激活的租户数', period: '实时累计', source: 'tenant表' },
    { name: '活跃租户', formula: '近7日有管理员登录的租户数', period: '近7日', source: '登录日志' },
    { name: '本月签单总额', formula: '本月所有保单的首期保费总和', period: '月累计', source: '保单表' },
    { name: '人均客户互动数', formula: '总互动次数 / 活跃业务员数', period: '月累计', source: '行为表' },
    { name: '团队业绩排行', formula: '按团队/个人当月签单金额降序排列', period: '月累计', source: '保单表' },
    { name: '险种偏好', formula: '各险种保单数量占比', period: '实时累计', source: '保单表' },
  ],
  system: [
    { name: '今日告警', formula: '当日系统产生的告警总数', period: '每日', source: '告警系统' },
    { name: 'API可用性', formula: '成功请求数 / 总请求数 × 100%', period: '近24小时', source: '监控系统' },
    { name: '平均响应时间', formula: '所有接口的平均耗时', period: '近1小时', source: '监控系统' },
    { name: '服务器负载', formula: 'CPU/内存平均使用率', period: '实时', source: '监控系统' },
    { name: '数据库连接数', formula: '当前数据库连接数', period: '实时', source: '数据库监控' },
    { name: '错误率', formula: '5xx错误 / 总请求数 × 100%', period: '近1小时', source: '监控系统' },
  ],
};

const EVENT_DEFINITION_SEEDS = [
  { eventId: 1001, eventName: '登录', description: '用户成功登录', collectMethod: 'frontend' },
  { eventId: 1002, eventName: '浏览页面', description: '进入任意页面', collectMethod: 'frontend' },
  { eventId: 1003, eventName: '浏览内容', description: '查看课程/文章详情', collectMethod: 'frontend' },
  { eventId: 1004, eventName: 'C端分享成功', description: 'C端客户分享成功', collectMethod: 'frontend' },
  { eventId: 1005, eventName: '签到', description: '每日签到', collectMethod: 'frontend' },
  { eventId: 1006, eventName: '兑换', description: '积分兑换商品/活动', collectMethod: 'backend' },
  { eventId: 1007, eventName: '学习完成', description: '课程学习进度达100%', collectMethod: 'backend' },
  { eventId: 1008, eventName: '活动参与', description: '成功参与活动', collectMethod: 'backend' },
  { eventId: 1009, eventName: 'B端分享成功', description: 'B端分享成功', collectMethod: 'frontend' },
];

const EVENT_SCHEMA_TEMPLATES = {
  1001: {
    caliber: '用户完成登录并建立有效会话后记1次；自动登录同样记入。',
    properties: {
      login_method: 'wechat|mobile',
      is_auto_login: 'boolean',
    },
  },
  1002: {
    caliber: '页面加载完成后记1次PV；同一页面重复进入重复计数。',
    properties: {
      page_name: 'string',
      from_page: 'string',
    },
  },
  1003: {
    caliber: '进入课程/文章/活动详情页并渲染成功后记1次。',
    properties: {
      content_id: 'number|string',
      content_type: 'course|article|activity',
      content_name: 'string',
    },
  },
  1004: {
    caliber: 'C端客户分享成功(c_share_success)后记1次；取消分享不计入。',
    properties: {
      content_id: 'number|string',
      actor_side: 'c_customer',
      source: 'c-web',
      event_keys: 'c_share_success',
      share_method: 'web_share|clipboard',
      tab: 'home|activities|learning|profile|mall',
      path: 'string',
      tenant_id: 'number',
    },
  },
  1009: {
    caliber: 'B端分享成功(b_tools_share_success)后记1次；取消分享不计入。',
    properties: {
      content_id: 'number|string',
      actor_side: 'b_customer',
      source: 'b-web',
      event_keys: 'b_tools_share_success',
      share_channel: 'wechat_friend|moments|link',
      share_method: 'system|clipboard|manual',
      kind: 'content|activity|product|mall_activity',
      share_path: 'list|detail',
      tenant_id: 'number',
    },
  },
  1005: {
    caliber: '每日签到接口成功后记1次；重复签到不重复计入成功事件。',
    properties: {
      continuous_days: 'int',
      points_earned: 'int',
    },
  },
  1006: {
    caliber: '兑换订单创建并支付成功后记1次。',
    properties: {
      item_id: 'number|string',
      item_type: 'product|activity',
      points_cost: 'int',
    },
  },
  1007: {
    caliber: '学习进度达到100%且发放积分成功后记1次。',
    properties: {
      content_id: 'number|string',
      study_duration_sec: 'int',
      points_earned: 'int',
    },
  },
  1008: {
    caliber: '活动参与成功并确认有效参与后记1次。',
    properties: {
      activity_id: 'number|string',
      activity_type: 'task|competition|invite|sign',
    },
  },
};

const TAG_SEEDS = [
  { tagCode: 'TAG_HNW_001', tagName: '高净值', tagType: 'enum', source: 'rule_engine', description: '近12个月高保费/高资产客户', status: 'active' },
  { tagCode: 'TAG_RENEW_024', tagName: '续保意向', tagType: 'enum', source: 'rule_engine', description: '存在续保高意向行为', status: 'active' },
  { tagCode: 'TAG_LEAD_007', tagName: '新线索', tagType: 'boolean', source: 'import_sync', description: '最近7天新增线索客户', status: 'draft' },
  { tagCode: 'MKT_VALUE_LEVEL', tagName: '客户价值等级', tagType: 'enum', source: 'rule_engine', description: '按保费与续保意向分层高/中/低', status: 'active' },
  { tagCode: 'MKT_ACTIVE_30D', tagName: '近30天活跃度', tagType: 'enum', source: 'rule_engine', description: '按30天签到天数分层高活跃/中活跃/低活跃', status: 'active' },
  { tagCode: 'MKT_CHURN_RISK', tagName: '流失风险', tagType: 'enum', source: 'rule_engine', description: '连续登录与签到偏低客户识别为高风险', status: 'active' },
  { tagCode: 'MKT_PRODUCT_PREF', tagName: '产品偏好', tagType: 'enum', source: 'rule_engine', description: '按保费层级映射险种偏好', status: 'active' },
  { tagCode: 'MKT_REDEEM_POWER', tagName: '兑换能力', tagType: 'enum', source: 'rule_engine', description: '按30天签到/兑换活跃度估算兑换能力', status: 'active' },
  { tagCode: 'MKT_SHARE_WILLING', tagName: '分享意愿', tagType: 'enum', source: 'rule_engine', description: '按近期活跃行为识别高分享意愿人群', status: 'active' },
];

const TAG_RULE_SEEDS = [
  {
    ruleCode: 'RULE_HNW_001',
    ruleName: '高净值识别规则',
    targetTagCode: 'TAG_HNW_001',
    priority: 10,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'premium_12m', cmp: '>=', value: 50000 }] },
    outputExpr: { mode: 'const', value: '高净值' },
  },
  {
    ruleCode: 'RULE_RENEW_024',
    ruleName: '续保意向识别规则',
    targetTagCode: 'TAG_RENEW_024',
    priority: 20,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'renew_intent_score', cmp: '>=', value: 80 }] },
    outputExpr: { mode: 'const', value: '高意向' },
  },
  {
    ruleCode: 'RULE_MKT_VALUE_LEVEL',
    ruleName: '营销-客户价值等级分层',
    targetTagCode: 'MKT_VALUE_LEVEL',
    priority: 30,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'premium_12m', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'renew_intent_score',
      mappings: [
        { cmp: '>=', value: 80, output: '高价值' },
        { cmp: '>=', value: 50, output: '中价值' },
      ],
      defaultValue: '低价值',
    },
  },
  {
    ruleCode: 'RULE_MKT_ACTIVE_30D',
    ruleName: '营销-近30天活跃度分层',
    targetTagCode: 'MKT_ACTIVE_30D',
    priority: 31,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'sign_days_30d', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'sign_days_30d',
      mappings: [
        { cmp: '>=', value: 10, output: '高活跃' },
        { cmp: '>=', value: 3, output: '中活跃' },
      ],
      defaultValue: '低活跃',
    },
  },
  {
    ruleCode: 'RULE_MKT_CHURN_RISK',
    ruleName: '营销-流失风险识别',
    targetTagCode: 'MKT_CHURN_RISK',
    priority: 32,
    status: 'active',
    conditionDsl: {
      op: 'and',
      children: [
        { metric: 'login_days_30d', cmp: '<=', value: 1 },
        { metric: 'sign_days_30d', cmp: '<=', value: 1 },
      ],
    },
    outputExpr: { mode: 'const', value: '高风险' },
  },
  {
    ruleCode: 'RULE_MKT_PRODUCT_PREF',
    ruleName: '营销-产品偏好映射',
    targetTagCode: 'MKT_PRODUCT_PREF',
    priority: 33,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'premium_12m', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'premium_12m',
      mappings: [
        { cmp: '>=', value: 100000, output: '重疾偏好' },
        { cmp: '>=', value: 30000, output: '医疗偏好' },
      ],
      defaultValue: '意外偏好',
    },
  },
  {
    ruleCode: 'RULE_MKT_REDEEM_POWER',
    ruleName: '营销-兑换能力分层',
    targetTagCode: 'MKT_REDEEM_POWER',
    priority: 34,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'sign_count_30d', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'sign_count_30d',
      mappings: [
        { cmp: '>=', value: 12, output: '高兑换能力' },
        { cmp: '>=', value: 5, output: '中兑换能力' },
      ],
      defaultValue: '低兑换能力',
    },
  },
  {
    ruleCode: 'RULE_MKT_SHARE_WILLING',
    ruleName: '营销-分享意愿识别',
    targetTagCode: 'MKT_SHARE_WILLING',
    priority: 35,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'login_days_30d', cmp: '>=', value: 7 }] },
    outputExpr: { mode: 'const', value: '高意愿' },
  },
];

const COMPANY_ADMIN_PAGE_MODULES = [
  { group: '租户管理', pages: [{ pageId: 'tenants', pageName: '租户列表' }, { pageId: 'create-tenant', pageName: '创建租户' }, { pageId: 'employees', pageName: '员工管理' }] },
  { group: '内容与营销', pages: [{ pageId: 'activity', pageName: '活动中心' }, { pageId: 'learning', pageName: '学习资料' }, { pageId: 'shop', pageName: '积分商城' }] },
  { group: '策略引擎', pages: [{ pageId: 'tag-list', pageName: '标签列表' }, { pageId: 'tags', pageName: '标签规则库' }, { pageId: 'event-management', pageName: '事件管理' }, { pageId: 'metric-config', pageName: '指标配置' }, { pageId: 'strategy', pageName: '策略引擎' }] },
  { group: '数据统计', pages: [{ pageId: 'stats', pageName: '业绩看板' }] },
  { group: '平台运维', pages: [{ pageId: 'monitor', pageName: '监控大屏' }, { pageId: 'finance', pageName: '财务对账' }, { pageId: 'permissions', pageName: '权限管理' }] },
];

function allCompanyAdminPageIds() {
  return COMPANY_ADMIN_PAGE_MODULES.flatMap((m) => (Array.isArray(m.pages) ? m.pages.map((p) => String(p.pageId || '')) : [])).filter(Boolean);
}

function ensureCompanyAdminPagePermissions(state, tenantId) {
  if (!Array.isArray(state.companyAdminPagePermissions)) state.companyAdminPagePermissions = [];
  const tid = Number(tenantId || 1);
  const existing = state.companyAdminPagePermissions.filter((row) => Number(row.tenantId || 1) === tid);
  return existing.length > 0;
}

function normalizeMetricEnd(end) {
  const value = String(end || '').trim().toLowerCase();
  if (['c', 'b', 'p', 'system'].includes(value)) return value;
  return 'c';
}

function normalizeTagType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (['enum', 'boolean', 'number', 'date'].includes(value)) return value;
  return 'enum';
}

function normalizeTagStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (['active', 'enabled'].includes(value)) return 'active';
  if (['disabled', 'inactive'].includes(value)) return 'disabled';
  return 'draft';
}

function normalizeTagRuleStatus(status) {
  return normalizeTagStatus(status);
}

function collectCustomerIdsForTagJob(state, tenantId) {
  const ids = new Set();
  (state.signIns || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.redemptions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.pointTransactions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.activityCompletions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.courseCompletions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.trackEvents || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    if (String(row?.actorType || '').toLowerCase() !== 'customer') return;
    const uid = Number(row?.actorId || 0);
    if (uid > 0) ids.add(uid);
  });
  if (!ids.size) ids.add(2);
  return [...ids];
}

function toDayKey(value) {
  const d = asDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inLastDays(dateValue, days, now = new Date()) {
  const d = asDate(dateValue);
  if (!d) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, Number(days || 0) - 1));
  return d >= start && d <= now;
}

function normalizeMetricValue(metric) {
  const key = String(metric || '').trim().toLowerCase();
  if (['login_days_30d', 'c_login_days_30d', 'c_login_day_30d'].includes(key)) return 'c_login_days_30d';
  if (['login_count_30d_c', 'c_login_count_30d', 'c_login_times_30d'].includes(key)) return 'c_login_count_30d';
  if (['login_count_30d_b', 'b_login_count_30d', 'b_login_times_30d'].includes(key)) return 'b_login_count_30d';
  if (['sign_days_30d', 'c_sign_days_30d', 'signin_days_30d', 'sign_in_days_30d'].includes(key)) return 'c_sign_days_30d';
  if (['sign_count_30d', 'sign_times_30d', 'c_sign_count_30d', 'c_sign_times_30d'].includes(key)) return 'c_sign_count_30d';
  return key;
}

function compareCondition(leftRaw, cmpRaw, rightRaw) {
  const cmp = String(cmpRaw || '==').trim();
  const leftNum = Number(leftRaw);
  const rightNum = Number(rightRaw);
  const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);
  const left = bothNumeric ? leftNum : String(leftRaw ?? '').trim();
  const right = bothNumeric ? rightNum : String(rightRaw ?? '').trim();
  if (cmp === '>=' || cmp === 'gte') return left >= right;
  if (cmp === '>' || cmp === 'gt') return left > right;
  if (cmp === '<=' || cmp === 'lte') return left <= right;
  if (cmp === '<' || cmp === 'lt') return left < right;
  if (cmp === '!=' || cmp === '<>' || cmp === 'ne') return left !== right;
  if (cmp === 'in') {
    const values = Array.isArray(rightRaw) ? rightRaw : String(rightRaw ?? '').split(',').map((x) => x.trim());
    return values.includes(String(leftRaw ?? '').trim());
  }
  return left === right;
}

function buildTagJobCustomerMetrics(state, tenantId, customerIds) {
  const now = new Date();
  const ids = new Set((customerIds || []).map((x) => Number(x || 0)).filter((x) => x > 0));
  const users = (state.users || []).filter((row) => Number(row?.tenantId || 1) === Number(tenantId));
  const userMap = new Map(users.map((row) => [Number(row.id), row]));
  const ownerByCustomer = new Map(users.map((row) => [Number(row.id), Number(row.ownerUserId || 0)]));
  const trackEvents = (state.trackEvents || []).filter((row) => Number(row?.tenantId || 1) === Number(tenantId));
  const sessions = (state.sessions || []).filter((row) => ids.has(Number(row?.userId || 0)));
  const signIns = (state.signIns || []).filter(
    (row) => Number(row?.tenantId || 1) === Number(tenantId) && ids.has(Number(row?.userId || 0))
  );
  const policies = (state.policies || []).filter((row) => Number(row?.tenantId || 1) === Number(tenantId));

  const metricsByCustomer = new Map();
  ids.forEach((customerId) => {
    const baseUser = userMap.get(customerId) || {};
    metricsByCustomer.set(customerId, {
      age: Number(baseUser.age || 0),
      gender: String(baseUser.gender || ''),
      annual_income: Number(baseUser.annualIncome || baseUser.annual_income || 0),
      member_level: Number(baseUser.memberLevel || 0),
      premium_12m: 0,
      renew_intent_score: 0,
      c_login_days_30d: 0,
      c_login_count_30d: 0,
      b_login_count_30d: 0,
      c_sign_days_30d: 0,
      c_sign_count_30d: 0,
    });
  });

  const cLoginDaySets = new Map();
  const cSignDaySets = new Map();
  sessions.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    if (!ids.has(customerId)) return;
    const dt = asDate(row?.createdAt);
    if (!inLastDays(dt, 30, now)) return;
    const dayKey = toDayKey(dt);
    if (!dayKey) return;
    if (!cLoginDaySets.has(customerId)) cLoginDaySets.set(customerId, new Set());
    cLoginDaySets.get(customerId).add(dayKey);
    const m = metricsByCustomer.get(customerId);
    if (m) m.c_login_count_30d += 1;
  });
  cLoginDaySets.forEach((set, customerId) => {
    const m = metricsByCustomer.get(customerId);
    if (!m) return;
    m.c_login_days_30d = set.size;
    // 口径调整：30天登录次数按“每天最多1次”统计。
    m.c_login_count_30d = set.size;
  });

  signIns.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    if (!ids.has(customerId)) return;
    const dt = asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt);
    if (!inLastDays(dt, 30, now)) return;
    const dayKey = row?.signDate ? String(row.signDate) : toDayKey(dt);
    if (!dayKey) return;
    if (!cSignDaySets.has(customerId)) cSignDaySets.set(customerId, new Set());
    cSignDaySets.get(customerId).add(dayKey);
  });
  cSignDaySets.forEach((set, customerId) => {
    const m = metricsByCustomer.get(customerId);
    if (!m) return;
    m.c_sign_days_30d = set.size;
    // 口径调整：30天签到次数按“每天最多1次”统计。
    m.c_sign_count_30d = set.size;
  });

  const bLoginDayByCustomer = new Map();
  trackEvents.forEach((row) => {
    const source = String(row?.source || '').toLowerCase();
    const event = String(row?.event || '').toLowerCase();
    if (source !== 'b-web' || !event.includes('login')) return;
    const dt = asDate(row?.createdAt);
    if (!inLastDays(dt, 30, now)) return;
    const dayKey = toDayKey(dt);
    if (!dayKey) return;
    const actorId = Number(row?.actorId || 0);
    if (actorId <= 0) return;
    ids.forEach((customerId) => {
      if (Number(ownerByCustomer.get(customerId) || 0) !== actorId) return;
      if (!bLoginDayByCustomer.has(customerId)) bLoginDayByCustomer.set(customerId, new Set());
      bLoginDayByCustomer.get(customerId).add(dayKey);
    });
  });
  bLoginDayByCustomer.forEach((set, customerId) => {
    const m = metricsByCustomer.get(customerId);
    if (m) m.b_login_count_30d = set.size;
  });

  policies.forEach((row) => {
    const customerId = Number(row?.customerId || row?.userId || 0);
    if (!ids.has(customerId)) return;
    const createdAt = asDate(row?.createdAt);
    if (!inLastDays(createdAt, 365, now)) return;
    const amount = Number(row?.annualPremium || row?.amount || 0);
    const m = metricsByCustomer.get(customerId);
    if (m) m.premium_12m += Number.isFinite(amount) ? amount : 0;
  });

  metricsByCustomer.forEach((m) => {
    const activityBase = Number(m.c_login_days_30d || 0) * 3 + Number(m.c_sign_days_30d || 0) * 5 + Number(m.b_login_count_30d || 0) * 2;
    const premiumBase = Math.min(60, Math.floor(Number(m.premium_12m || 0) / 1000));
    m.renew_intent_score = Math.min(100, activityBase + premiumBase);
    m.login_days_30d = Number(m.c_login_days_30d || 0);
    m.sign_days_30d = Number(m.c_sign_days_30d || 0);
    m.sign_count_30d = Number(m.c_sign_count_30d || 0);
  });

  return metricsByCustomer;
}

function evaluateTagRuleByCustomer(rule, customerMetrics) {
  const conditionDsl = rule?.conditionDsl && typeof rule.conditionDsl === 'object' ? rule.conditionDsl : {};
  const op = String(conditionDsl?.op || 'and').toLowerCase() === 'or' ? 'or' : 'and';
  const children = Array.isArray(conditionDsl?.children) ? conditionDsl.children : [];
  if (!children.length) return { hit: true, reason: 'empty condition' };
  const checks = children.map((cond) => {
    const metricKey = normalizeMetricValue(cond?.metric);
    const metricVal = customerMetrics?.[metricKey];
    const cmp = String(cond?.cmp || '==');
    const expected = cond?.value;
    const passed = compareCondition(metricVal, cmp, expected);
    return { metricKey, metricVal, cmp, expected, passed };
  });
  const hit = op === 'or' ? checks.some((x) => x.passed) : checks.every((x) => x.passed);
  const firstFail = checks.find((x) => !x.passed);
  const firstPass = checks.find((x) => x.passed);
  const picked = hit ? firstPass : firstFail || checks[0];
  return {
    hit,
    reason: picked
      ? `${picked.metricKey} ${picked.cmp} ${picked.expected} (actual=${picked.metricVal ?? 'null'})`
      : 'no condition',
  };
}

function resolveTagRuleOutputValue(rule, customerMetrics) {
  const outputExpr = rule?.outputExpr && typeof rule.outputExpr === 'object' ? rule.outputExpr : {};
  const mode = String(outputExpr?.mode || 'const').trim().toLowerCase();
  if (mode !== 'map') {
    return String(outputExpr?.value ?? '');
  }
  const sourceMetric = normalizeMetricValue(outputExpr?.sourceMetric || outputExpr?.source || outputExpr?.metric);
  const sourceValue = customerMetrics?.[sourceMetric];
  const mappings = Array.isArray(outputExpr?.mappings) ? outputExpr.mappings : [];
  for (const row of mappings) {
    const cmp = String(row?.cmp || '=').trim();
    const expected = row?.value;
    if (compareCondition(sourceValue, cmp, expected)) {
      return String(row?.output ?? row?.label ?? '');
    }
  }
  return String(outputExpr?.defaultValue ?? '');
}

function normalizeMetricRuleStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (['enabled', 'active', '生效中', 'on'].includes(value)) return 'enabled';
  if (['disabled', 'inactive', '已禁用', 'off'].includes(value)) return 'disabled';
  return 'enabled';
}

function normalizeMetricRemarkMode(mode) {
  const value = String(mode || '').trim().toLowerCase();
  if (['manual', 'custom'].includes(value)) return 'manual';
  return 'sync';
}

function inferMetricTablesBySource(source) {
  const s = String(source || '').toLowerCase();
  const tableMap = [
    { keys: ['登录', 'login'], tables: ['p_sessions', 'p_track_events'] },
    { keys: ['签到', 'sign'], tables: ['c_sign_ins'] },
    { keys: ['兑换', 'redeem', '核销', 'writeoff'], tables: ['c_redeem_records', 'b_write_off_records'] },
    { keys: ['保单', 'policy'], tables: ['c_policies'] },
    { keys: ['活动', 'activity'], tables: ['p_activities', 'b_customer_activities', 'c_activity_completions'] },
    { keys: ['学习', 'learning', '内容'], tables: ['p_learning_materials', 'c_learning_records'] },
    { keys: ['行为', '埋点', 'track', 'event'], tables: ['p_track_events'] },
    { keys: ['积分', 'point'], tables: ['c_point_transactions', 'point_accounts'] },
    { keys: ['租户', 'tenant'], tables: ['p_tenants'] },
    { keys: ['告警', '监控', 'audit'], tables: ['audit_logs', 'p_track_events'] },
  ];
  for (const item of tableMap) {
    if (item.keys.some((k) => s.includes(String(k).toLowerCase()))) return item.tables;
  }
  return ['p_track_events'];
}

function buildMetricRuleRemark({ name, formula, period, source }) {
  const tables = inferMetricTablesBySource(source || '');
  return `数据表: ${tables.join(' + ')}
时间窗口: ${period || '每日'}
计算方式: ${formula || '请填写公式'}
口径补充: 指标名=${name || '-'}；来源=${source || '-'}`;
}

function metricRuleKey(end, name) {
  return `${normalizeMetricEnd(end)}::${String(name || '').trim().toLowerCase()}`;
}

function normalizeEventType(type) {
  const value = String(type || '').trim().toLowerCase();
  return value === 'system' ? 'system' : 'custom';
}

function normalizeCollectMethod(method) {
  const value = String(method || '').trim().toLowerCase();
  if (value === 'backend' || value === 'both') return value;
  return 'frontend';
}

function normalizeEventStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (['0', 'disabled', 'off'].includes(value)) return 'disabled';
  if (['2', 'draft'].includes(value)) return 'draft';
  return 'enabled';
}

function toEventStatusCode(status) {
  const value = normalizeEventStatus(status);
  if (value === 'disabled') return 0;
  if (value === 'draft') return 2;
  return 1;
}

function eventSchemaTemplateById(eventId) {
  const id = Number(eventId || 0);
  const template = EVENT_SCHEMA_TEMPLATES[id];
  if (!template) return null;
  return JSON.parse(JSON.stringify(template));
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rowDate(row, keys = ['createdAt', 'updatedAt']) {
  for (const key of keys) {
    const d = asDate(row?.[key]);
    if (d) return d;
  }
  return null;
}

function formatInteger(num) {
  return Math.max(0, Math.round(parseNumber(num, 0))).toLocaleString('zh-CN');
}

function formatPercent(num) {
  return `${Math.max(0, parseNumber(num, 0)).toFixed(1)}%`;
}

function formatMinutes(num) {
  return `${Math.max(0, parseNumber(num, 0)).toFixed(1)}分钟`;
}

function formatDays(num) {
  return `${Math.max(0, parseNumber(num, 0)).toFixed(1)}天`;
}

function formatCurrency(num) {
  return `¥${Math.max(0, Math.round(parseNumber(num, 0))).toLocaleString('zh-CN')}`;
}

function trendByDelta(current, previous, reverse = false) {
  const cur = parseNumber(current, 0);
  const prev = parseNumber(previous, 0);
  if (prev <= 0 && cur <= 0) return { trend: '持平', trendType: 'flat' };
  if (prev <= 0 && cur > 0) return { trend: '↑ 新增', trendType: reverse ? 'down' : 'up' };
  const delta = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(delta) < 0.1) return { trend: '持平', trendType: 'flat' };
  const up = delta > 0;
  const trendType = reverse ? (up ? 'down' : 'up') : up ? 'up' : 'down';
  return {
    trend: `${up ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%`,
    trendType,
  };
}

function resolveMetricScope(state, actor) {
  const safeActor = {
    actorType: String(actor?.actorType || 'employee'),
    actorId: Number(actor?.actorId || 0),
    tenantId: Number(actor?.tenantId || 1),
    teamId: Number(actor?.teamId || 1),
  };

  const roleIds = (state.userRoles || [])
    .filter(
      (row) =>
        Number(row.tenantId) === Number(safeActor.tenantId) &&
        String(row.userType) === String(safeActor.actorType) &&
        Number(row.userId) === Number(safeActor.actorId)
    )
    .map((row) => Number(row.roleId));

  const roleKeys = new Set(
    (state.roles || [])
      .filter((row) => roleIds.includes(Number(row.id)))
      .map((row) => String(row.key || '').toLowerCase())
      .filter(Boolean)
  );

  const permissionIds = (state.rolePermissions || [])
    .filter((row) => roleIds.includes(Number(row.roleId)))
    .map((row) => Number(row.permissionId));
  const permissionKeys = new Set(
    (state.permissions || [])
      .filter((row) => permissionIds.includes(Number(row.id)))
      .map((row) => String(row.key || '').toLowerCase())
      .filter(Boolean)
  );

  const actorAgentRow = (state.agents || []).find(
    (row) => Number(row.id) === Number(safeActor.actorId) && Number(row.tenantId || 1) === Number(safeActor.tenantId)
  );
  const isManagerEmployee = String(actorAgentRow?.role || '').toLowerCase() === 'manager';
  const isPlatformAdmin = roleKeys.has('platform_admin');
  const isCompanyAdmin = roleKeys.has('company_admin') || permissionKeys.has('scope:tenant:all');
  const isTeamLead = !isCompanyAdmin && (roleKeys.has('team_lead') || permissionKeys.has('scope:team:all'));
  const isAgent = roleKeys.has('agent') || safeActor.actorType === 'agent';

  let scopeType = 'company';
  if (isPlatformAdmin) scopeType = 'platform';
  else if (isCompanyAdmin) scopeType = 'company';
  else if (isManagerEmployee || isTeamLead) scopeType = 'manager';
  else if (isAgent) scopeType = 'agent';

  const scopeTeamId = Number(actorAgentRow?.teamId || safeActor.teamId || 1);
  const agentsAll = Array.isArray(state.agents) ? state.agents : [];
  const usersAll = Array.isArray(state.users) ? state.users : [];

  const canSeeTenant = (tenantId) => {
    const tid = Number(tenantId || 1);
    if (scopeType === 'platform') return true;
    return tid === Number(safeActor.tenantId);
  };

  const visibleAgents = agentsAll.filter((row) => {
    if (!canSeeTenant(row.tenantId)) return false;
    if (scopeType === 'platform' || scopeType === 'company') return true;
    if (scopeType === 'manager') return Number(row.teamId || 1) === Number(scopeTeamId);
    return Number(row.id) === Number(safeActor.actorId);
  });

  const agentIds = new Set(visibleAgents.map((row) => Number(row.id)).filter((id) => id > 0));
  if (scopeType === 'manager' || scopeType === 'agent') {
    agentIds.add(Number(safeActor.actorId));
  }

  const visibleUsers = usersAll.filter((row) => {
    if (!canSeeTenant(row.tenantId)) return false;
    if (scopeType === 'platform' || scopeType === 'company') return true;
    if (scopeType === 'manager') {
      const ownerId = Number(row.ownerUserId || 0);
      const teamId = Number(row.teamId || 1);
      return agentIds.has(ownerId) || teamId === Number(scopeTeamId);
    }
    return Number(row.ownerUserId || 0) === Number(safeActor.actorId);
  });
  const customerIds = new Set(visibleUsers.map((row) => Number(row.id)).filter((id) => id > 0));

  return {
    ...safeActor,
    scopeType,
    scopeTeamId,
    canSeeTenant,
    agentIds,
    customerIds,
  };
}

function computeMetricCards(state, actor) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const prevDayStart = new Date(dayStart);
  prevDayStart.setDate(prevDayStart.getDate() - 1);
  const weekAgo = new Date(dayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const prevWeekStart = new Date(dayStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 14);
  const monthStart = new Date(dayStart);
  monthStart.setDate(1);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

  const scope = resolveMetricScope(state, actor);
  const usersAll = Array.isArray(state.users) ? state.users : [];
  const users = usersAll.filter((row) => scope.customerIds.has(Number(row.id)));
  const signIns = (Array.isArray(state.signIns) ? state.signIns : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const activityCompletions = (Array.isArray(state.activityCompletions) ? state.activityCompletions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const courseCompletions = (Array.isArray(state.courseCompletions) ? state.courseCompletions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const pointTx = (Array.isArray(state.pointTransactions) ? state.pointTransactions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const redemptions = (Array.isArray(state.redemptions) ? state.redemptions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const policies = (Array.isArray(state.policies) ? state.policies : []).filter((row) => {
    const customerId = parseNumber(row?.customerId ?? row?.userId ?? 0, 0);
    if (customerId > 0) return scope.customerIds.has(customerId);
    const createdBy = parseNumber(row?.createdBy, 0);
    return scope.scopeType === 'platform' || scope.agentIds.has(createdBy);
  });
  const trackEvents = (Array.isArray(state.trackEvents) ? state.trackEvents : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const bCustomerActivities = (Array.isArray(state.bCustomerActivities) ? state.bCustomerActivities : []).filter((row) => {
    const customerId = parseNumber(row?.customerId, 0);
    const agentId = parseNumber(row?.agentId, 0);
    const customerOk = customerId ? scope.customerIds.has(customerId) : true;
    const agentOk =
      scope.scopeType === 'platform' ||
      scope.scopeType === 'company' ||
      scope.agentIds.has(agentId) ||
      agentId === Number(scope.actorId);
    return customerOk && agentOk;
  });
  const agents = (Array.isArray(state.agents) ? state.agents : []).filter((row) => {
    if (scope.scopeType === 'platform') return true;
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'company') return true;
    if (scope.scopeType === 'manager') return scope.agentIds.has(Number(row.id)) || Number(row.teamId || 1) === Number(scope.scopeTeamId);
    return Number(row.id) === Number(scope.actorId);
  });
  const pLearningMaterials = (Array.isArray(state.pLearningMaterials) ? state.pLearningMaterials : []).filter((row) => {
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
    const createdBy = parseNumber(row?.createdBy, 0);
    return scope.agentIds.has(createdBy) || createdBy === Number(scope.actorId);
  });
  const pActivities = (Array.isArray(state.pActivities) ? state.pActivities : []).filter((row) => {
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
    const createdBy = parseNumber(row?.createdBy, 0);
    return scope.agentIds.has(createdBy) || createdBy === Number(scope.actorId);
  });
  const bWriteOffRecords = (Array.isArray(state.bWriteOffRecords) ? state.bWriteOffRecords : []).filter((row) => {
    const agentId = parseNumber(row?.operatorAgentId, 0);
    if (scope.scopeType === 'platform') return true;
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'company') return true;
    return scope.agentIds.has(agentId) || agentId === Number(scope.actorId);
  });
  const auditLogs = (Array.isArray(state.auditLogs) ? state.auditLogs : []).filter((row) => {
    if (scope.scopeType === 'platform') return true;
    return scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId));
  });
  const tenants = (Array.isArray(state.tenants) ? state.tenants : []).filter((row) => scope.canSeeTenant(row.tenantId || row.id));
  const sessions = (Array.isArray(state.sessions) ? state.sessions : []).filter((row) => {
    if (scope.scopeType === 'platform') return true;
    const tenantFromSession = parseNumber(row?.tenantId, scope.tenantId);
    return scope.canSeeTenant(tenantFromSession);
  });

  const inRange = (d, start, end) => Boolean(d && d >= start && d < end);
  const toMetricDayKey = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const toMetricHourKey = (d) => `${toMetricDayKey(d)}T${String(d.getHours()).padStart(2, '0')}`;
  const isCustomerEvent = (row) =>
    String(row?.actorType || '').toLowerCase() === 'customer' || String(row?.source || '').toLowerCase() === 'c-web';
  const isBEvent = (row) => {
    const source = String(row?.source || '').toLowerCase();
    const event = String(row?.event || '').toLowerCase();
    return source === 'b-web' || event.startsWith('b_');
  };
  const bEventActorInScope = (actorId) => {
    const aid = parseNumber(actorId, 0);
    if (!aid) return false;
    if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
    if (scope.scopeType === 'manager') return scope.agentIds.has(aid) || aid === Number(scope.actorId);
    return aid === Number(scope.actorId);
  };
  const metricDailyUv = (Array.isArray(state.metricDailyUv) ? state.metricDailyUv : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const metricDailyCounters = (Array.isArray(state.metricDailyCounters) ? state.metricDailyCounters : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const metricHourlyCounters = (Array.isArray(state.metricHourlyCounters) ? state.metricHourlyCounters : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const hasMetricAgg = metricDailyUv.length > 0 || metricDailyCounters.length > 0 || metricHourlyCounters.length > 0;
  const hasUvKey = (metricKey) => metricDailyUv.some((row) => String(row.metricKey || '') === metricKey);
  const hasDailyCounterKey = (metricKey) => metricDailyCounters.some((row) => String(row.metricKey || '') === metricKey);
  const hasHourlyCounterKey = (metricKey) => metricHourlyCounters.some((row) => String(row.metricKey || '') === metricKey);
  const dailyUvCount = (metricKey, dayKey, actorFilter) =>
    new Set(
      metricDailyUv
        .filter((row) => String(row.metricKey || '') === metricKey && String(row.statDate || '') === dayKey)
        .map((row) => parseNumber(row.actorId, 0))
        .filter((id) => id > 0 && (!actorFilter || actorFilter(id)))
    ).size;
  const dailyCounterSum = (metricKey, dayKey, actorFilter) =>
    metricDailyCounters
      .filter(
        (row) =>
          String(row.metricKey || '') === metricKey &&
          String(row.statDate || '') === dayKey &&
          (!actorFilter || actorFilter(parseNumber(row.actorId, 0)))
      )
      .reduce((sum, row) => sum + parseNumber(row.cnt, 0), 0);
  const hourlyCounterSum = (metricKey, start, end, actorFilter) =>
    metricHourlyCounters
      .filter((row) => {
        if (String(row.metricKey || '') !== metricKey) return false;
        if (actorFilter && !actorFilter(parseNumber(row.actorId, 0))) return false;
        const hk = String(row.hourKey || '');
        const hourTime = new Date(`${hk}:00:00`);
        return Boolean(hourTime && !Number.isNaN(hourTime.getTime()) && hourTime >= start && hourTime <= end);
      })
      .reduce((sum, row) => sum + parseNumber(row.cnt, 0), 0);

  const activeCustomerIdsToday = new Set();
  const activeCustomerIdsPrev = new Set();

  signIns.forEach((row) => {
    const date = asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  activityCompletions.forEach((row) => {
    const date = rowDate(row, ['completedAt', 'createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  courseCompletions.forEach((row) => {
    const date = rowDate(row, ['completedAt', 'createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  pointTx.forEach((row) => {
    const date = rowDate(row, ['createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  redemptions.forEach((row) => {
    const date = rowDate(row, ['createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  trackEvents.forEach((row) => {
    const date = rowDate(row, ['createdAt']);
    const uid = parseNumber(row?.actorId, 0);
    if (!uid || !isCustomerEvent(row) || !scope.customerIds.has(uid)) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  let cDau = activeCustomerIdsToday.size;
  let cDauPrev = activeCustomerIdsPrev.size;
  if (hasMetricAgg && hasUvKey('c_dau')) {
    cDau = dailyUvCount('c_dau', toMetricDayKey(dayStart), (id) => scope.customerIds.has(id));
    cDauPrev = dailyUvCount('c_dau', toMetricDayKey(prevDayStart), (id) => scope.customerIds.has(id));
  }

  const stayDuration = (start, end) => {
    let totalSeconds = 0;
    const usersSet = new Set();
    trackEvents.forEach((row) => {
      const date = rowDate(row, ['createdAt']);
      if (!inRange(date, start, end) || !isCustomerEvent(row)) return;
      const uid = parseNumber(row?.actorId, 0);
      if (!uid || !scope.customerIds.has(uid)) return;
      const props = row?.properties || {};
      const ms = parseNumber(props.durationMs ?? props.latencyMs ?? props.costMs, 0);
      const sec = parseNumber(props.durationSeconds ?? props.staySeconds ?? props.duration, 0);
      const durationSeconds = sec > 0 ? sec : ms > 0 ? ms / 1000 : 0;
      if (durationSeconds > 0) {
        totalSeconds += durationSeconds;
        usersSet.add(uid);
      }
    });
    const avgMin = usersSet.size > 0 ? totalSeconds / usersSet.size / 60 : 0;
    return avgMin;
  };

  const cStay = stayDuration(dayStart, dayEnd);
  const cStayPrev = stayDuration(prevDayStart, dayStart);

  const openRate = (start, end) => {
    const openUsers = new Set();
    const exposureUsers = new Set();
    trackEvents.forEach((row) => {
      const date = rowDate(row, ['createdAt']);
      if (!inRange(date, start, end) || !isCustomerEvent(row)) return;
      const uid = parseNumber(row?.actorId, 0);
      if (!uid || !scope.customerIds.has(uid)) return;
      const event = String(row?.event || '').toLowerCase();
      if (/open|view|detail|click/.test(event)) openUsers.add(uid);
      if (/push|send|exposure|impression|reach/.test(event)) exposureUsers.add(uid);
    });
    if (exposureUsers.size === 0) return 0;
    return (openUsers.size / exposureUsers.size) * 100;
  };

  const cOpenRate = openRate(dayStart, dayEnd);
  const cOpenPrev = openRate(prevDayStart, dayStart);

  const signInUsersToday = new Set(
    signIns
      .filter((row) => inRange(asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt), dayStart, dayEnd))
      .map((row) => parseNumber(row?.userId, 0))
      .filter((x) => x > 0)
  ).size;
  const signInUsersPrev = new Set(
    signIns
      .filter((row) => inRange(asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt), prevDayStart, dayStart))
      .map((row) => parseNumber(row?.userId, 0))
      .filter((x) => x > 0)
  ).size;
  const cSigninRate = cDau > 0 ? (signInUsersToday / cDau) * 100 : 0;
  const cSigninPrev = cDauPrev > 0 ? (signInUsersPrev / cDauPrev) * 100 : 0;

  const toLocalDayKey = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const parseDayKey = (dayKey) => {
    const parts = String(dayKey || '').split('-').map((x) => Number(x));
    if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x) || x <= 0)) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  };
  const streakAsOfDay = (daySet, asOfKey) => {
    if (!(daySet instanceof Set) || daySet.size === 0) return 0;
    const asOfDate = parseDayKey(asOfKey);
    if (!asOfDate) return 0;
    const days = [...daySet]
      .map((dayKey) => ({ key: String(dayKey), d: parseDayKey(dayKey) }))
      .filter((x) => x.d && x.d <= asOfDate)
      .sort((a, b) => a.d - b.d);
    if (days.length === 0) return 0;
    let streak = 1;
    for (let i = days.length - 1; i > 0; i -= 1) {
      const delta = (days[i].d - days[i - 1].d) / (24 * 60 * 60 * 1000);
      if (delta === 1) streak += 1;
      else break;
    }
    return streak;
  };
  const pickMetricCustomerId = (scopeInfo, loginMap, signinMap) => {
    const actorId = parseNumber(scopeInfo?.actorId, 0);
    if (String(scopeInfo?.actorType || '').toLowerCase() === 'customer' && scopeInfo?.customerIds?.has(actorId)) return actorId;
    const merged = new Map();
    const mergeMap = (m) => {
      m.forEach((days, uid) => {
        if (!scopeInfo.customerIds.has(uid)) return;
        const daySet = days instanceof Set ? days : new Set();
        const prev = merged.get(uid) || { size: 0, latest: '' };
        const latest = [...daySet].sort().pop() || prev.latest;
        merged.set(uid, { size: prev.size + daySet.size, latest: latest > prev.latest ? latest : prev.latest });
      });
    };
    mergeMap(loginMap);
    mergeMap(signinMap);
    const winner = [...merged.entries()].sort((a, b) => {
      if (b[1].size !== a[1].size) return b[1].size - a[1].size;
      if (b[1].latest !== a[1].latest) return b[1].latest.localeCompare(a[1].latest);
      return a[0] - b[0];
    })[0];
    return winner ? winner[0] : 0;
  };
  const todayDayKey = toLocalDayKey(dayStart);
  const prevDayKey = toLocalDayKey(prevDayStart);
  const allLoginUserDays = new Set();
  const prevLoginUserDays = new Set();
  const loginDaysByUser = new Map();
  sessions.forEach((row) => {
    const uid = parseNumber(row?.userId, 0);
    const dt = rowDate(row, ['createdAt']);
    if (!uid || !dt || !scope.customerIds.has(uid)) return;
    const dayKey = toLocalDayKey(dt);
    if (!dayKey) return;
    if (!loginDaysByUser.has(uid)) loginDaysByUser.set(uid, new Set());
    loginDaysByUser.get(uid).add(dayKey);
    if (dt < dayEnd) {
      allLoginUserDays.add(`${uid}:${dayKey}`);
    }
    if (dt < dayStart) {
      prevLoginUserDays.add(`${uid}:${dayKey}`);
    }
  });

  const allSigninUserDays = new Set();
  const prevSigninUserDays = new Set();
  const signinDaysByUser = new Map();
  signIns.forEach((row) => {
    const uid = parseNumber(row?.userId, 0);
    if (!uid || !scope.customerIds.has(uid)) return;
    const rawSignDate = String(row?.signDate || '').trim();
    const dt = rawSignDate ? asDate(`${rawSignDate}T00:00:00`) : rowDate(row, ['createdAt']);
    if (!dt) return;
    const dayKey = rawSignDate || toLocalDayKey(dt);
    if (!dayKey) return;
    if (!signinDaysByUser.has(uid)) signinDaysByUser.set(uid, new Set());
    signinDaysByUser.get(uid).add(dayKey);
    if (dt < dayEnd) {
      allSigninUserDays.add(`${uid}:${dayKey}`);
    }
    if (dt < dayStart) {
      prevSigninUserDays.add(`${uid}:${dayKey}`);
    }
  });
  const cSigninPersonDays = allSigninUserDays.size;
  const cSigninPersonDaysPrev = prevSigninUserDays.size;

  const metricCustomerId = pickMetricCustomerId(scope, loginDaysByUser, signinDaysByUser);
  const loginDaySet = loginDaysByUser.get(metricCustomerId) || new Set();
  const signinDaySet = signinDaysByUser.get(metricCustomerId) || new Set();
  const cLoginStreakDays = streakAsOfDay(loginDaySet, todayDayKey);
  const cLoginStreakDaysPrev = streakAsOfDay(loginDaySet, prevDayKey);
  const cSigninStreakDays = streakAsOfDay(signinDaySet, todayDayKey);
  const cSigninStreakDaysPrev = streakAsOfDay(signinDaySet, prevDayKey);

  const activePolicyCustomers = new Set();
  policies.forEach((row) => {
    const status = String(row?.status || '').toLowerCase();
    const active = status.includes('保障') || status === 'active' || status === 'in_force' || status === 'on';
    if (!active) return;
    const uid = parseNumber(row?.customerId ?? row?.userId ?? row?.createdBy, 0);
    if (uid) activePolicyCustomers.add(uid);
  });
  const totalUsers = users.length;
  const cPolicyRate = totalUsers > 0 ? (activePolicyCustomers.size / totalUsers) * 100 : 0;

  const bDauUsers = new Set(
    trackEvents
      .filter(
        (row) =>
          isBEvent(row) &&
          bEventActorInScope(row?.actorId) &&
          inRange(rowDate(row, ['createdAt']), dayStart, dayEnd)
      )
      .map((row) => parseNumber(row?.actorId, 0))
      .filter((x) => x > 0)
  );
  const bDauUsersPrev = new Set(
    trackEvents
      .filter(
        (row) =>
          isBEvent(row) &&
          bEventActorInScope(row?.actorId) &&
          inRange(rowDate(row, ['createdAt']), prevDayStart, dayStart)
      )
      .map((row) => parseNumber(row?.actorId, 0))
      .filter((x) => x > 0)
  );
  let bDau = bDauUsers.size;
  let bDauPrev = bDauUsersPrev.size;
  if (hasMetricAgg && hasUvKey('b_dau')) {
    bDau = dailyUvCount('b_dau', toMetricDayKey(dayStart), (id) => bEventActorInScope(id));
    bDauPrev = dailyUvCount('b_dau', toMetricDayKey(prevDayStart), (id) => bEventActorInScope(id));
  }

  const bActiveCustomerToday = new Set(
    bCustomerActivities
      .filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), dayStart, dayEnd))
      .map((row) => parseNumber(row?.customerId, 0))
      .filter((x) => x > 0)
  );
  const bActiveCustomerPrev = new Set(
    bCustomerActivities
      .filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), prevDayStart, dayStart))
      .map((row) => parseNumber(row?.customerId, 0))
      .filter((x) => x > 0)
  );
  let bInteractionRate = totalUsers > 0 ? (bActiveCustomerToday.size / totalUsers) * 100 : 0;
  let bInteractionPrev = totalUsers > 0 ? (bActiveCustomerPrev.size / totalUsers) * 100 : 0;
  if (hasMetricAgg && hasUvKey('b_interaction_customer')) {
    const bInteractTodayUv = dailyUvCount('b_interaction_customer', toMetricDayKey(dayStart), (id) => scope.customerIds.has(id));
    const bInteractPrevUv = dailyUvCount('b_interaction_customer', toMetricDayKey(prevDayStart), (id) => scope.customerIds.has(id));
    bInteractionRate = totalUsers > 0 ? (bInteractTodayUv / totalUsers) * 100 : 0;
    bInteractionPrev = totalUsers > 0 ? (bInteractPrevUv / totalUsers) * 100 : 0;
  }

  const remindStats = (start, end) => {
    let click = 0;
    let push = 0;
    trackEvents.forEach((row) => {
      if (!isBEvent(row) || !bEventActorInScope(row?.actorId) || !inRange(rowDate(row, ['createdAt']), start, end)) return;
      const event = String(row?.event || '').toLowerCase();
      if (!event.includes('remind')) return;
      if (event.includes('click')) click += 1;
      if (event.includes('push') || event.includes('send') || event.includes('show')) push += 1;
    });
    return push > 0 ? (click / push) * 100 : 0;
  };

  let bRemindRate = remindStats(dayStart, dayEnd);
  let bRemindPrev = remindStats(prevDayStart, dayStart);
  if (hasMetricAgg && (hasDailyCounterKey('b_remind_push') || hasDailyCounterKey('b_remind_click'))) {
    const actorFilter = (id) => bEventActorInScope(id);
    const pushToday = dailyCounterSum('b_remind_push', toMetricDayKey(dayStart), actorFilter);
    const clickToday = dailyCounterSum('b_remind_click', toMetricDayKey(dayStart), actorFilter);
    const pushPrev = dailyCounterSum('b_remind_push', toMetricDayKey(prevDayStart), actorFilter);
    const clickPrev = dailyCounterSum('b_remind_click', toMetricDayKey(prevDayStart), actorFilter);
    bRemindRate = pushToday > 0 ? (clickToday / pushToday) * 100 : 0;
    bRemindPrev = pushPrev > 0 ? (clickPrev / pushPrev) * 100 : 0;
  }

  const retentionWindowStart = new Date(dayStart);
  retentionWindowStart.setDate(retentionWindowStart.getDate() - 7);
  const retentionWindowEnd = new Date(retentionWindowStart);
  retentionWindowEnd.setDate(retentionWindowEnd.getDate() + 1);
  const cohortAgentIds = new Set(
    agents
      .filter((row) => inRange(rowDate(row, ['createdAt']), retentionWindowStart, retentionWindowEnd))
      .map((row) => parseNumber(row?.id, 0))
      .filter((x) => x > 0)
  );
  const retainedAgentIds = new Set(
    trackEvents
      .filter(
        (row) =>
          isBEvent(row) &&
          bEventActorInScope(row?.actorId) &&
          inRange(rowDate(row, ['createdAt']), dayStart, dayEnd)
      )
      .map((row) => parseNumber(row?.actorId, 0))
      .filter((x) => x > 0 && cohortAgentIds.has(x))
  );
  const bRetention7d = cohortAgentIds.size > 0 ? (retainedAgentIds.size / cohortAgentIds.size) * 100 : 0;

  const createdTodayCount = (rows) =>
    rows.filter((row) => inRange(rowDate(row, ['createdAt', 'updatedAt']), dayStart, dayEnd)).length;
  const createdPrevCount = (rows) =>
    rows.filter((row) => inRange(rowDate(row, ['createdAt', 'updatedAt']), prevDayStart, dayStart)).length;

  const bContentPublishCnt = createdTodayCount([...pLearningMaterials, ...pActivities]);
  const bContentPublishPrev = createdPrevCount([...pLearningMaterials, ...pActivities]);

  const bWriteoffCnt = bWriteOffRecords.filter(
    (row) => inRange(rowDate(row, ['createdAt']), dayStart, dayEnd) && String(row?.status || '').toLowerCase() === 'success'
  ).length;
  const bWriteoffPrev = bWriteOffRecords.filter(
    (row) => inRange(rowDate(row, ['createdAt']), prevDayStart, dayStart) && String(row?.status || '').toLowerCase() === 'success'
  ).length;

  const pTenantTotal = tenants.filter((row) => String(row?.status || 'active').toLowerCase() !== 'inactive').length;
  const activeTenantIds7d = new Set(
    trackEvents
      .filter((row) => inRange(rowDate(row, ['createdAt']), weekAgo, dayEnd) && scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId)))
      .map((row) => parseNumber(row?.tenantId, 0))
      .filter((x) => x > 0)
  );
  const activeTenantIdsPrev7d = new Set(
    trackEvents
      .filter((row) => inRange(rowDate(row, ['createdAt']), prevWeekStart, weekAgo) && scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId)))
      .map((row) => parseNumber(row?.tenantId, 0))
      .filter((x) => x > 0)
  );
  const pTenantActive = activeTenantIds7d.size;
  const pTenantActivePrev = activeTenantIdsPrev7d.size;

  const policyValue = (row) => {
    const annual = parseNumber(row?.annualPremium, NaN);
    if (Number.isFinite(annual) && annual > 0) return annual;
    return parseNumber(row?.amount, 0);
  };
  const pPremiumMtd = policies
    .filter((row) => inRange(rowDate(row, ['createdAt']), monthStart, dayEnd))
    .reduce((sum, row) => sum + policyValue(row), 0);
  const pPremiumPrevMonth = policies
    .filter((row) => inRange(rowDate(row, ['createdAt']), prevMonthStart, monthStart))
    .reduce((sum, row) => sum + policyValue(row), 0);

  const monthInteractions = bCustomerActivities.filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), monthStart, dayEnd));
  const activeAgentsThisMonth = new Set(monthInteractions.map((row) => parseNumber(row?.agentId, 0)).filter((x) => x > 0));
  const pInteractionAvg = activeAgentsThisMonth.size > 0 ? monthInteractions.length / activeAgentsThisMonth.size : 0;

  const prevMonthInteractions = bCustomerActivities.filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), prevMonthStart, monthStart));
  const activeAgentsPrevMonth = new Set(prevMonthInteractions.map((row) => parseNumber(row?.agentId, 0)).filter((x) => x > 0));
  const pInteractionAvgPrev = activeAgentsPrevMonth.size > 0 ? prevMonthInteractions.length / activeAgentsPrevMonth.size : 0;

  const usersById = new Map(users.map((row) => [parseNumber(row?.id, 0), row]));
  const agentsById = new Map(agents.map((row) => [parseNumber(row?.id, 0), row]));
  const teamAmount = new Map();
  policies
    .filter((row) => inRange(rowDate(row, ['createdAt']), monthStart, dayEnd))
    .forEach((row) => {
      const customerId = parseNumber(row?.customerId ?? row?.userId ?? row?.createdBy, 0);
      const ownerId = parseNumber(usersById.get(customerId)?.ownerUserId, 0);
      const teamId = parseNumber(agentsById.get(ownerId)?.teamId, 0);
      if (!teamId) return;
      teamAmount.set(teamId, parseNumber(teamAmount.get(teamId), 0) + policyValue(row));
    });
  const topTeam = [...teamAmount.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  const typeCount = new Map();
  policies.forEach((row) => {
    const t = String(row?.type || '其他').trim() || '其他';
    typeCount.set(t, parseNumber(typeCount.get(t), 0) + 1);
  });
  const totalPolicyType = [...typeCount.values()].reduce((sum, v) => sum + parseNumber(v, 0), 0);
  const topType = [...typeCount.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const topTypeRate = topType && totalPolicyType > 0 ? (topType[1] / totalPolicyType) * 100 : 0;

  let failToday = auditLogs.filter(
    (row) => inRange(rowDate(row, ['createdAt']), dayStart, dayEnd) && String(row?.result || '').toLowerCase() === 'fail'
  ).length;
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const audit24h = auditLogs.filter((row) => {
    const d = rowDate(row, ['createdAt']);
    const tenantOk = scope.scopeType === 'platform' || scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId));
    return Boolean(d && d >= twentyFourHoursAgo && d <= now && tenantOk);
  });
  const success24h = audit24h.filter((row) => String(row?.result || '').toLowerCase() === 'success').length;
  let apiUptime = audit24h.length > 0 ? (success24h / audit24h.length) * 100 : 100;

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const durationValues = [];
  trackEvents.forEach((row) => {
    const d = rowDate(row, ['createdAt']);
    if (!d || d < oneHourAgo || d > now) return;
    const props = row?.properties || {};
    const v = parseNumber(props.durationMs ?? props.latencyMs ?? props.costMs, 0);
    if (v > 0) durationValues.push(v);
  });
  const avgRt = durationValues.length > 0 ? durationValues.reduce((s, v) => s + v, 0) / durationValues.length : 0;

  const cpuCount = Math.max(1, os.cpus()?.length || 1);
  const serverLoad = Math.min(100, (parseNumber(os.loadavg?.()[0], 0) / cpuCount) * 100);

  const dbConn = sessions.filter((row) => {
    const exp = rowDate(row, ['expiresAt']);
    return Boolean(exp && exp > now);
  }).length;

  const oneHourAudit = auditLogs.filter((row) => {
    const d = rowDate(row, ['createdAt']);
    const tenantOk = scope.scopeType === 'platform' || scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId));
    return Boolean(d && d >= oneHourAgo && d <= now && tenantOk);
  });
  const errorOneHour = oneHourAudit.filter((row) => String(row?.result || '').toLowerCase() === 'fail').length;
  let errorRate = oneHourAudit.length > 0 ? (errorOneHour / oneHourAudit.length) * 100 : 0;
  if (hasMetricAgg && (hasHourlyCounterKey('api_total') || hasHourlyCounterKey('api_success') || hasHourlyCounterKey('api_fail'))) {
    failToday = dailyCounterSum('api_fail', toMetricDayKey(dayStart));
    const total24h = hourlyCounterSum('api_total', twentyFourHoursAgo, now);
    const success24hAgg = hourlyCounterSum('api_success', twentyFourHoursAgo, now);
    apiUptime = total24h > 0 ? (success24hAgg / total24h) * 100 : 100;
    const total1h = hourlyCounterSum('api_total', oneHourAgo, now);
    const fail1h = hourlyCounterSum('api_fail', oneHourAgo, now);
    errorRate = total1h > 0 ? (fail1h / total1h) * 100 : 0;
  }

  return {
    c: [
      {
        ...METRIC_CARD_DEFINITIONS.c[0],
        value: formatInteger(cDau),
        ...trendByDelta(cDau, cDauPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[1],
        value: formatMinutes(cStay),
        ...trendByDelta(cStay, cStayPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[2],
        value: formatPercent(cOpenRate),
        ...trendByDelta(cOpenRate, cOpenPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[3],
        value: formatPercent(cSigninRate),
        ...trendByDelta(cSigninRate, cSigninPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[4],
        value: formatDays(cLoginStreakDays),
        ...trendByDelta(cLoginStreakDays, cLoginStreakDaysPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[5],
        value: formatDays(cSigninStreakDays),
        ...trendByDelta(cSigninStreakDays, cSigninStreakDaysPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[6],
        value: formatInteger(cSigninPersonDays),
        trend: `较昨日 ${trendByDelta(cSigninPersonDays, cSigninPersonDaysPrev).trend}`,
        trendType: trendByDelta(cSigninPersonDays, cSigninPersonDaysPrev).trendType,
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[7],
        value: formatPercent(cPolicyRate),
        trend: `${activePolicyCustomers.size}/${formatInteger(totalUsers)}`,
        trendType: 'flat',
      },
    ],
    b: [
      {
        ...METRIC_CARD_DEFINITIONS.b[0],
        value: formatInteger(bDau),
        ...trendByDelta(bDau, bDauPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[1],
        value: formatPercent(bInteractionRate),
        ...trendByDelta(bInteractionRate, bInteractionPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[2],
        value: formatPercent(bRemindRate),
        ...trendByDelta(bRemindRate, bRemindPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[3],
        value: formatPercent(bRetention7d),
        trend: `样本 ${formatInteger(cohortAgentIds.size)}`,
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[4],
        value: formatInteger(bContentPublishCnt),
        ...trendByDelta(bContentPublishCnt, bContentPublishPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[5],
        value: formatInteger(bWriteoffCnt),
        ...trendByDelta(bWriteoffCnt, bWriteoffPrev),
      },
    ],
    p: [
      {
        ...METRIC_CARD_DEFINITIONS.p[0],
        value: formatInteger(pTenantTotal),
        trend: `活跃 ${formatInteger(pTenantActive)}`,
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[1],
        value: formatInteger(pTenantActive),
        ...trendByDelta(pTenantActive, pTenantActivePrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[2],
        value: formatCurrency(pPremiumMtd),
        ...trendByDelta(pPremiumMtd, pPremiumPrevMonth),
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[3],
        value: parseNumber(pInteractionAvg, 0).toFixed(1),
        ...trendByDelta(pInteractionAvg, pInteractionAvgPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[4],
        value: topTeam ? `团队 ${topTeam[0]}` : '-',
        trend: topTeam ? formatCurrency(topTeam[1]) : '暂无',
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[5],
        value: topType ? `${topType[0]} ${topTypeRate.toFixed(1)}%` : '-',
        trend: `样本 ${formatInteger(totalPolicyType)}`,
        trendType: 'flat',
      },
    ],
    system: [
      {
        ...METRIC_CARD_DEFINITIONS.system[0],
        value: formatInteger(failToday),
        trend: failToday > 0 ? '需关注' : '正常',
        trendType: failToday > 0 ? 'down' : 'up',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[1],
        value: formatPercent(apiUptime),
        trend: '近24小时',
        trendType: apiUptime >= 99 ? 'up' : 'down',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[2],
        value: `${Math.round(avgRt)}ms`,
        trend: '近1小时',
        trendType: avgRt <= 250 ? 'up' : 'down',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[3],
        value: formatPercent(serverLoad),
        trend: 'CPU负载估算',
        trendType: serverLoad <= 80 ? 'up' : 'down',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[4],
        value: formatInteger(dbConn),
        trend: '活动会话',
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[5],
        value: formatPercent(errorRate),
        trend: '近1小时',
        trendType: errorRate <= 2 ? 'up' : 'down',
      },
    ],
  };
}

function ensureMetricRuleSeeds(state, tenantId) {
  if (!Array.isArray(state.metricRules)) state.metricRules = [];
  const tenantRows = state.metricRules.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  let changed = false;
  const now = new Date().toISOString();
  const legacyNameMap = {
    累计登录天数: '连续登录天数',
    累计签到天数: '连续签到天数',
    单客累计登录天数: '连续登录天数',
    单客累计签到天数: '连续签到天数',
  };
  tenantRows.forEach((row) => {
    const nextName = legacyNameMap[String(row.name || '').trim()];
    if (nextName) row.name = nextName;
    if (row.name === '连续登录天数') {
      row.formula = '连续登录天数(单客) = 某客户按登录日期去重后，连续自然日登录天数';
      row.period = '累计';
      row.source = '登录日志';
    }
    if (row.name === '连续签到天数') {
      row.formula = '连续签到天数(单客) = 某客户按签到日期去重后，连续自然日签到天数';
      row.period = '累计';
      row.source = 'c_sign_ins';
    }
    if (row.name === '签到人天') {
      row.formula = '签到人天 = count(distinct customer_id, sign_date)';
      row.period = '累计';
      row.source = 'c_sign_ins';
    }
    row.updatedAt = now;
    changed = true;
  });

  // 同端同名去重：保留最后开发/最后更新的一条（updatedAt优先，其次id）
  const grouped = new Map();
  tenantRows.forEach((row) => {
    const key = metricRuleKey(row.end, row.name);
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  });
  const removeIds = new Set();
  grouped.forEach((list) => {
    if (!Array.isArray(list) || list.length <= 1) return;
    const sorted = [...list].sort((a, b) => {
      const at = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      if (at !== bt) return bt - at;
      return Number(b?.id || 0) - Number(a?.id || 0);
    });
    sorted.slice(1).forEach((row) => removeIds.add(Number(row.id || 0)));
  });
  if (removeIds.size > 0) {
    state.metricRules = state.metricRules.filter(
      (row) => !(Number(row.tenantId || 1) === Number(tenantId) && removeIds.has(Number(row.id || 0)))
    );
    changed = true;
  }

  const tenantRowsAfterDedupe = state.metricRules.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const existingKeys = new Set(tenantRowsAfterDedupe.map((row) => metricRuleKey(row.end, row.name)));
  tenantRowsAfterDedupe.forEach((row) => {
    if (String(row.remark || '').trim()) return;
    row.remark = buildMetricRuleRemark({
      name: String(row.name || ''),
      formula: String(row.formula || ''),
      period: String(row.period || '每日'),
      source: String(row.source || ''),
    });
    row.updatedAt = now;
    changed = true;
  });

  Object.entries(METRIC_RULE_SEEDS).forEach(([end, list]) => {
    list.forEach((seed) => {
      const key = metricRuleKey(end, seed.name);
      if (existingKeys.has(key)) return;
      state.metricRules.push({
        id: nextId(state.metricRules),
        tenantId: Number(tenantId || 1),
        end,
        name: seed.name,
        formula: seed.formula,
        period: seed.period,
        source: seed.source,
        status: 'enabled',
        threshold: '',
        remark: buildMetricRuleRemark(seed),
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      });
      existingKeys.add(key);
      changed = true;
    });
  });
  return changed;
}

function ensureTagSeeds(state, tenantId) {
  if (!Array.isArray(state.pTags)) state.pTags = [];
  if (!Array.isArray(state.pTagRules)) state.pTagRules = [];
  if (!Array.isArray(state.pTagRuleJobs)) state.pTagRuleJobs = [];
  if (!Array.isArray(state.pTagRuleJobLogs)) state.pTagRuleJobLogs = [];
  const now = new Date().toISOString();
  let changed = false;

  const tenantTags = state.pTags.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const tagByCode = new Map(tenantTags.map((row) => [String(row.tagCode || ''), row]));
  TAG_SEEDS.forEach((seed) => {
    if (tagByCode.has(seed.tagCode)) return;
    const row = {
      id: nextId(state.pTags),
      tenantId: Number(tenantId || 1),
      tagCode: seed.tagCode,
      tagName: seed.tagName,
      tagType: normalizeTagType(seed.tagType),
      source: seed.source || 'manual',
      description: seed.description || '',
      status: normalizeTagStatus(seed.status),
      valueSchema: {},
      hitCount: 0,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };
    state.pTags.push(row);
    tagByCode.set(seed.tagCode, row);
    changed = true;
  });

  const tenantRules = state.pTagRules.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const ruleByCode = new Set(tenantRules.map((row) => String(row.ruleCode || '')));
  TAG_RULE_SEEDS.forEach((seed) => {
    if (ruleByCode.has(seed.ruleCode)) return;
    const targetTag = tagByCode.get(seed.targetTagCode);
    if (!targetTag) return;
    state.pTagRules.push({
      id: nextId(state.pTagRules),
      tenantId: Number(tenantId || 1),
      ruleCode: seed.ruleCode,
      ruleName: seed.ruleName,
      targetTagId: Number(targetTag.id),
      targetTagIds: [Number(targetTag.id)],
      priority: Number(seed.priority || 100),
      status: normalizeTagRuleStatus(seed.status),
      conditionDsl: seed.conditionDsl || { op: 'and', children: [] },
      outputExpr: seed.outputExpr || { mode: 'const', value: '' },
      effectiveStartAt: null,
      effectiveEndAt: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  });

  return changed;
}

function ensureEventDefinitionSeeds(state, tenantId) {
  if (!Array.isArray(state.eventDefinitions)) state.eventDefinitions = [];
  const exists = state.eventDefinitions.some((row) => Number(row.tenantId || 1) === Number(tenantId));
  const now = new Date().toISOString();
  let changed = false;
  const seedByEventId = new Map(EVENT_DEFINITION_SEEDS.map((seed) => [Number(seed.eventId), seed]));
  if (!exists) {
    EVENT_DEFINITION_SEEDS.forEach((seed) => {
      state.eventDefinitions.push({
        id: nextId(state.eventDefinitions),
        tenantId: Number(tenantId || 1),
        eventId: Number(seed.eventId),
        eventName: seed.eventName,
        eventType: 'system',
        description: seed.description,
        collectMethod: seed.collectMethod,
        status: 'enabled',
        schema: eventSchemaTemplateById(seed.eventId) || {},
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      });
    });
    changed = true;
  }

  const tenantRowsCurrent = state.eventDefinitions.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const existedEventIds = new Set(tenantRowsCurrent.map((row) => Number(row.eventId || 0)));
  EVENT_DEFINITION_SEEDS.forEach((seed) => {
    const eventId = Number(seed.eventId || 0);
    if (existedEventIds.has(eventId)) return;
    state.eventDefinitions.push({
      id: nextId(state.eventDefinitions),
      tenantId: Number(tenantId || 1),
      eventId,
      eventName: seed.eventName,
      eventType: 'system',
      description: seed.description,
      collectMethod: seed.collectMethod,
      status: 'enabled',
      schema: eventSchemaTemplateById(seed.eventId) || {},
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  });

  const tenantRows = state.eventDefinitions.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  tenantRows.forEach((row) => {
    if (normalizeEventType(row.eventType) !== 'system') return;
    const seed = seedByEventId.get(Number(row.eventId || 0));
    if (seed) {
      const nextName = String(seed.eventName || '');
      const nextDesc = String(seed.description || '');
      const nextMethod = normalizeCollectMethod(seed.collectMethod);
      if (String(row.eventName || '') !== nextName) {
        row.eventName = nextName;
        row.updatedAt = now;
        changed = true;
      }
      if (String(row.description || '') !== nextDesc) {
        row.description = nextDesc;
        row.updatedAt = now;
        changed = true;
      }
      if (normalizeCollectMethod(row.collectMethod) !== nextMethod) {
        row.collectMethod = nextMethod;
        row.updatedAt = now;
        changed = true;
      }
    }
    const template = eventSchemaTemplateById(row.eventId);
    if (!template) return;
    const hasCaliber = row.schema && typeof row.schema === 'object' && String(row.schema.caliber || '').trim();
    const shouldSyncSchema = !hasCaliber || Number(row.eventId || 0) === 1004 || Number(row.eventId || 0) === 1009;
    if (shouldSyncSchema && JSON.stringify(row.schema || {}) !== JSON.stringify(template)) {
      row.schema = template;
      row.updatedAt = now;
      changed = true;
    }
  });

  return changed;
}

export function registerPAdminRoutes(app) {
  app.post('/api/p/auth/login', (req, res) => {
    const state = getState();
    const account = String(req.body?.account || '').trim();
    const accountLower = account.toLowerCase();
    const password = String(req.body?.password || '').trim();
    if (!account || !password) {
      return res.status(400).json({ code: 'LOGIN_PARAMS_REQUIRED', message: '请输入账号和密码' });
    }

    const demoAccounts = [
      {
        account: 'platform001',
        password: '123456',
        name: '平台管理员',
        role: 'platform_admin',
        actorType: 'employee',
        actorId: 9001,
        tenantId: 1,
        orgId: 1,
        teamId: 1,
      },
    ];
    let session = demoAccounts.find((x) => x.account === account && x.password === password);
    if (!session) {
      const user = (state.agents || []).find((x) => {
        const email = String(x.email || '').toLowerCase();
        const accountField = String(x.account || '').toLowerCase();
        const mobile = String(x.mobile || '').trim();
        return email === accountLower || accountField === accountLower || (mobile && mobile === account);
      });
      if (user && String(user.password || user.initialPassword || '') === password) {
        const userRole = String(user.role || '').toLowerCase();
        const isManager = userRole === 'manager';
        const isTeamLead = userRole === 'support' || userRole === 'team_lead';
        session = {
          account: String(user.email || user.mobile || user.account || account),
          password,
          name: String(user.name || '员工'),
          mobile: String(user.mobile || ''),
          role: isManager ? 'company_admin' : isTeamLead ? 'team_lead' : 'agent',
          actorType: isManager || isTeamLead ? 'employee' : 'agent',
          actorId: Number(user.id),
          tenantId: Number(user.tenantId || 1),
          orgId: Number(user.orgId || 1),
          teamId: Number(user.teamId || 1),
        };
      }
    }
    if (!session) {
      return res.status(401).json({ code: 'LOGIN_FAILED', message: '账号或密码错误' });
    }
    const { password: _password, ...safeSession } = session;
    const token = createActorSession({
      actorType: String(safeSession.actorType || 'employee'),
      actorId: Number(safeSession.actorId || 0),
      tenantId: Number(safeSession.tenantId || 0),
      orgId: Number(safeSession.orgId || 0),
      teamId: Number(safeSession.teamId || 0),
    });
    const sessionRow = resolveSessionFromBearer(`Bearer ${token}`);
    const csrfToken = upsertActorCsrfToken({
      tenantId: Number(safeSession.tenantId || 1),
      actorType: String(safeSession.actorType || 'employee'),
      actorId: Number(safeSession.actorId || 0),
    });
    return res.json({ ok: true, session: { ...safeSession, token, csrfToken: sessionRow?.csrfToken || csrfToken } });
  });

  registerPAdminGovernanceRoutes(app, {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    appendAuditLog,
    hasRole,
    COMPANY_ADMIN_PAGE_MODULES,
    allCompanyAdminPageIds,
  });

  registerPAdminOpsRoutes(app, {
    tenantContext,
    permissionRequired,
    refundOrder,
    rebuildDailySnapshot,
    latestSnapshot,
    listSnapshots,
    runReconciliation,
  });

  registerPAdminActivityRoutes(app, {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    hasRole,
    canOperateTenantTemplates,
    canAccessTemplate,
    decoratePlatformTemplateRow,
  });

  registerPAdminLearningRoutes(app, {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    hasRole,
    canOperateTenantTemplates,
    canAccessTemplate,
  });

  registerPAdminWorkforceRoutes(app, {
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
  });

  registerPAdminMallRoutes(app, {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    hasRole,
    canOperateTenantTemplates,
    canAccessTemplate,
  });

  registerPAdminTagRoutes(app, {
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
  });

  registerPAdminMetricRoutes(app, {
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
  });

  registerPAdminEventRoutes(app, {
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
  });

}
