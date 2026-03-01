# insurance_code 可落地架构方案（v1执行版）

更新时间：2026-02-23
适用范围：C端优先上线（实名、活动、积分、商城、兑换、我的），B/P端仅保留不阻塞C端的最小运营能力。
约束基线：以 `./openapi-c-v1.yaml` 为冻结契约，不改变既有字段语义。

## 1. v1 架构目标与非目标

### 1.1 2周目标（必须达成）
- C端主流程可上线，接口稳定，前后端联调不阻塞。
- 将后端从 `Express + db.json` 迁移到 `Express(模块化) + PostgreSQL + Redis`。
- 建立最小生产能力：迁移机制、发布回滚、监控告警、安全基线、审计日志。

### 1.2 非目标（v1不做）
- 不拆分微服务，不引入跨团队复杂中间件（如Kafka集群）。
- 不变更C端冻结接口路径/字段语义。
- 不在v1完成B/P全量业务，仅提供运营必需后台能力。

## 2. 关键架构决策（含取舍）

| 领域 | v1决策 | 取舍理由 | v2演进 |
|---|---|---|---|
| 应用架构 | 保持单体，按域模块化（auth/activity/points/mall/redemption/learning/insurance/profile） | 2周内改造风险最低，最利于保住联调节奏 | 按域拆成独立服务 |
| 后端框架 | 继续 Express，但落地 TypeScript + 分层（router/service/repo） | 与现有代码兼容，重写成本低于迁Nest | 可迁NestJS（代码结构已兼容） |
| 数据库 | PostgreSQL 16（主库） | 事务、约束、索引和JSON能力更稳，适配积分/核销一致性 | 读写分离、分区表 |
| ORM/迁移 | Prisma + Prisma Migrate | 迁移可追踪，开发效率高，适合小团队2周交付 | Flyway/Liquibase可替换 |
| 缓存 | Redis 7 | 登录态、验证码频控、热点缓存、短锁 | Redis Cluster |
| 消息 | BullMQ(基于Redis) + Outbox表 | 比独立MQ更快落地，仍有异步能力与重试 | 替换为Kafka/RabbitMQ |
| 对象存储 | S3兼容对象存储（阿里OSS/COS均可） | 保单图片/OCR原件必须外置，避免DB膨胀 | 多Region存储 |
| 鉴权 | JWT Bearer（短期Access Token）+ 实名状态拦截中间件 | 与现有`Authorization: Bearer`一致 | Refresh Token + 设备管理 |
| 审计 | `audit_logs` 强制落库（实名、积分、兑换、核销、保单） | 满足可追溯与风控 | 接入SIEM |
| 监控 | Prometheus指标 + 结构化日志 + Sentry异常告警 | 最小可观测闭环，投入小收益大 | OTel全链路追踪 |

## 3. v1 运行时边界与职责

### 3.1 模块边界（单体内）
- `auth`：验证码发送、实名登录、`is_verified_basic`维护。
- `activity`：活动列表、任务完成、签到。
- `points`：积分账户与流水，统一记账入口。
- `mall`：商品浏览、库存校验、兑换创建。
- `redemption`：兑换记录、核销、过期处理。
- `learning`：课程、完成领积分、游戏/工具列表。
- `insurance`：保单总览、列表、详情、扫描、新增。
- `profile`：我的页聚合查询（调用上述域只读能力）。
- `ops-admin`（最小）：活动/课程/商品上架与排序。

### 3.2 跨模块统一能力
- `middleware/auth`: JWT解析、用户上下文注入。
- `middleware/verify-gate`: 在签到/兑换/领奖前校验 `is_verified_basic=true`。
- `middleware/idempotency`: 对积分发放/核销写操作做幂等。
- `observability`: trace_id、请求日志、慢查询日志、指标。

## 4. C端关键链路实现标准

### 4.1 实名拦截链路
1. 写接口进入`verify-gate`。
2. 未实名返回 `403 + NEED_BASIC_VERIFY`（不改现有语义）。
3. 前端拉起实名，成功后重放操作。
负责人建议：后端负责人A，前端负责人B，联调负责人C。

### 4.2 积分记账链路（强一致）
1. 业务事件（签到/任务/课程完成/兑换）进入统一`points_service`。
2. 事务内执行：幂等检查 -> 更新`point_accounts.balance` -> 插入`point_transactions`。
3. 同事务写`outbox_events`供异步通知。
负责人建议：后端负责人A，DB负责人D。

### 4.3 兑换核销链路（防重复）
1. 兑换时事务扣减积分和库存，生成唯一`writeoff_token`。
2. 核销时 `SELECT ... FOR UPDATE` 锁定订单行。
3. 已核销/过期返回409/410，成功后写核销日志。
负责人建议：后端负责人A，测试负责人E。

## 5. 2周执行计划（可直接排期）

### 第1周
- D1-D2：完成PostgreSQL/Redis接入，建表与迁移框架。
- D3-D4：实名、活动、积分、商城、兑换全链路改造到新库。
- D5：保单与学习模块改造，保持OpenAPI响应结构不变。

### 第2周
- D6-D7：灰度联调（前端全页面回归），修复契约偏差。
- D8：部署staging，压测核心接口（签到、兑换、核销）。
- D9：安全与观测基线验收（频控、审计、告警）。
- D10：生产发布与回滚演练。

## 6. 组织分工建议（RACI简版）

- 架构与技术裁决：技术负责人/架构师（A）
- 后端改造与迁移：后端负责人（R）
- 数据库与备份恢复：DBA/后端高级工程师（R）
- 前端联调与验收：前端负责人（R）
- 发布与监控：DevOps（R）
- 回归与冒烟：QA（R）

## 7. 上线门禁（Go/No-Go）

- `openapi-c-v1.yaml` 合约测试通过率 100%。
- 核心路径（实名->签到->积分->兑换->核销）自动化通过。
- 无 P0/P1 未关闭缺陷。
- 备份恢复演练通过（RPO<=15min，RTO<=60min）。
- 告警链路可用（5xx、延迟、数据库连接、Redis不可用）。
