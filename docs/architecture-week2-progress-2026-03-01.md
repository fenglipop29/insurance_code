# 架构执行周报（Week2）- 2026-03-01

状态：`READY_FOR_REVIEW`  
范围：`insurance_code`、`insurance_code_B`、`insurance_code_P`

## 1. 本周目标

1. 消除高风险多租户越权入口（P0/P1）。
2. 完成 `p-admin.routes` 第一批模块化拆分（`tags/events/metrics`）。
3. 建立可重复执行的质量门禁命令。

## 2. 已完成事项

## 2.1 多租户与权限安全整改

1. 移除/替换高风险 `tenant/org/team=1` 兜底写入路径。
2. 收敛上下文来源，避免未登录或伪造请求头直接进入 B/P 管理接口。
3. 权限默认策略调整为“未配置即拒绝”，不再自动全开。

验证：
1. `npm run risk:check-tenant-fallback` 输出 `0 known item(s), no new regressions`。

## 2.2 p-admin 路由拆分（第一批）

从单文件拆出并接入 3 个独立路由模块：

1. `server/skeleton-c-v1/routes/p-admin-tags.routes.mjs`
2. `server/skeleton-c-v1/routes/p-admin-events.routes.mjs`
3. `server/skeleton-c-v1/routes/p-admin-metrics.routes.mjs`

主入口注册位置：

1. `server/skeleton-c-v1/routes/p-admin.routes.mjs` 中 `registerPAdminTagRoutes(...)`
2. `server/skeleton-c-v1/routes/p-admin.routes.mjs` 中 `registerPAdminMetricRoutes(...)`
3. `server/skeleton-c-v1/routes/p-admin.routes.mjs` 中 `registerPAdminEventRoutes(...)`

说明：
1. 拆分仅做模块迁移与依赖注入，不改业务口径、不改接口语义。
2. 旧内联路由已移除，避免重复注册和双维护。

## 2.3 p-admin 路由拆分（第二批）

从单文件继续拆出并接入 3 个独立路由模块：

1. `server/skeleton-c-v1/routes/p-admin-activities.routes.mjs`
2. `server/skeleton-c-v1/routes/p-admin-mall.routes.mjs`
3. `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs`

覆盖接口域：

1. 活动模板管理（`/api/p/activities`）
2. 商城模板与策略（`/api/p/mall/*`、`/api/p/strategies`）
3. 员工/团队/客户分配（`/api/p/employees`、`/api/p/teams`、`/api/p/customers*`）

## 2.4 p-admin 路由拆分（第三批）

继续拆出治理域模块：

1. `server/skeleton-c-v1/routes/p-admin-governance.routes.mjs`

覆盖接口域：

1. 租户管理（`/api/p/tenants*`）
2. 权限配置（`/api/p/permissions*`）
3. 审批流程（`/api/p/approvals*`）

## 2.5 p-admin 路由拆分（第四批，收口）

继续拆出剩余运营域模块：

1. `server/skeleton-c-v1/routes/p-admin-learning.routes.mjs`
2. `server/skeleton-c-v1/routes/p-admin-ops.routes.mjs`

覆盖接口域：

1. 学习资料模板管理（`/api/p/learning/courses*`）
2. 退款与统计对账（`/api/p/orders/:id/refund`、`/api/p/stats/*`、`/api/p/reconciliation/run`）

结果：

1. `p-admin.routes.mjs` 仅保留登录入口与模块注册编排，路由边界清晰。

## 2.6 质量门禁与文档治理

1. 文档链接检查通过：`npm run docs:check-links`
2. 三端类型检查通过：
   1. `insurance_code`: `npm run typecheck`
   2. `insurance_code_B`: `npm run typecheck`
   3. `insurance_code_P`: `npm run typecheck`
3. 新增模块级冒烟脚本：`npm run test:smoke:p-admin-modules`
4. CI 已接入 p-admin 冒烟，并支持公司管理员严格分支（配置 Secrets 后启用）。

## 2.7 服务层抽象（启动）

首个服务层文件已落地：

1. `server/skeleton-c-v1/services/workforce.service.mjs`

已下沉能力：

1. 公司管理员 + 租户上下文校验
2. 平台/公司管理员访问校验
3. 统一错误对象到 HTTP 错误映射

路由已接入：

1. `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs`

## 3. 可复现验收命令

在目录 `insurance_code` 执行：

```bash
npm run risk:check-tenant-fallback
npm run docs:check-links
npm run typecheck
npm run test:smoke:p-admin-modules
```

可选：如需覆盖员工/团队接口（公司管理员权限），执行：

```bash
P_COMPANY_ADMIN_ACCOUNT=<company_admin_account> \
P_COMPANY_ADMIN_PASSWORD=<company_admin_password> \
npm run test:smoke:p-admin-modules
```

在目录 `insurance_code_B` 执行：

```bash
npm run typecheck
```

在目录 `insurance_code_P` 执行：

```bash
npm run typecheck
```

## 4. 遗留与下周计划

1. 继续拆分 `p-admin.routes` 剩余大块（活动、商城、租户/员工管理）。
2. 在拆分后的模块上补充 API 级冒烟脚本与权限回归脚本。
3. 开始服务层抽象（router -> service -> repository）第一批落地。

## 5. 评审关注点

1. 路由拆分后是否满足“改动最小化、不改行为”的约束。
2. 关键高风险点是否已无回归（以 `risk:check-tenant-fallback` 为准）。
3. 下一批拆分顺序是否与业务优先级一致（客户/内容/营销路径优先）。
