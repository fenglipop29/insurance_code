# 埋点事件方案（v2，可落地版）

更新时间：2026-02-27  
适用范围：C/B/P 三端（H5）+ 本地 API（Express）

## 1. 目标与范围

- 统一三端埋点协议，避免 C/B/P 口径分裂。
- 与现有后端接口保持兼容：继续使用 `POST /api/track/events`。
- 支撑指标看板、漏斗分析、行为追踪与异常排查。
- 控制合规风险：最小化敏感字段、服务端采集来源信息。

## 2. 与旧版方案差异

- 沿用接口路径：`/api/track/events`（不再使用 `/api/event/track`）。
- 事件主键从 `event_id + event_name` 升级为 `event_key + event_version`。
- 增加去重与时序字段：`event_uuid`、`client_time`、`server_time`、`session_id`。
- 增加质量治理：白名单校验、字段长度限制、采集失败监控。

## 3. 统一上报协议

### 3.1 Endpoint

- `POST /api/track/events`

### 3.2 Headers

- `Content-Type: application/json`
- `x-client-source`: `c-web` / `b-web` / `p-web`
- `x-client-path`: 页面路径（如 `/activities`）
- `x-request-id`: 可选，链路追踪

### 3.3 Request Body（v2）

```json
{
  "event_key": "c_sign_in_success",
  "event_version": 1,
  "event_uuid": "1d7f7a56-7453-4db4-82a4-4662a4ebd142",
  "client_time": "2026-02-27T14:00:12.321Z",
  "session_id": "web-9f8a1d2c",
  "properties": {
    "reward": 10,
    "balance": 220,
    "from_tab": "home"
  }
}
```

### 3.4 Response

```json
{ "ok": true }
```

## 4. 字段定义（服务端统一入库）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint | 是 | 自增主键 |
| `tenant_id` | bigint | 是 | 租户ID |
| `actor_type` | text | 是 | `customer/agent/employee/anonymous` |
| `actor_id` | bigint | 是 | 用户ID，匿名时为0 |
| `org_id` | bigint | 是 | 组织ID |
| `team_id` | bigint | 是 | 团队ID |
| `event_key` | text | 是 | 事件编码（唯一语义） |
| `event_version` | int | 是 | 事件版本 |
| `event_uuid` | uuid/text | 是 | 客户端生成去重ID |
| `client_time` | timestamptz | 是 | 客户端时间 |
| `server_time` | timestamptz | 是 | 服务端接收时间 |
| `session_id` | text | 否 | 会话ID |
| `path` | text | 否 | 页面路径 |
| `source` | text | 是 | 端标识（c-web/b-web/p-web） |
| `user_agent` | text | 否 | UA |
| `ip_hash` | text | 否 | 服务端计算后的IP哈希，不存明文IP |
| `channel` | text | 否 | 渠道参数（utm/微信场景） |
| `properties` | jsonb | 否 | 扩展属性（白名单+限长） |
| `created_at` | timestamptz | 是 | 记录创建时间 |

## 5. 事件命名规范

- 格式：`{端}_{对象}_{动作}_{结果}`  
  - 示例：`c_sign_in_success`、`b_content_publish_success`、`p_tenant_create_failed`
- 规则：
  - 全小写，下划线分隔。
  - 禁止中文事件名入库。
  - 同一语义变更属性结构时，`event_version +1`。

## 6. 核心事件清单（v2）

### 6.1 C端

- `c_page_view`：页面浏览
- `c_auth_verified`：基础身份确认成功
- `c_sign_in_success` / `c_sign_in_repeat` / `c_sign_in_failed`
- `c_redeem_submit` / `c_redeem_success` / `c_redeem_failed`
- `c_learning_detail_view`
- `c_learning_complete_success` / `c_learning_complete_failed`
- `c_activity_complete_success` / `c_activity_complete_failed`
- `c_share_click` / `c_share_success` / `c_share_failed`

### 6.2 B端

- `b_login_success` / `b_login_failed`
- `b_page_view`
- `b_customer_tag_bind_success`
- `b_content_create_success`
- `b_activity_create_success`
- `b_tools_share_attempt` / `b_tools_share_cancel` / `b_tools_share_success` / `b_tools_share_failed`
- `b_order_writeoff_success` / `b_order_writeoff_failed`

### 6.3 P端

- `p_login_success` / `p_login_failed`
- `p_page_view`
- `p_tenant_create_success`
- `p_employee_create_success`
- `p_mall_product_create_success`
- `p_metric_rule_create_success` / `p_metric_rule_update_success`
- `p_reconciliation_run_success` / `p_reconciliation_run_failed`

## 7. 属性治理规则

- 通用限制：
  - `properties` 仅允许对象，禁止数组/超深层嵌套（最大2层）。
  - 每个事件属性键不超过 40 字符，值不超过 200 字符（字符串）。
  - 单条事件 `properties` 序列化后不超过 4KB。
- 敏感信息：
  - 禁止上传手机号、身份证号、姓名明文。
  - 必要时使用脱敏字段（如 `mobile_masked`）或 ID 引用。

## 8. 数据库与索引建议

当前系统已有 `p_track_events`，建议增量迁移字段，不做破坏性变更。

### 8.1 DDL 增量建议

```sql
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS event_key TEXT;
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS event_version INT NOT NULL DEFAULT 1;
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS event_uuid TEXT;
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS client_time TIMESTAMPTZ;
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS server_time TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE p_track_events ADD COLUMN IF NOT EXISTS channel TEXT;
```

### 8.2 索引建议

```sql
CREATE INDEX IF NOT EXISTS idx_track_tenant_server_time ON p_track_events(tenant_id, server_time DESC);
CREATE INDEX IF NOT EXISTS idx_track_actor_server_time ON p_track_events(actor_id, server_time DESC);
CREATE INDEX IF NOT EXISTS idx_track_event_server_time ON p_track_events(event_key, server_time DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_track_event_uuid ON p_track_events(event_uuid) WHERE event_uuid IS NOT NULL;
```

## 9. 前后端落地清单

### 9.1 前端（C/B/P）

- SDK 封装统一 `trackEvent(payload)`，自动补齐：
  - `event_uuid`
  - `client_time`
  - `session_id`
  - `x-client-source` / `x-client-path`
- 业务代码只传：
  - `event_key`
  - `properties`

### 9.2 后端

- 在 `/api/track/events` 增加：
  - `event_key` 到 `event` 的兼容映射（过渡期）
  - `event_uuid` 去重（可选开关）
  - 字段白名单校验与长度限制
  - `server_time` 强制写入
  - `ip_hash` 由服务端计算并入库

## 10. 迁移策略（v1 -> v2）

1. 第1阶段（兼容期，1周）：
   - 接口同时接受 `event`（旧）和 `event_key`（新）。
   - 服务端统一落地为 `event_key`（旧字段映射过来）。
2. 第2阶段（切换期，1周）：
   - 三端 SDK 全量改为只发 `event_key`。
   - 监控旧字段调用比例，降到 0 后清理兼容逻辑。
3. 第3阶段（治理期）：
   - 启用严格校验与拒绝脏数据策略。

## 11. 质量与监控

- 采集质量核心指标：
  - 事件上报成功率（>= 99.9%）
  - 重复事件率（<= 0.5%）
  - 事件延迟P95（<= 5s）
  - 空属性率、非法属性率
- 告警阈值：
  - 连续5分钟成功率 < 99%
  - 任一核心事件（签到/兑换/学习完成）10分钟无数据

## 12. 与当前项目的映射关系

- 现有文档：`tracking-events-v1.md` 保留用于历史兼容。
- 新规范：本文件作为主规范。
- 指标口径文档 `metric-definition-v1.md` 中依赖 `p_track_events` 的指标，统一按本规范取数字段。
