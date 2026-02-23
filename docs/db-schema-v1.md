# insurance_code 数据库设计（v1）

更新时间：2026-02-23
数据库：PostgreSQL 16
设计原则：先支撑C端闭环，严格对齐冻结契约语义，不做破坏性字段变更。

## 1. 核心表清单（C端上线最小集）

- 用户与认证：`users`、`sms_codes`、`user_sessions`
- 活动与签到：`activities`、`user_activity_completions`、`sign_in_records`
- 积分：`point_accounts`、`point_transactions`
- 商城与兑换：`mall_items`、`redemption_orders`、`redemption_writeoff_logs`
- 学习：`learning_courses`、`learning_course_completions`
- 保单：`insurance_policies`、`policy_responsibilities`、`policy_payment_history`、`policy_scan_jobs`
- 平台能力：`audit_logs`、`outbox_events`

## 2. 关键DDL（摘要）

```sql
create table users (
  id bigserial primary key,
  name varchar(50) not null,
  mobile_enc text not null,
  mobile_masked varchar(20) not null,
  is_verified_basic boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ux_users_mobile_masked on users(mobile_masked);

create table point_accounts (
  user_id bigint primary key references users(id),
  balance integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint ck_balance_non_negative check (balance >= 0)
);

create table point_transactions (
  id bigserial primary key,
  user_id bigint not null references users(id),
  direction varchar(8) not null check (direction in ('in','out')),
  amount integer not null check (amount > 0),
  source_type varchar(50) not null,
  source_id varchar(64) not null,
  idempotency_key varchar(100) not null,
  balance_after integer not null,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);
create index idx_pt_user_created on point_transactions(user_id, created_at desc);

create table mall_items (
  id bigserial primary key,
  name varchar(100) not null,
  points_cost integer not null check (points_cost > 0),
  stock integer not null check (stock >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table redemption_orders (
  id bigserial primary key,
  user_id bigint not null references users(id),
  item_id bigint not null references mall_items(id),
  item_name varchar(100) not null,
  points_cost integer not null,
  writeoff_token varchar(64) not null unique,
  status varchar(20) not null check (status in ('pending','written_off','expired','cancelled')),
  expires_at timestamptz,
  written_off_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_ro_user_created on redemption_orders(user_id, created_at desc);
create index idx_ro_status_expire on redemption_orders(status, expires_at);
```

## 3. 与OpenAPI契约字段对齐说明

- `User.mobile`：响应层使用脱敏/解密后的契约字段，存储层仅存 `mobile_enc/mobile_masked`。
- `MallItem.pointsCost`：DB字段`points_cost`，API层映射为`pointsCost`。
- `InsurancePolicy`对象中的`responsibilities/paymentHistory`：分别由子表聚合。
- 现有枚举语义保持不变：
  - `Activity.category`: `sign|task|invite|competition`
  - `LearningCourse.type`: `video|comic|article`
  - `InsurancePolicy.icon`: `stethoscope|heart-pulse|shield`

## 4. 约束与索引策略

### 4.1 一致性约束
- 积分余额不得为负：`ck_balance_non_negative`。
- 积分流水幂等唯一：`unique(idempotency_key)`。
- 核销码全局唯一：`writeoff_token unique`。

### 4.2 性能索引
- 高频查询：
  - 积分流水：`(user_id, created_at desc)`
  - 兑换记录：`(user_id, created_at desc)`
  - 活动完成：`(user_id, activity_id)`唯一索引
- 过期扫描：`(status, expires_at)`

## 5. 备份与恢复

- 全量备份：每日1次；增量/WAL：每15分钟。
- 保留策略：7天日备 + 4周周备。
- 目标：RPO <= 15分钟，RTO <= 60分钟。

负责人建议：
- 表结构与索引：后端负责人
- 备份策略：DBA/DevOps
- 数据合规：安全负责人

## 6. 关键决策与取舍

- 决策：核心事务表优先强约束（unique/check/fk），不做“先宽后严”。
- 取舍：开发初期迁移成本增加，但能显著降低线上脏数据风险。
- 决策：字段采用snake_case存储、API层做camelCase映射。
- 取舍：增加映射代码，但契约稳定且便于DB治理。

## 7. 落地实施步骤与负责人建议

1. 由后端负责人输出完整DDL与Prisma schema。
2. DBA评审索引与约束（重点审查积分/核销表）。
3. 在staging导入样本数据并执行Explain分析。
4. 根据慢SQL与执行计划调优索引。
5. 由QA执行字段语义与OpenAPI回归。
6. 生产建表前执行备份快照并审批发布。
