# 指标口径说明（v1）

更新时间：2026-02-27  
适用范围：P端「营销策略 > 指标配置」页面（C端/B端/P端/系统指标）  
口径负责人：产品 + 数据 + 后端联合维护

## 1. 口径总原则

1. 统计范围默认按 `tenant_id` 隔离，不跨租户汇总。
2. 时间口径统一使用 `Asia/Shanghai (UTC+8)`，自然日边界 `00:00:00 - 23:59:59`。
3. 删除数据统一排除：业务表均以 `is_deleted = FALSE` 作为有效记录。
4. 比率类指标统一公式：`分子 / 分母 * 100%`，分母为 0 时返回 0。
5. 金额类指标默认保留两位小数；比率类默认展示到 1 位小数。
6. 当前 v1 页面中的卡片数值来自后端种子配置 `METRIC_CARD_SEEDS`（展示占位值）；规则库与口径定义已落库到 `p_metric_rules`，用于后续真实聚合替换。

## 2. 指标规则库字段口径（p_metric_rules）

| 字段 | 含义 | 口径约束 |
| --- | --- | --- |
| `metric_end` | 指标所属端 | 枚举：`c` / `b` / `p` / `system` |
| `metric_name` | 指标名称 | 同一租户下建议唯一（业务约束） |
| `formula` | 计算口径/公式 | 必填，需可被研发转换为 SQL/计算任务 |
| `stat_period` | 统计周期 | 例如：每日、近7日、月累计、实时 |
| `data_source` | 数据源描述 | 必填，需落到表/日志/监控系统 |
| `status` | 规则状态 | `enabled` / `disabled` |
| `threshold` | 阈值规则 | 可选，支持文本表达（如 `<2%`） |
| `remark` | 备注 | 可选，记录口径补充说明 |

## 3. C端指标口径

| 编码 | 指标名 | 计算口径 | 统计周期 | 主要数据源（正式表） | 刷新建议 | 落地状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `c_dau` | C端日活（DAU） | 当日有任意有效行为的去重客户数 | 每日 | `c_sign_ins`、`c_activity_completions`、`c_learning_records`、`c_point_transactions`、`c_redeem_records`、`b_customer_activities` | T+5min | 页面值为种子占位 |
| `c_stay_duration` | 人均停留时长 | `当日总停留时长 / 当日活跃客户数` | 每日 | `p_track_events`（页面停留事件及时长属性） | T+5min | 页面值为种子占位 |
| `c_open_rate` | 内容打开率 | `打开内容人数 / 内容触达人数` | 每日 | `p_track_events`（内容触达/打开事件）、`p_learning_materials` | T+5min | 页面值为种子占位 |
| `c_signin_rate` | 签到率 | `签到人数 / 活跃客户数` | 每日 | `c_sign_ins`、`c_customers` | T+5min | 页面值为种子占位 |
| `c_redeem_rate` | 积分兑换率 | `兑换人数 / 有积分余额客户数` | 每日 | `c_redeem_records`、`c_point_transactions` | T+5min | 页面值为种子占位 |
| `c_policy_rate` | 保单托管率 | `有在保保单客户数 / 总客户数` | 实时累计 | `c_policies`、`c_customers` | T+5min | 页面值为种子占位 |

## 4. B端指标口径

| 编码 | 指标名 | 计算口径 | 统计周期 | 主要数据源（正式表） | 刷新建议 | 落地状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `b_dau` | B端日活（DAU） | 当日登录过系统的去重业务员数 | 每日 | `p_sessions`、`b_agents` | T+5min | 页面值为种子占位 |
| `b_interaction_rate` | 客户互动率 | `有互动客户数 / 客户总数` | 每日 | `b_customer_activities`、`c_customers` | T+5min | 页面值为种子占位 |
| `b_remind_click_rate` | 智能提醒点击率 | `提醒点击次数 / 提醒下发次数` | 每日 | `p_track_events`（提醒下发/点击事件） | T+5min | 页面值为种子占位 |
| `b_retention_7d` | 7日留存率 | `注册后第7天仍登录业务员数 / 注册业务员数` | 按注册批次 | `b_agents`、`p_sessions` | 每日离线 | 页面值为种子占位 |
| `b_content_publish_cnt` | 内容发布数 | 当日已发布内容条数 | 每日 | `p_learning_materials`、`p_activities` | T+5min | 页面值为种子占位 |
| `b_writeoff_cnt` | 核销单数 | 当日核销成功笔数 | 每日 | `b_write_off_records` | T+5min | 页面值为种子占位 |

## 5. P端指标口径

| 编码 | 指标名 | 计算口径 | 统计周期 | 主要数据源（正式表） | 刷新建议 | 落地状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `p_tenant_total` | 租户总数 | 状态有效租户数 | 实时累计 | `p_tenants` | T+5min | 页面值为种子占位 |
| `p_tenant_active` | 活跃租户 | 近7日有登录行为的租户数 | 近7日 | `p_sessions`、`p_tenants` | T+5min | 页面值为种子占位 |
| `p_premium_mtd` | 本月签单总额 | 当月签单保费总和 | 月累计 | `c_policies`（保费字段） | T+5min | 页面值为种子占位 |
| `p_interaction_avg` | 人均客户互动数 | `总互动次数 / 活跃业务员数` | 月累计 | `b_customer_activities`、`b_agents`、`p_sessions` | T+5min | 页面值为种子占位 |
| `p_team_rank` | 团队业绩排行 | 按团队当月签单额降序 | 月累计 | `c_policies`、`c_customers`、`b_agents`、`p_employees` | 每日离线 | 页面值为种子占位 |
| `p_product_pref` | 险种偏好 | 各险种保单占比 | 实时累计 | `c_policies` | T+5min | 页面值为种子占位 |

## 6. 系统指标口径

| 编码 | 指标名 | 计算口径 | 统计周期 | 主要数据源 | 刷新建议 | 落地状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `sys_alert_today` | 今日告警 | 当日新告警总数 | 每日 | 监控/告警系统 | 1分钟 | 页面值为种子占位 |
| `sys_api_uptime` | API可用性 | `成功请求数 / 总请求数` | 近24小时 | API 网关/监控系统 | 1分钟 | 页面值为种子占位 |
| `sys_api_avg_rt` | 平均响应时间 | 近窗口内接口平均耗时 | 近1小时 | API 网关/监控系统 | 1分钟 | 页面值为种子占位 |
| `sys_server_load` | 服务器负载 | CPU/内存综合负载 | 实时 | 主机监控系统 | 1分钟 | 页面值为种子占位 |
| `sys_db_conn` | 数据库连接数 | 当前数据库连接数 | 实时 | PostgreSQL `pg_stat_activity`/监控 | 1分钟 | 页面值为种子占位 |
| `sys_error_rate` | 错误率 | `5xx 请求数 / 总请求数` | 近1小时 | API 网关/监控系统 | 1分钟 | 页面值为种子占位 |

## 7. 指标治理流程（执行口径）

1. 新增指标：先在 `p_metric_rules` 配置并评审通过，再进入聚合开发。
2. 变更口径：必须同步更新本文档 + 规则库 + 对应接口注释。
3. 对账规则：每日抽样核对「接口返回值 vs SQL手工计算值」，偏差阈值默认 `< 1%`。
4. 发布要求：涉及分子/分母定义变化，需在发布说明中明确“生效日期”和“影响范围”。

