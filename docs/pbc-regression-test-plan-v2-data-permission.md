# P/B/C 端全链路回归测试文档（数据准确性 + 数据权限 + 口径一致性）

文档版本：v2.0  
创建日期：2026-02-27  
适用项目：
- `.`
- `../../insurance_code_P`
- `../../insurance_code_B`

## 1. 测试目标

本轮回归不仅验证“功能可用”，还必须验证以下四项：

1. 数据准确性：同一业务在 C/B/P 端展示一致，且与后端结果一致。  
2. 数据权限：不同角色、不同租户、不同团队的数据隔离与可见范围正确。  
3. 口径一致性：事件、指标、标签计算口径与配置一致。  
4. 可追溯性：每条关键结果可以通过 UI -> API -> 存储/日志 三层复核。

## 2. 环境基线与启动

## 2.1 服务地址

- API：`http://127.0.0.1:4000`
- P端：`http://127.0.0.1:3000`
- B端：`http://127.0.0.1:3001`
- C端：`http://127.0.0.1:3002`

## 2.2 启动命令

```bash
# API
cd .
node server/skeleton-c-v1.mjs

# P
cd ../../insurance_code_P
npm run dev -- --port 3000 --host 0.0.0.0

# B
cd ../../insurance_code_B
npm run dev -- --port 3001 --host 0.0.0.0

# C
cd .
npm run dev -- --port 3002 --host 0.0.0.0
```

## 2.3 账号

- P端：`platform001 / 123456`、`company001 / 123456`、`agent001 / 123456`
- B端：`company001 / 123456`、`agent001 / 123456`
- C端：手机号 + 验证码（开发环境默认 `123456`）

## 2.4 回归前数据前置

1. 创建一个“本轮专用租户”（建议命名：`REG_TENANT_YYYYMMDD`）。
2. 在该租户下创建：
- 1 个公司管理员（employee/manager）
- 2 个业务员（agent）
3. 准备 3 个客户测试样本：
- 客户A：高收入/高活跃
- 客户B：中收入/中活跃
- 客户C：低收入/低活跃
4. 确保三类数据链路可打通：学习、活动、兑换。

## 3. 权限模型与预期可见范围（必须先验）

依据后端权限与可见范围实现（`access-control.mjs`、`template-visibility.mjs`）定义以下预期。

## 3.1 角色权限矩阵

| 角色 | 基础权限 | 数据范围权限 | 关键预期 |
|---|---|---|---|
| platform_admin | tenant/customer/order/stats/approval 全量读写 | `scope:tenant:all` | 可跨租户查看；仅可见“自己创建的平台模板” |
| company_admin | tenant:read + customer读写 + writeoff + stats + approval | `scope:team:all` | 仅当前租户；可见平台模板+本租户模板 |
| team_lead | customer读写 + writeoff | `scope:team:all` | 仅本团队客户 |
| agent | customer读写 + writeoff | 无扩展 scope | 仅自己 owner 的客户 |
| customer | C端受 token 与 tenant 限制 | 自身数据 | 仅本人数据 |

## 3.2 模板可见规则（内容/活动/商城）

| 查看方 | 可见模板 |
|---|---|
| platform_admin | 仅平台管理员本人创建的平台模板 |
| company_admin | 平台模板 + 本租户 company_admin 创建模板 |
| agent | 本租户 company_admin 创建模板 |
| customer | 本租户 company_admin 发布模板 |

## 4. 执行策略

采用“三层验证”模式，每条核心用例必须覆盖至少两层：

1. UI层：页面展示与交互。  
2. API层：接口响应字段、数量、状态码。  
3. 数据层：日志/聚合/事务一致性（接口聚合核验或数据库核验）。

## 5. 关键数据校验用例

说明：
- `P0`：上线阻断。
- `P1`：高优先级。
- 每条用例执行后需记录：实际值、期望值、差异、截图/日志证据。

## 5.1 租户与角色权限

| 用例ID | 优先级 | 场景 | 步骤 | 预期 |
|---|---|---|---|---|
| DP-AUTH-001 | P0 | 租户隔离（P端） | platform_admin 查看租户列表；company_admin 查看租户列表 | platform_admin 可跨租户，company_admin 仅本租户 |
| DP-AUTH-002 | P0 | 客户数据范围（B端） | 使用 agent001 登录 B 端访问客户列表 | 仅返回 ownerUserId=agent001 的客户 |
| DP-AUTH-003 | P0 | 团队范围 | team_lead 访问客户列表 | 仅可见 teamId=本人team 的客户 |
| DP-AUTH-004 | P0 | 越权读取防护 | 通过 API 读取非本租户客户详情 | 返回 403 或 404（按接口定义） |
| DP-AUTH-005 | P1 | 模板可见差异 | platform/company/agent/customer 分别查看学习/活动/商城列表 | 满足 3.2 模板可见规则 |

### API核验示例（权限）

```bash
# B端客户列表（agent视角）
curl -s 'http://127.0.0.1:4000/api/b/customers' \
  -H 'x-actor-type: agent' -H 'x-actor-id: 8001' -H 'x-tenant-id: 1'
```

核验点：返回客户的 `ownerUserId` 应全部为 `8001`。

## 5.2 事件数据准确性（埋点 -> 轨迹）

| 用例ID | 优先级 | 场景 | 步骤 | 预期 |
|---|---|---|---|---|
| DP-EVT-001 | P0 | C端学习进入事件 | C端进入“知识学习”页 | B端客户互动轨迹出现“进入知识学习” |
| DP-EVT-002 | P0 | C端课程浏览事件 | C端打开课程详情 | B端互动轨迹显示“查看课程：<课程名>” |
| DP-EVT-003 | P0 | C端兑换事件 | C端兑换商品/活动 | B端互动轨迹显示“兑换商品/兑换活动：<名称>” |
| DP-EVT-004 | P1 | C端分享事件 | C端执行分享成功 | `c_share_success` 事件计数增加 |
| DP-EVT-005 | P1 | B端分享事件 | B端执行分享成功 | `b_tools_share_success` 事件计数增加 |
| DP-EVT-006 | P0 | 分端统计正确 | 查询 `/api/p/metrics/share-daily` | `cShareCount` 与 `bShareCount` 分开且正确 |

### API核验示例（分享）

```bash
curl -s 'http://127.0.0.1:4000/api/p/metrics/share-daily?day=2026-02-27&cActorId=2&bActorId=8001' \
  -H 'x-actor-type: employee' -H 'x-actor-id: 9001' -H 'x-tenant-id: 1'
```

核验点：
- `metricKeys.c = c_share_success_cnt`
- `metricKeys.b = b_share_success_cnt`
- `eventNames.c = c_share_success`
- `eventNames.b = b_tools_share_success`

## 5.3 指标口径准确性（公式校验）

| 用例ID | 优先级 | 指标 | 校验方法 | 预期 |
|---|---|---|---|---|
| DP-MET-001 | P0 | 30天登录次数(C端) | 构造客户近30天登录；检查规则与指标展示 | 与去重天数口径一致 |
| DP-MET-002 | P0 | 30天签到天数(C端) | 构造签到数据；检查 `sign_days_30d` | 与签到去重天数一致 |
| DP-MET-003 | P0 | 续保意向分 | 按 `activityBase + premiumBase` 复算 | 与规则引擎使用值一致 |
| DP-MET-004 | P1 | B端互动率 | 构造互动客户数/总客户数 | 比值正确 |
| DP-MET-005 | P1 | 指标备注同步 | 修改指标口径（formula）后看备注 | 备注应同步/符合规则 |

### 续保意向分复算口径

后端实现口径：
- `activityBase = c_login_days_30d * 3 + c_sign_days_30d * 5 + b_login_count_30d * 2`
- `premiumBase = min(60, floor(premium_12m / 1000))`
- `renew_intent_score = min(100, activityBase + premiumBase)`

## 5.4 标签规则准确性（固定值 + 映射值）

| 用例ID | 优先级 | 场景 | 步骤 | 预期 |
|---|---|---|---|---|
| DP-TAG-001 | P0 | 固定值规则 | 配置 `mode=const`，执行规则任务 | 命中日志 `outputValue=固定值` |
| DP-TAG-002 | P0 | 映射值规则 | 配置 `mode=map`（sourceMetric+mappings+defaultValue），执行任务 | 命中日志 `outputValue=映射后的枚举值` |
| DP-TAG-003 | P0 | 多目标标签 | 规则配置多个 targetTagIds | 返回与回显一致 |
| DP-TAG-004 | P1 | 未命中默认值 | map 规则都不命中 | 写入 `defaultValue` |
| DP-TAG-005 | P1 | 标签删除保护 | 被规则引用标签尝试删除 | 返回 `TAG_IN_USE` |

### API核验示例（规则执行日志）

```bash
# 创建任务
curl -s -X POST 'http://127.0.0.1:4000/api/p/tag-rule-jobs' \
  -H 'Content-Type: application/json' \
  -H 'x-actor-type: employee' -H 'x-actor-id: 9001' -H 'x-tenant-id: 1' \
  --data '{"jobType":"delta","triggerType":"manual","targetRuleIds":[<ruleId>]}'

# 查日志
curl -s 'http://127.0.0.1:4000/api/p/tag-rule-jobs/<jobId>/logs?page=1&pageSize=50' \
  -H 'x-actor-type: employee' -H 'x-actor-id: 9001' -H 'x-tenant-id: 1'
```

核验点：
- `result` 为 `hit/miss`
- `hit` 时 `outputValue` 必须为最终值（非整段 JSON）

## 5.5 交易与积分一致性

| 用例ID | 优先级 | 场景 | 校验 |
|---|---|---|---|
| DP-PTS-001 | P0 | 签到发分 | 积分流水新增 + 余额同步增加 |
| DP-PTS-002 | P0 | 兑换扣分 | 兑换订单创建后流水减少，余额正确 |
| DP-PTS-003 | P0 | B端客户详情一致性 | 客户详情积分流水与C端“我的积分”一致 |
| DP-PTS-004 | P1 | 幂等防重 | 同一业务重复提交不应重复记账 |

## 5.6 多角色展示一致性（UI差异）

| 用例ID | 优先级 | 页面 | 角色 | 预期差异 |
|---|---|---|---|---|
| DP-ROLE-001 | P0 | P端租户管理 | platform_admin vs company_admin | platform 可管理多租户，company 仅本租户 |
| DP-ROLE-002 | P0 | B端客户列表 | agent vs team_lead | agent 仅本人客户，team_lead 本团队客户 |
| DP-ROLE-003 | P1 | C端学习/活动/商城 | customer | 仅本租户 company_admin 上架内容 |
| DP-ROLE-004 | P1 | P端内容模板可见性 | platform/company/agent | 符合模板可见规则 |

## 6. 数据核对清单（SQL/API）

若联调环境可直接访问 PostgreSQL，建议执行如下核对。

## 6.1 事件明细核对

```sql
-- C端学习事件
select tenant_id, actor_id, event_name, created_at
from p_track_events
where tenant_id = 1
  and actor_type = 'customer'
  and event_name in ('c_learning_enter','c_learning_open_detail','c_learning_view_course')
order by created_at desc
limit 50;
```

## 6.2 分享计数核对

```sql
-- 日计数表
select stat_date, metric_key, actor_id, cnt
from p_metric_counter_daily
where tenant_id = 1
  and stat_date = '2026-02-27'
  and metric_key in ('c_share_success_cnt','b_share_success_cnt')
order by metric_key, actor_id;
```

## 6.3 UV核对

```sql
select stat_date, metric_key, actor_id
from p_metric_uv_daily
where tenant_id = 1
  and stat_date = '2026-02-27'
  and metric_key in ('c_dau','b_dau')
order by metric_key, actor_id;
```

## 7. 缺陷分级与阻断标准

- S1（阻断上线）：跨租户数据泄露、积分账不平、规则输出错误导致业务决策错误。
- S2（高）：关键轨迹缺失、指标口径不一致、角色可见范围错误。
- S3（中）：展示文案错误、排序/筛选细节问题。

阻断发布条件（任何一条满足即阻断）：
1. 任一 S1 未关闭。  
2. P0 用例通过率 < 100%。  
3. 数据准确性抽检（事件/指标/标签）任一链路不一致。

## 8. 测试报告输出模板（本轮必须产出）

1. 执行概览：总用例、通过、失败、阻塞、跳过。  
2. 角色权限报告：每角色可见范围是否符合预期。  
3. 数据准确性报告：
- 事件准确率
- 指标准确率
- 标签规则准确率（固定值/映射值分开）
4. 差异清单：UI值 vs API值 vs 数据层值。  
5. 风险结论：是否允许发布、发布后监控建议。

## 9. 本轮执行建议（先测什么）

1. 先跑权限与租户隔离：`DP-AUTH-*`、`DP-ROLE-*`。  
2. 再跑主链路并采集事件：C端学习/活动/兑换/分享。  
3. 回查 B端轨迹 + P端指标。  
4. 最后跑标签规则（固定值 + 映射值）执行与日志核验。

