# 保云链 Java 后端架构可执行方案 v1

更新时间：2026-02-28  
适用范围：P/B/C 三端统一后端能力建设与迁移落地（规划态，当前不执行）

## 1. 结论先行

- 后端改用 Java 是可行的，但不是“简单平移”，属于中高难度改造。
- 如果采用“兼容优先、分阶段迁移”，风险可控；如果一次性整体切换，风险高。
- 建议路线：`单体 Node 继续承接业务 -> Java 服务按域并行建设 -> 网关灰度切流 -> 最终退役 Node`。
- 当前执行决策以 Node 模块化单体为主线，见 `docs/adr-0001-architecture-decision.md`。

## 2. 当前现状（基线）

- 现有后端：Node.js + Express（原型演进形态）
- 数据：PostgreSQL（主），JSON 文件兜底
- 三端能力：
  - C：注册登录、学习、活动、积分商城、埋点
  - B：客户、内容、活动、商城、客户轨迹
  - P：租户、员工、权限、指标、事件、标签规则
- 风险点：
  - 业务与路由耦合仍较重
  - 多租户和权限已有实现，但缺少统一工程规范与强约束落地

## 3. 目标 Java 架构（To-Be）

### 3.1 技术栈

- Java 21 LTS
- Spring Boot 3.x
- Spring Security + JWT
- MyBatis-Plus（或 JPA，二选一，建议 MyBatis-Plus）
- PostgreSQL 16
- Redis 7
- Kafka（或 RabbitMQ，建议 Kafka）
- Flyway（数据库版本迁移）
- OpenAPI 3.1（接口契约）
- Testcontainers（集成测试）

### 3.2 服务拆分（第一阶段按 3 个服务）

1. `identity-service`
- 租户、组织、团队、员工、角色权限、登录会话
- 租户上下文注入、数据范围判定

2. `engagement-service`
- 客户、学习资料、活动、商城、积分、核销
- 兑换/核销事务链路

3. `intelligence-service`
- 埋点事件、指标聚合、标签规则、规则任务

### 3.3 网关层

- Spring Cloud Gateway
- 职责：鉴权、限流、租户上下文标准化、灰度路由、审计入口

## 4. 领域边界与模块职责

### 4.1 identity-service

- Auth 模块：登录、token/refresh、csrf token
- Tenant 模块：租户管理、tenant code 映射
- IAM 模块：角色、权限、数据范围（tenant/team/owner）
- Staff 模块：员工、团队、组织维护

### 4.2 engagement-service

- Customer 模块：客户归属、客户档案
- Learning 模块：资料管理、学习记录
- Activity 模块：活动模板、参与记录
- Mall 模块：商品、兑换订单、核销记录
- Points 模块：积分账户、流水、幂等扣增

### 4.3 intelligence-service

- Event 模块：事件字典、事件采集
- Metric 模块：指标定义、日聚合、小时聚合
- Tag 模块：标签定义、规则 DSL、规则任务、命中日志

## 5. 数据设计与约束（关键）

### 5.1 强制字段

- 所有业务主表必须有：
  - `tenant_id`
  - `created_at`
  - `updated_at`
  - `is_deleted`（逻辑删除）

### 5.2 强制唯一约束

- 员工账号：`uniq(tenant_id, email)` / `uniq(tenant_id, mobile)`
- 客户账号：`uniq(tenant_id, mobile)`
- 幂等记录：`uniq(tenant_id, biz_type, biz_key)`
- 指标计数：`uniq(tenant_id, stat_date, metric_key, actor_id)`

### 5.3 事务/一致性规则

- 兑换链路（扣积分+扣库存+建订单+建核销码）
  - 同库强事务优先
  - 跨服务场景走 Outbox + 可靠事件 + 补偿任务

## 6. 缓存策略（明确）

### 6.1 Redis 缓存

- 用户会话：15~30 分钟（滑动过期）
- 权限矩阵：5 分钟（角色更新主动失效）
- 租户与团队基础信息：10 分钟
- 商品/活动只读列表：60 秒

### 6.2 前端缓存

- 仅缓存低敏读数据（如积分摘要、个人概览），TTL 30 秒
- 写操作统一触发本地缓存失效
- Token 仅 `sessionStorage`（不落 localStorage）

### 6.3 图片与静态资源

- 上传至对象存储（OSS/MinIO）
- 通过 CDN 回源，文件名 hash 化
- 缓存头：`Cache-Control: public, max-age=31536000, immutable`

## 7. 安全基线（必做）

### 7.1 认证鉴权

- JWT + 短期 Access Token + 刷新机制
- 所有写接口 CSRF 校验（`x-csrf-token`）
- 敏感操作二次确认（`x-action-confirm: YES`）

### 7.2 数据安全

- 手机号等敏感字段加密（AES-GCM）
- 日志统一脱敏（手机号、证件号）
- SQL 参数化，禁拼接

### 7.3 业务安全

- 签到/兑换/核销/客户分配接口限频
- 幂等键 mandatory
- 操作审计 mandatory

## 8. 自动化测试体系

### 8.1 测试层次

- 单元测试：Service 层（规则引擎、积分扣增、可见性判断）
- 集成测试：Controller + DB + Redis（Testcontainers）
- 合约测试：OpenAPI 对比（前后端契约）
- E2E：Playwright（P/B/C 关键链路）

### 8.2 覆盖率建议

- Service 核心逻辑 >= 80%
- 关键流程（登录、分配、兑换、核销、标签任务）必须有集成测试

## 9. 迁移策略（推荐）

### 阶段 0：冻结契约（1 周）

- 冻结当前 API 契约（OpenAPI）
- 冻结错误码与字段命名
- 建立 shared-contracts

### 阶段 1：Java 基础设施落地（2 周）

- 建 Java 工程骨架、网关、统一异常、审计、鉴权中间件
- 落 Flyway、Redis、监控、日志

### 阶段 2：先迁 identity-service（2~3 周）

- 登录、租户、员工、权限全部迁 Java
- 前端无感：接口兼容

### 阶段 3：迁 engagement-service（3~4 周）

- 客户、学习、活动、商城、积分、核销迁移
- 兑换链路做事务与补偿压测

### 阶段 4：迁 intelligence-service（3~4 周）

- 埋点、指标、标签规则迁移
- 事件与指标口径双跑对账（Node vs Java）

### 阶段 5：灰度切流与退役（1~2 周）

- 租户级灰度
- 全量后退役 Node 原后端

## 10. 难度评估（你问的重点）

### 10.1 总体难度

- 难度：**中高（7.5/10）**
- 原因：
  - 不是新建系统，而是“在线迁移 + 三端兼容 + 数据正确性”
  - 租户/权限/积分/标签属于高耦合高风险链路

### 10.2 人力建议（最小可行）

- 后端 Java：2~3 人
- 前端联调：1 人
- 测试：1 人
- 运维/DBA（兼职）：0.5 人

### 10.3 工期建议（保守）

- MVP 可联调：6~8 周
- 稳定可上线：10~14 周

### 10.4 高风险点

1. 权限与数据隔离回归不足导致越权
2. 兑换/核销链路事务不一致
3. 事件-指标-标签口径不一致
4. 一次性切换导致生产不稳定

## 11. 验收标准（上线门槛）

- 回归通过：P/B/C 主链路 100% 通过
- 数据正确：双跑对账误差 <= 0.1%
- 性能：
  - 登录/列表 P95 <= 800ms
  - 签到/兑换/核销 P95 <= 500ms
- 可观测：全链路 Trace + 报警 + 审计可检索

## 12. 你现在最优执行顺序

1. 先不急着“全部改 Java”，先把 API 契约冻结。
2. 先迁 identity（风险最低，收益最大）。
3. engagement 和 intelligence 分开迁，避免大爆炸。
4. 每阶段都要“浏览器回归 + 数据对账”双验收。
