# 标签系统可执行版 PRD v1

## 1. 目标与范围
- 目标：把 P 端“标签列表/标签规则库”从静态原型改为可配置、可执行、可审计的系统。
- 范围：
  - P 端标签定义管理
  - P 端规则库（创建、发布、停用、回放）
  - 标签计算任务（批处理）
  - 标签结果写入与客户画像读取
- 非范围（v1 不做）：实时流式计算、跨租户联合规则、复杂窗口函数（如 7 日滚动留存）。

## 2. 领域模型（最小可用）

### 2.1 标签定义 `p_tags`
- `id` bigint pk
- `tenant_id` bigint not null
- `tag_code` varchar(64) unique(tenant_id, tag_code)
- `tag_name` varchar(64) not null
- `tag_type` enum('enum','boolean','number','date') not null
- `value_schema_json` json not null default '{}'
- `status` enum('draft','active','disabled') not null default 'draft'
- `description` varchar(255) null
- `created_by` bigint
- `updated_by` bigint
- `created_at` datetime
- `updated_at` datetime

说明：
- `value_schema_json` 示例：
```json
{"enumValues":["高价值","中价值","低价值"]}
```

### 2.2 规则定义 `p_tag_rules`
- `id` bigint pk
- `tenant_id` bigint not null
- `rule_code` varchar(64) unique(tenant_id, rule_code)
- `rule_name` varchar(128) not null
- `target_tag_id` bigint not null
- `priority` int not null default 100
- `status` enum('draft','active','disabled') not null default 'draft'
- `condition_dsl_json` json not null
- `output_expr_json` json not null
- `effective_start_at` datetime null
- `effective_end_at` datetime null
- `last_published_at` datetime null
- `created_by` bigint
- `updated_by` bigint
- `created_at` datetime
- `updated_at` datetime

### 2.3 标签结果 `b_customer_tag_values`
- `id` bigint pk
- `tenant_id` bigint not null
- `customer_id` bigint not null
- `tag_id` bigint not null
- `tag_value` varchar(255) not null
- `tag_value_type` enum('string','number','boolean','date') not null
- `source_rule_id` bigint null
- `source_job_id` bigint null
- `computed_at` datetime not null
- `expires_at` datetime null
- unique(`tenant_id`,`customer_id`,`tag_id`)

### 2.4 执行任务 `p_tag_rule_jobs`
- `id` bigint pk
- `tenant_id` bigint not null
- `job_type` enum('full','delta','replay') not null
- `trigger_type` enum('manual','schedule','publish') not null
- `status` enum('queued','running','success','partial_success','failed','cancelled') not null
- `target_rule_ids_json` json not null
- `scope_json` json not null
- `started_at` datetime null
- `ended_at` datetime null
- `total_customers` int default 0
- `success_customers` int default 0
- `failed_customers` int default 0
- `error_summary` varchar(500) null
- `created_by` bigint
- `created_at` datetime

### 2.5 执行明细日志 `p_tag_rule_job_logs`
- `id` bigint pk
- `job_id` bigint not null
- `tenant_id` bigint not null
- `customer_id` bigint not null
- `rule_id` bigint not null
- `result` enum('hit','miss','error') not null
- `output_value` varchar(255) null
- `reason` varchar(500) null
- `event_snapshot_json` json null
- `created_at` datetime

## 3. 规则 DSL（v1 约束）

### 3.1 条件 DSL `condition_dsl_json`
```json
{
  "op": "and",
  "children": [
    {"metric":"login_days_30d", "cmp":">=", "value":7},
    {"metric":"sign_days_30d", "cmp":">=", "value":5}
  ]
}
```

支持：
- 逻辑：`and` / `or`
- 比较：`=`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `not_in`, `contains`
- 指标来源：统一从指标中心读取（见 6. 指标口径）

### 3.2 输出 DSL `output_expr_json`
```json
{"mode":"const","value":"高活跃"}
```
或
```json
{"mode":"map","fromMetric":"risk_score","ranges":[
  {"gte":80,"value":"高风险"},
  {"gte":50,"lt":80,"value":"中风险"},
  {"lt":50,"value":"低风险"}
]}
```

### 3.3 冲突解决
- 同一标签多规则命中时，按 `priority` 升序取第一条。
- 优先级相同按 `id` 升序。
- 每次作业必须幂等：同一 `job_id + customer_id + tag_id` 重跑结果一致。

## 4. P 端 API（必须）

### 4.1 标签管理
- `GET /api/p/tags?tenantId=&status=&keyword=&page=&pageSize=`
- `POST /api/p/tags`
- `GET /api/p/tags/:id`
- `PUT /api/p/tags/:id`
- `POST /api/p/tags/:id/enable`
- `POST /api/p/tags/:id/disable`

### 4.2 规则管理
- `GET /api/p/tag-rules?tenantId=&tagId=&status=&keyword=&page=&pageSize=`
- `POST /api/p/tag-rules`
- `GET /api/p/tag-rules/:id`
- `PUT /api/p/tag-rules/:id`
- `POST /api/p/tag-rules/:id/publish`
- `POST /api/p/tag-rules/:id/disable`
- `POST /api/p/tag-rules/validate-dsl`

### 4.3 执行与审计
- `POST /api/p/tag-rule-jobs`（触发 full/delta/replay）
- `GET /api/p/tag-rule-jobs?tenantId=&status=&page=&pageSize=`
- `GET /api/p/tag-rule-jobs/:id`
- `GET /api/p/tag-rule-jobs/:id/logs?result=&page=&pageSize=`

### 4.4 客户标签读取（B/C 复用）
- `GET /api/b/customers/:id/tags`
- `GET /api/c/me/tags`

## 5. 页面与后端字段绑定（P端）

### 5.1 标签列表页
- 数据源：`GET /api/p/tags`
- 列：标签名称、编码、类型、状态、规则数（active）、更新时间、操作
- 操作：查看、编辑、启用/禁用、查看规则

### 5.2 标签规则库
- 数据源：`GET /api/p/tag-rules`
- 列：规则名称、目标标签、优先级、状态、生效时间、最近发布时间、命中率（近7天）
- 操作：查看、编辑、发布、停用、回放

## 6. 指标口径（必须统一）

### 6.1 `累计登录天数`
- 指标 code：`login_days_cumulative`
- 定义：客户首次登录日至当前日期，发生“登录成功”事件的去重自然日总数。
- 去重键：`customer_id + event_date`
- 数据源事件：`c_login_success`（兼容 v1 eventName 映射）

### 6.2 `累计签到天数`
- 指标 code：`sign_days_cumulative`
- 定义：客户首次签到日至当前日期，发生“签到成功”事件的去重自然日总数。
- 去重键：`customer_id + event_date`
- 数据源事件：`c_checkin_success`（兼容 v1 eventName 映射）

## 7. 与现网 v1 兼容要求
- 前端上报继续兼容 `tracking-events-v1.md` 字段。
- 后端入库阶段做 eventName 标准化映射，不改前端历史埋点。
- 规则计算仅消费标准化后的指标层，不直接依赖页面 path 文本。

## 8. 权限与审计
- 角色：`p_admin` 可全量操作，`p_operator` 可查看和试跑，不可发布。
- 所有变更写审计日志：操作人、前后值、时间、租户。

## 9. 非功能与验收
- 全量任务：10 万客户 30 分钟内完成（单租户）。
- 查询：列表接口 P95 < 300ms（不含大分页导出）。
- 可观测：每个 job 必须可查状态、失败原因、命中数量。

## 10. 验收用例（最小）
1. 新建标签“活跃等级”并启用。
2. 新建规则“30天登录>=7且签到>=5 => 高活跃”，发布。
3. 触发 delta 任务成功，日志可看到 hit/miss。
4. B端客户详情可读到该标签值。
5. 修改规则后重跑，客户标签值发生预期变化并可追溯来源 rule/job。

---

## 11. 当前项目落地差距（针对你现在代码）
- P端标签列表/规则库目前是静态 mock，未接真实 API。
- 后端缺少 `p_tags / p_tag_rules / p_tag_rule_jobs / p_tag_rule_job_logs` 表。
- 后端缺少 `/api/p/tags`、`/api/p/tag-rules`、`/api/p/tag-rule-jobs` 路由。
- B/C 端客户标签读取尚未与规则结果表统一联动。

建议按顺序实施：
1. 建表 + migration。
2. 补后端 P API。
3. P 端页面改真实数据源。
4. 接入定时/手动作业执行。
