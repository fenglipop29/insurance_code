# 保云链 C端接口契约（冻结版 v1）

文档状态：`FROZEN`（后端按此实现，前端按此联调）  
版本：`v1.0`  
更新时间：`2026-02-23`

## 1. 约定

- Base URL：`http://127.0.0.1:4000`
- 鉴权：`Authorization: Bearer <token>`
- Content-Type：`application/json`
- 时间格式：`ISO8601`（如 `2026-02-23T10:20:30.000Z`）
- 金额/积分：整数（分/点），不传浮点

统一错误结构：

```json
{
  "code": "ERROR_CODE",
  "message": "错误信息"
}
```

## 2. C端接口清单

| 模块 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 健康检查 | GET | `/api/health` | 否 |
| 启动信息 | GET | `/api/bootstrap` | 可选 |
| 发送验证码 | POST | `/api/auth/send-code` | 否 |
| 基础实名登录 | POST | `/api/auth/verify-basic` | 否 |
| 当前用户 | GET | `/api/me` | 是 |
| 活动列表 | GET | `/api/activities` | 可选 |
| 完成活动任务 | POST | `/api/activities/:id/complete` | 是 |
| 签到 | POST | `/api/sign-in` | 是 |
| 积分汇总 | GET | `/api/points/summary` | 是 |
| 积分流水 | GET | `/api/points/transactions` | 是 |
| 商城商品 | GET | `/api/mall/items` | 可选 |
| 商品兑换 | POST | `/api/mall/redeem` | 是 |
| 兑换记录 | GET | `/api/redemptions` | 是 |
| 兑换核销 | POST | `/api/redemptions/:id/writeoff` | 是 |
| 学习课程列表 | GET | `/api/learning/courses` | 否 |
| 学习课程详情 | GET | `/api/learning/courses/:id` | 否 |
| 完成课程领积分 | POST | `/api/learning/courses/:id/complete` | 是 |
| 趣味游戏列表 | GET | `/api/learning/games` | 否 |
| 实用工具列表 | GET | `/api/learning/tools` | 否 |
| 保障总览 | GET | `/api/insurance/overview` | 否 |
| 保单列表 | GET | `/api/insurance/policies` | 否 |
| 保单详情 | GET | `/api/insurance/policies/:id` | 否 |
| 保单OCR识别 | POST | `/api/insurance/policies/scan` | 否 |
| 新增保单 | POST | `/api/insurance/policies` | 是 |

## 3. 关键数据结构

### 3.1 User

```json
{
  "id": 1,
  "name": "张三",
  "mobile": "13800000000",
  "is_verified_basic": true,
  "verified_at": "2026-02-23T10:20:30.000Z"
}
```

### 3.2 Activity

```json
{
  "id": 3,
  "title": "完善保障信息",
  "category": "task",
  "rewardPoints": 100,
  "sortOrder": 3,
  "participants": 5980,
  "completed": false,
  "canComplete": true
}
```

`category` 枚举：
- `sign`
- `task`
- `invite`
- `competition`

### 3.3 LearningCourse

```json
{
  "id": 1,
  "title": "如何使用手机申领医保报销",
  "desc": "...",
  "type": "video",
  "typeLabel": "视频课",
  "progress": 80,
  "timeLeft": "2 分钟",
  "image": "https://...",
  "action": "继续学习",
  "color": "bg-black/60",
  "btnColor": "bg-blue-500 text-white",
  "points": 50,
  "category": "医疗",
  "content": "..."
}
```

`type` 枚举：`video | comic | article`

### 3.4 InsurancePolicy

```json
{
  "id": 1,
  "company": "平安健康保险股份有限公司",
  "name": "尊享e生2024",
  "type": "医疗",
  "icon": "stethoscope",
  "amount": 3000000,
  "nextPayment": "2025-01-01",
  "status": "保障中",
  "applicant": "张*三",
  "insured": "张*三",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-12-31",
  "annualPremium": 365,
  "paymentPeriod": "1年交",
  "coveragePeriod": "1年",
  "responsibilities": [{ "name": "一般医疗保险金", "desc": "...", "limit": 3000000 }],
  "paymentHistory": [{ "date": "2024-01-01", "amount": 365, "note": "年度首缴", "status": "支付成功" }],
  "policyNo": "812345678901"
}
```

`icon` 枚举：`stethoscope | heart-pulse | shield`

## 4. 接口定义（核心）

### 4.1 发送验证码

`POST /api/auth/send-code`

请求：

```json
{ "mobile": "13800000000" }
```

成功：

```json
{ "ok": true, "message": "验证码已发送", "dev_code": "123456" }
```

错误码：`INVALID_MOBILE`、`SMS_LIMIT_REACHED`

### 4.2 实名登录

`POST /api/auth/verify-basic`

请求：

```json
{ "name": "张三", "mobile": "13800000000", "code": "123456" }
```

成功：

```json
{ "token": "uuid-token", "user": { "id": 1, "name": "张三", "mobile": "13800000000", "is_verified_basic": true, "verified_at": "2026-02-23T10:20:30.000Z" } }
```

错误码：`INVALID_NAME`、`INVALID_MOBILE`、`INVALID_CODE`、`CODE_NOT_FOUND`、`CODE_EXPIRED`

### 4.3 活动列表

`GET /api/activities`

成功：

```json
{
  "activities": [{ "id": 1, "title": "连续签到7天领鸡蛋", "category": "sign", "rewardPoints": 10, "sortOrder": 1, "participants": 18230, "completed": false, "canComplete": true }],
  "balance": 210,
  "taskProgress": { "total": 3, "completed": 1 }
}
```

### 4.4 完成活动任务

`POST /api/activities/:id/complete`

成功：

```json
{ "ok": true, "reward": 100, "balance": 310 }
```

错误码：`ACTIVITY_NOT_FOUND`、`USE_SIGN_IN`、`MANUAL_FLOW_REQUIRED`、`ALREADY_COMPLETED`

### 4.5 每日签到

`POST /api/sign-in`

成功：

```json
{ "ok": true, "reward": 10, "balance": 320 }
```

错误码：`UNAUTHORIZED`、`NEED_BASIC_VERIFY`、`ALREADY_SIGNED`

### 4.6 商城兑换

`POST /api/mall/redeem`

请求：

```json
{ "itemId": 3 }
```

成功：

```json
{ "ok": true, "token": "EX...", "balance": 120 }
```

错误码：`UNAUTHORIZED`、`NEED_BASIC_VERIFY`、`ITEM_NOT_FOUND`、`OUT_OF_STOCK`、`INSUFFICIENT_POINTS`

### 4.7 核销兑换

`POST /api/redemptions/:id/writeoff`

请求：

```json
{ "token": "EX..." }
```

成功：

```json
{ "ok": true }
```

错误码：`REDEMPTION_NOT_FOUND`、`ALREADY_WRITTEN_OFF`、`INVALID_TOKEN`、`TOKEN_EXPIRED`

### 4.8 学习课程列表

`GET /api/learning/courses`

成功：

```json
{ "categories": ["全部", "医疗", "理赔", "养老"], "courses": [/* LearningCourse[] */] }
```

### 4.9 完成课程领积分

`POST /api/learning/courses/:id/complete`

首领成功：

```json
{ "ok": true, "duplicated": false, "reward": 50, "balance": 260 }
```

重复领取：

```json
{ "ok": true, "duplicated": true, "reward": 0, "balance": 260, "message": "该课程已领取过积分" }
```

### 4.10 保单OCR

`POST /api/insurance/policies/scan`

成功：

```json
{ "ok": true, "data": { "company": "中国平安保险", "name": "平安福21重疾险", "applicant": "张三", "insured": "张三", "date": "2024-02-20", "paymentPeriod": "20年交", "coveragePeriod": "终身", "amount": "500000", "firstPremium": "12000" } }
```

### 4.11 新增保单

`POST /api/insurance/policies`

请求：

```json
{
  "company": "中国平安保险",
  "name": "平安福21重疾险",
  "applicant": "张三",
  "insured": "张三",
  "date": "2024-02-20",
  "paymentPeriod": "20年交",
  "coveragePeriod": "终身",
  "amount": 500000,
  "firstPremium": 12000,
  "type": "重疾"
}
```

成功：

```json
{ "ok": true, "policy": { "id": 4, "name": "平安福21重疾险", "icon": "heart-pulse" } }
```

错误码：`INVALID_POLICY_INPUT`、`INVALID_POLICY_AMOUNT`、`UNAUTHORIZED`

## 5. 前端拦截规则（强制）

以下动作必须实名（`is_verified_basic=true`）后才可执行：
- `POST /api/sign-in`
- `POST /api/activities/:id/complete`
- `POST /api/learning/courses/:id/complete`
- `POST /api/mall/redeem`
- `POST /api/insurance/policies`

交互要求：未实名 -> 弹实名 -> 成功后回放原动作。

## 6. 联调最小流程

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`（拿 token）
3. `GET /api/me`
4. `GET /api/activities` + `POST /api/sign-in`
5. `GET /api/learning/courses` + `POST /api/learning/courses/:id/complete`
6. `GET /api/mall/items` + `POST /api/mall/redeem` + `GET /api/redemptions` + `POST /api/redemptions/:id/writeoff`
7. `POST /api/insurance/policies/scan` + `POST /api/insurance/policies`

## 7. 变更规则（冻结约束）

- 不允许删除 C端已使用字段。
- 新需求优先“新增字段”，禁止改字段语义。
- 破坏性变更需升级到 `v2` 文档并保留 `v1` 兼容期。
