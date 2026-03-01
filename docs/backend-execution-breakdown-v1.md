# 后端改造任务拆解表（v1）

更新时间：2026-02-23
周期：2周（10个工作日）
目标：保障C端主流程（实名、活动、积分、商城、兑换、我的）可上线。

## 1. 角色分工

- TL（技术负责人）：技术裁决、风险清障、发布决策
- BE1（后端主程）：认证/活动/积分链路改造
- BE2（后端工程师）：商城/兑换/保单/学习链路改造
- DBA（可兼职）：DDL、索引、备份恢复
- DevOps：环境、CI/CD、监控告警
- QA：联调回归、压测与发布验收

## 2. 按天排期（D1-D10）

| Day | 负责人 | 任务 | 产出物 | 验收标准 |
|---|---|---|---|---|
| D1 | TL/BE1/DBA | 建立模块化目录与数据库连接层；落地Prisma迁移框架 | 基础工程PR、首个迁移文件 | 本地可启动，迁移可执行 |
| D1 | DevOps | 准备test/staging变量模板与密钥管理 | 环境模板、部署脚本 | staging可部署空服务 |
| D2 | DBA/BE1 | 建核心表（users/points/mall/redemption/audit/outbox） | DDL PR | 迁移成功，约束与索引生效 |
| D2 | BE2 | 迁移脚本框架（db.json -> PostgreSQL） | `scripts/migrate-v1.*` | 可导入样例数据 |
| D3 | BE1 | 实名与鉴权链路改造（send-code/verify-basic/me） | Auth模块PR | 契约测试通过，无字段语义变化 |
| D3 | BE2 | 活动与签到接口改造（activities/sign-in/complete） | Activity模块PR | 幂等与实名拦截通过 |
| D4 | BE1 | 积分账户与流水统一记账服务 | Points模块PR | 余额=流水净额校验通过 |
| D4 | BE2 | 商城/兑换/核销接口改造 | Mall+Redemption PR | 核销防重、过期状态正确 |
| D5 | BE2 | 学习与保单接口改造（courses/insurance） | Learning+Insurance PR | OpenAPI响应结构一致 |
| D5 | QA | 第一次端到端联调回归 | 联调报告v1 | C端核心页面可跑通 |
| D6 | DevOps/BE1 | 接入Prometheus/Sentry/结构化日志 | 监控PR、告警规则 | 有可用仪表盘与告警 |
| D6 | DBA | 备份策略与恢复脚本落地 | 备份配置、恢复手册 | 可执行恢复演练 |
| D7 | BE1/BE2 | 性能与SQL调优（签到/兑换/核销） | 调优PR | 关键接口P95<=800ms |
| D7 | QA | 并发冲突专项（幂等/库存/核销） | 测试报告v2 | 无重复发放/重复核销 |
| D8 | DevOps | staging全量发布 + 冒烟 | 发布记录 | 冒烟通过率100% |
| D8 | TL | Go/No-Go评审（风险、缺陷、回滚预案） | 评审结论 | 无P0/P1阻断 |
| D9 | 全员 | 生产发布演练（含回滚） | 演练记录 | 回滚在60分钟内完成 |
| D10 | 全员 | 正式发布 + 48小时值守计划 | 发布公告、值守表 | 核心链路稳定，无重大告警 |

## 3. 并行工作包（避免阻塞）

- 工作包A（BE1）：Auth + Activity + Points
- 工作包B（BE2）：Mall + Redemption + Learning + Insurance
- 工作包C（DBA）：Schema + 索引 + 备份恢复
- 工作包D（DevOps）：CI/CD + 监控告警 + 环境
- 工作包E（QA）：契约回归 + E2E + 压测

## 4. 每日完成定义（DoD）

- 代码已合并并通过CI（lint/unit/contract）。
- 接口示例已更新，契约检查通过。
- 关键日志与错误码可观测。
- 至少1条自动化测试覆盖新增逻辑。

## 5. 风险闸门

- 任何破坏`openapi-c-v1.yaml`语义的PR直接拒绝。
- 关键链路（签到/兑换/核销）没有自动化测试不得进入staging。
- 未完成备份恢复演练不得发布生产。

## 6. 每日站会模板（15分钟）

1. 昨日完成与未完成项
2. 当日目标与阻塞
3. 风险变化（新增/升级/关闭）
4. 是否触发范围控制（仅保C端P0）

