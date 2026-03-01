# 架构补齐落地说明（v1）

更新时间：2026-02-24

本文件对应你提出的6项补齐要求，说明当前代码已落地的骨架能力和接口边界。

## 1. 多租户与组织权限模型

已落地：
- 统一租户上下文注入中间件：`tenantContext`
- RBAC校验中间件：`permissionRequired`
- ABAC数据范围注入：`dataScope`（tenant/team/owner范围）
- 代码位置：
  - `../server/skeleton-c-v1/common/access-control.mjs`
  - `../server/skeleton-c-v1/common/state.mjs`（roles/permissions/rolePermissions/userRoles）

上下文字段：
- `tenant_id/org_id/team_id/owner_user_id`（运行态在user对象和tenantContext中）

## 2. 商品购买完整域模型

已落地订单域：
- 订单：`orders`
- 支付：`orderPayments`
- 履约/核销：`orderFulfillments` + `redemptions` + `bWriteOffRecords`
- 退款/取消：`orderRefunds`
- 代码位置：
  - `../server/skeleton-c-v1/services/commerce.service.mjs`
  - `../server/skeleton-c-v1/routes/orders.routes.mjs`

兼容策略：
- 旧接口 `/api/mall/redeem` 已改为走订单创建+支付，但保持原响应结构兼容前端。

## 3. B/P管理域服务边界

已拆分路由边界：
- C端订单域：`/api/orders/*`
- B端运营域：`/api/b/*`（客户列表、打标、订单核销）
- P端平台域：`/api/p/*`（租户、权限矩阵、审批、退款、统计重建、对账）
- 代码位置：
  - `../server/skeleton-c-v1/routes/b-admin.routes.mjs`
  - `../server/skeleton-c-v1/routes/p-admin.routes.mjs`

## 4. 审批与审计架构

已落地：
- 审批请求：`approvals`
- 审计日志：`auditLogs`（追加写入，不提供修改/删除接口）
- 关键操作均写审计（下单、支付、核销、退款、审批）
- 代码位置：
  - `../server/skeleton-c-v1/common/state.mjs`（`appendAuditLog`）

## 5. 事件与幂等架构

已落地：
- 幂等记录：`idempotencyRecords`（`withIdempotency`）
- 领域事件：`domainEvents`
- outbox：`outboxEvents`
- 已覆盖关键流程：订单创建、订单支付（含积分扣减和库存扣减）、退款、核销
- 代码位置：
  - `../server/skeleton-c-v1/common/state.mjs`
  - `../server/skeleton-c-v1/services/commerce.service.mjs`

## 6. 统计数仓/聚合层

已落地（应用层）：
- 报表快照层：`statsWarehouse`
- 日统计重建：`rebuildDailySnapshot`
- 日对账：`runReconciliation`
- 代码位置：
  - `../server/skeleton-c-v1/services/analytics.service.mjs`

已提供（DDL层）：
- 数仓表示例DDL：`../server/data/schema_dw_analytics_v1.sql`
- 业务域DDL：`../server/data/schema_phase_a_prd_v1.sql`

## 7. 仍建议下一步补充

- 为B/P增加独立登录与token体系（目前B/P通过Header模拟角色上下文）。
- 将运行态JSON（`runtime_state`）迁移为真实业务表读写（repo层改造）。
- 将outbox对接真实异步任务消费者（BullMQ/Kafka）。
