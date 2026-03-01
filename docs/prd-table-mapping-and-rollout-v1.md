# PRD表映射与落地优先级（v1）

更新时间：2026-02-24  
依据文档：保云链需求文档（外部输入，第5章）

## 1. 结论

- PRD定义业务表：22张（C7 + B5 + P7 + Stats3）。
- 当前数据库已落地物理表：1张（`runtime_state`）。
- 差距：21张未建表。

## 2. PRD表到建议DDL映射

| 端 | PRD表名 | 建议DDL表名 | 当前状态 | 优先级 |
|---|---|---|---|---|
| C | c_customer | c_customers | 未建 | P0 |
| C | c_family_member | c_family_members | 未建 | P1 |
| C | c_policy | c_policies | 未建 | P0 |
| C | c_learning_record | c_learning_records | 未建 | P0 |
| C | c_points_transaction | c_point_transactions | 未建 | P0 |
| C | c_redeem_record | c_redeem_records | 未建 | P0 |
| C | c_favorite | c_favorites | 未建 | P1 |
| B | b_agent | b_agents | 未建 | P0 |
| B | b_customer_tag | b_customer_tags | 未建 | P1 |
| B | b_customer_tag_rel | b_customer_tag_rels | 未建 | P1 |
| B | b_customer_activity | b_customer_activities | 未建 | P0 |
| B | b_write_off_record | b_write_off_records | 未建 | P0 |
| P | p_tenant | p_tenants | 未建 | P0 |
| P | p_activity | p_activities | 未建 | P0 |
| P | p_learning_material | p_learning_materials | 未建 | P1 |
| P | p_product | p_products | 未建 | P0 |
| P | p_tag_rule | p_tag_rules | 未建 | P1 |
| P | p_role | p_roles | 未建 | P0 |
| P | p_employee | p_employees | 未建 | P0 |
| Stats | stats_customer | stats_customers_daily | 未建 | P2 |
| Stats | stats_activity | stats_activities_daily | 未建 | P2 |
| Stats | stats_content | stats_contents_daily | 未建 | P2 |

## 3. 额外必需表（PRD隐含，建议新增）

| 类别 | 建议表名 | 目的 | 优先级 |
|---|---|---|---|
| 权限 | iam_permissions | 权限点定义 | P0 |
| 权限 | iam_role_permissions | 角色权限矩阵 | P0 |
| 权限 | iam_user_roles | 用户角色绑定 | P0 |
| 审批 | approval_requests | 临时授权/导出审批 | P0 |
| 审批 | approval_steps | 审批流步骤 | P1 |
| 审计 | audit_logs | 敏感操作审计 | P0 |
| 幂等 | idempotency_records | 防重复发放/核销 | P0 |
| 对账 | reconciliation_jobs | 日终对账任务 | P1 |
| 对账 | reconciliation_results | 对账结果与差异 | P1 |

## 4. 分阶段建表建议

### Phase A（本周，先支撑商品购买流程与B/P最小可用）

- `p_tenants`、`p_roles`、`p_employees`
- `p_products`、`p_activities`
- `c_customers`、`c_point_transactions`、`c_redeem_records`
- `b_agents`、`b_customer_activities`、`b_write_off_records`
- `iam_permissions`、`iam_role_permissions`、`iam_user_roles`
- `approval_requests`、`audit_logs`、`idempotency_records`

### Phase B（下周，补齐运营与内容）

- `c_family_members`、`c_favorites`
- `b_customer_tags`、`b_customer_tag_rels`
- `p_learning_materials`、`p_tag_rules`
- `approval_steps`、`reconciliation_jobs`、`reconciliation_results`

### Phase C（报表层）

- `stats_customers_daily`、`stats_activities_daily`、`stats_contents_daily`

## 5. 约束与索引最低要求（P0）

- 所有业务表统一基础字段：`tenant_id, created_by, created_at, updated_at, is_deleted`。
- 核销唯一：`writeoff_token unique`。
- 积分幂等唯一：`idempotency_key unique`。
- 高频索引：
  - `tenant_id + created_at`
  - `customer_id + created_at`
  - `status + updated_at`
  - `agent_id + customer_id`
