# db.json -> PostgreSQL 数据校验报告（v1）

- 输入文件：`../server/data/db.json`
- 生成时间：`2026-02-23T11:26:45.160Z`
- 结论：PASS（可迁移）

## 计数汇总

| 项目 | 数量 |
|---|---:|
| users | 8 |
| pointTransactions | 28 |
| mallItems | 3 |
| redemptions | 3 |
| learningCourses | 3 |
| courseCompletions | 6 |
| policies | 7 |
| policyResponsibilities | 14 |
| policyPaymentHistory | 7 |
| issues | 0 |

## 校验规则

- 兑换单外键完整性（user/item）。
- 核销码唯一性。
- 课程完成记录外键完整性。
- 商城库存非负。
- 积分流水余额一致性（逐用户按流水重算）。
- 保单责任/缴费历史完整性。

## 问题明细

- 无问题。

## 执行建议

1. 先在 staging 执行 SQL 导入并再次跑校验。
2. 确认 `point_accounts.balance` 与 `point_transactions.balance_after` 一致。
3. 抽样验证兑换核销、学习积分、保单详情三条链路。
