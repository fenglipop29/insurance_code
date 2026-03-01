# 微服务改造测试用例文档（V2）

更新时间：2026-02-26  
适用范围：`insurance_code` 从“模块化单体（v1）”演进到“按域微服务（v2）”的测试设计与发布验收。  
关联文档：
- `./architecture.md`
- `./architecture-v1-execution.md`
- `./openapi-c-v1.yaml`

## 1. 测试目标与范围

### 1.1 目标
- 验证微服务拆分后，C/B/P 核心业务功能与 v1 语义一致。
- 验证跨服务链路（实名、签到、积分、兑换、核销、保单）在并发与故障下仍正确。
- 验证数据从旧模式迁移到正式业务表后，结果可追溯、可对账、可回滚。

### 1.2 范围
- 入口层：API Gateway（鉴权、限流、租户上下文、路由转发）。
- 领域服务：Auth、Activity、Points、Mall、Redemption、Learning、Policy、Profile、B/P Admin。
- 基础设施：PostgreSQL、Redis、Outbox/Event Bus、对象存储、监控告警。
- 端到端场景：C 端主流程 + B/P 运营最小流程。

### 1.3 不在本轮范围
- 非核心页面像素级 UI 还原。
- BI 数仓高级分析报表口径校准。

## 2. V2 目标架构测试对象（逻辑）

- `gateway-service`
- `auth-service`
- `activity-service`
- `points-ledger-service`
- `mall-order-service`
- `redemption-service`
- `learning-service`
- `policy-service`
- `profile-aggregation-service`
- `b-admin-service`
- `p-admin-service`
- `event-bus + outbox-worker`

## 3. 测试分层策略

1. 单元测试（服务内）：领域规则、幂等、库存扣减、积分记账函数。
2. 合约测试（服务间）：OpenAPI/Pact，保证字段与错误码稳定。
3. 集成测试（服务+DB+Redis）：事务、锁、补偿、消息消费。
4. E2E 测试（前后端）：实名 -> 签到 -> 积分 -> 兑换 -> 核销。
5. 非功能测试：性能、容量、故障注入、安全、可观测性。

## 4. 环境与数据准备

### 4.1 环境
- `dev`: 本地联调。
- `staging`: 全链路准生产验证（必须跑完整回归）。
- `prod`: 灰度发布（按租户/用户分批）。

### 4.2 基础数据
- 租户：`tenant_a`, `tenant_b`（用于隔离测试）。
- 用户：实名用户、未实名用户、B端运营用户、P端管理员。
- 积分账户：0、200、3000 三档。
- 商城商品：低价（59/99）、中价（299）、高价（1200）三档。

### 4.3 测试前置脚本
- 建议提供：`seed_v2_minimal.sql`、`seed_v2_full.sql`、`reset_v2_state.sql`。
- 每轮回归前强制清理幂等记录和临时测试订单。

## 5. 详细测试用例（核心）

字段说明：`优先级` P0/P1/P2；`类型` Contract/Integration/E2E/Perf/Sec/Chaos。

| 用例ID | 优先级 | 类型 | 场景 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|---|---|
| MSV2-API-001 | P0 | Contract | Gateway 健康检查 | 服务启动 | GET `/api/health` | 200，返回 `ok=true` |
| MSV2-API-002 | P0 | Contract | C 端冻结契约兼容 | 已导入 v1 OpenAPI | 跑 contract test | 兼容通过率 100% |
| MSV2-AUTH-001 | P0 | E2E | 发送验证码 | 手机号合法 | POST `/api/auth/send-code` | 200，返回 `ok=true` |
| MSV2-AUTH-002 | P0 | E2E | 实名登录成功 | 已发送验证码 | POST `/api/auth/verify-basic` | 返回 token + `is_verified_basic=true` |
| MSV2-AUTH-003 | P1 | Sec | 验证码频控 | 同手机号连续请求 | 1 分钟内请求 10 次 | 触发 429 |
| MSV2-AUTH-004 | P0 | Sec | 未实名门禁 | 未实名 token | 调用签到/兑换 | 返回 403 `NEED_BASIC_VERIFY` |
| MSV2-ACT-001 | P0 | E2E | 签到发积分 | 已实名用户余额 200 | POST `/api/sign-in` | 返回 reward；余额增加；写流水 |
| MSV2-ACT-002 | P0 | Integration | 重复签到幂等 | 当日已签到 | 再次 POST `/api/sign-in` | 409 `ALREADY_SIGNED` |
| MSV2-ACT-003 | P1 | Integration | 活动任务完成发积分 | 存在可完成任务 | POST `/api/activities/:id/complete` | 余额增加且仅一次 |
| MSV2-PTS-001 | P0 | Integration | 积分记账原子性 | 余额 260 | 触发 +10 记账 | account 与 transaction 同事务成功 |
| MSV2-PTS-002 | P0 | Integration | 积分跨页面一致性 | 已登录 | 访问 `/api/me`、`/api/activities`、`/api/points/summary` | 三处余额一致 |
| MSV2-PTS-003 | P0 | E2E | 积分商城余额一致 | 已登录 | 打开“我的”与“积分商城” | 显示同一余额 |
| MSV2-PTS-004 | P0 | Regression | 30秒后余额不回落 | 初始余额 260 | 页面停留 30 秒并自动刷新 | 余额不从 260 变 0 |
| MSV2-PTS-005 | P1 | Integration | 负积分防护 | 余额 50 | 兑换 99 分商品 | 409 `INSUFFICIENT_POINTS` |
| MSV2-MALL-001 | P0 | E2E | 商品列表可用 | 匿名访问 | GET `/api/mall/items` | 200，列表非空 |
| MSV2-MALL-002 | P0 | Integration | 低分商品可兑换 | 余额 260，商品 59 分 | POST `/api/mall/redeem` | 兑换成功，余额扣减正确 |
| MSV2-MALL-003 | P0 | Integration | 兑换库存扣减 | 商品库存 N | 连续兑换 N+1 次 | 前 N 次成功，最后 `OUT_OF_STOCK` |
| MSV2-MALL-004 | P0 | Integration | 兑换事务回滚 | 注入扣积分后下单失败 | 执行兑换 | 余额和库存均回滚 |
| MSV2-MALL-005 | P1 | Chaos | Mall 服务超时补偿 | 人为注入 3s 延迟 | 发起兑换 | 订单最终状态一致（成功或补偿关闭） |
| MSV2-RED-001 | P0 | E2E | 兑换记录查询 | 已有兑换单 | GET `/api/redemptions` | 返回新订单 |
| MSV2-RED-002 | P0 | Integration | 核销成功 | 有效 token | POST `/api/redemptions/:id/writeoff` | 200，状态变已核销 |
| MSV2-RED-003 | P0 | Integration | 重复核销拦截 | 已核销订单 | 再次核销 | 409 `ALREADY_WRITTEN_OFF` |
| MSV2-RED-004 | P1 | Integration | 过期 token 拦截 | token 过期 | 核销 | 410 `TOKEN_EXPIRED` |
| MSV2-LEARN-001 | P1 | E2E | 学习课程列表 | 匿名访问 | GET `/api/learning/courses` | 200，课程非空 |
| MSV2-LEARN-002 | P1 | Integration | 完课发积分幂等 | 已实名用户 | 连续提交完课两次 | 仅一次积分发放 |
| MSV2-POL-001 | P0 | E2E | 保障总览与我的保单一致 | 用户有 7 份保单 | 访问保障页与我的页 | 在保数量一致（均为 7） |
| MSV2-POL-002 | P1 | Integration | 我的保单跳转 | 我的页面可见入口 | 点击“我的保单” | 跳转到保障管理/保单页 |
| MSV2-POL-003 | P1 | Integration | OCR上传流程 | 上传图片文件 | POST `/api/insurance/policies/scan` | 返回解析结果并记录作业 |
| MSV2-BADM-001 | P1 | Integration | B端核销权限 | B端运营角色 | 执行核销 | 成功并有审计日志 |
| MSV2-BADM-002 | P1 | Sec | B端越权隔离 | tenant_a 用户 | 访问 tenant_b 客户 | 403 |
| MSV2-PADM-001 | P1 | Integration | P端审批流程 | 管理员角色 | 发起并审批请求 | 状态流转完整，写审计 |
| MSV2-PADM-002 | P1 | Sec | 高危操作审计 | 执行退款/改价 | 查询审计日志 | 有 trace_id、actor、before/after |
| MSV2-EVT-001 | P0 | Integration | Outbox 发布成功 | 触发积分事件 | 检查 outbox + 消费结果 | 事件仅消费一次 |
| MSV2-EVT-002 | P0 | Integration | 消费失败重试 | 人为让 consumer 失败 2 次 | 观察重试与死信 | 达到重试上限后入 DLQ |
| MSV2-EVT-003 | P1 | Chaos | 消息重复投递 | 注入重复消息 | 消费处理 | 业务状态不重复变更 |
| MSV2-MIG-001 | P0 | Integration | 历史数据迁移校验 | 执行迁移脚本 | 比较迁移前后总量 | 关键表计数一致 |
| MSV2-MIG-002 | P0 | Integration | 余额对账 | 有历史流水 | 聚合 transaction 对比 account | 全量用户差异为 0 |
| MSV2-MIG-003 | P0 | Chaos | 迁移回滚演练 | staging 环境 | 执行迁移后回滚 | 业务可恢复且无脏数据 |
| MSV2-PERF-001 | P0 | Perf | 核心接口延迟 | 200 RPS | 压测 `/api/sign-in` `/api/mall/redeem` | P95 <= 500ms |
| MSV2-PERF-002 | P1 | Perf | 页面聚合接口 | 150 RPS | 压测 `/api/me` `/api/activities` | P95 <= 800ms |
| MSV2-PERF-003 | P1 | Perf | 峰值并发兑换 | 500 并发 | 同商品并发兑换 | 无超卖，错误码正确 |
| MSV2-OBS-001 | P0 | Integration | Trace 可追踪 | 发起一次兑换 | 查看日志链路 | Gateway->Mall->Points 全链路同 trace_id |
| MSV2-OBS-002 | P1 | Integration | 告警可用性 | 注入 5xx 峰值 | 触发告警规则 | 5 分钟内收到告警 |
| MSV2-SEC-001 | P0 | Sec | JWT 鉴权 | 无 token | 调用受保护接口 | 401 |
| MSV2-SEC-002 | P0 | Sec | 参数校验 | itemId 非法 | 调用兑换 | 400 |
| MSV2-SEC-003 | P1 | Sec | SQL注入/XSS | 传恶意 payload | 调用搜索/文本接口 | 请求被拦截或转义存储 |
| MSV2-REL-001 | P0 | Chaos | 单服务重启可恢复 | 重启 points 服务 | 执行签到与兑换 | 网关可用，最终一致 |
| MSV2-REL-002 | P1 | Chaos | Redis 短暂不可用 | 断开 Redis 30s | 观察关键接口 | 可降级，不发生错账 |

## 6. 自动化落地建议

1. 合约测试：Schemathesis（OpenAPI）+ Pact（服务间）。
2. 接口回归：Newman 或 k6 + JS assertions。
3. E2E：Playwright（覆盖 C 端关键路径和 B/P 最小路径）。
4. 性能：k6（压测脚本纳入 CI nightly）。
5. 数据对账：SQL 脚本 + CI job（每日对账）。

## 7. 发布质量门禁（Go/No-Go）

### 7.1 进入灰度（Go）必须满足
- P0 用例通过率 100%。
- P1 用例通过率 >= 95%（且无未评估风险）。
- 无未关闭 P0/P1 缺陷。
- 积分余额对账差异 = 0。
- 关键链路 24 小时稳定，无 P0 告警。

### 7.2 一票否决（No-Go）
- 出现积分错账/重复扣减/重复发放。
- 出现核销重复成功或跨租户数据串读。
- 回滚演练失败或恢复后数据不一致。

## 8. 缺陷分级与响应SLA

- `P0`：业务中断/资金积分错误/数据泄露，30分钟响应，4小时止血。
- `P1`：核心流程受损，2小时响应，24小时修复。
- `P2`：功能缺陷可绕过，1个迭代内修复。

## 9. 验收输出物清单

- 测试报告：通过率、失败清单、风险说明。
- 性能报告：延迟、吞吐、资源占用。
- 对账报告：账户余额与流水一致性。
- 回滚演练报告：步骤、耗时、结果。
- 监控截图：SLI/SLO、告警触发记录。

