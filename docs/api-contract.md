# 保云链前后端联调接口文档（v0.3）

文档路径：`./api-contract.md`

Base URL：`http://127.0.0.1:4000`

鉴权方式：

```http
Authorization: Bearer <token>
Content-Type: application/json
```

统一错误结构：

```json
{
  "code": "ERROR_CODE",
  "message": "错误信息"
}
```

---

## 1. 实名与登录

### 1.1 发送验证码

`POST /api/auth/send-code`

请求：

```json
{ "mobile": "13800000000" }
```

成功：

```json
{ "ok": true, "message": "验证码已发送", "dev_code": "123456" }
```

错误码：
- `INVALID_MOBILE`
- `SMS_LIMIT_REACHED`

### 1.2 姓名+手机号实名校验并登录

`POST /api/auth/verify-basic`

请求：

```json
{
  "name": "张三",
  "mobile": "13800000000",
  "code": "123456"
}
```

成功：

```json
{
  "token": "uuid-token",
  "user": {
    "id": 1,
    "name": "张三",
    "mobile": "13800000000",
    "is_verified_basic": true,
    "verified_at": "2026-02-22T15:18:13.014Z"
  }
}
```

错误码：
- `INVALID_NAME`
- `INVALID_MOBILE`
- `INVALID_CODE`
- `CODE_NOT_FOUND`
- `CODE_EXPIRED`

### 1.3 当前用户信息

`GET /api/me`（需鉴权）

成功：

```json
{
  "user": {
    "id": 1,
    "name": "张三",
    "mobile": "13800000000",
    "is_verified_basic": true,
    "verified_at": "2026-02-22T15:18:13.014Z"
  },
  "balance": 210
}
```

---

## 2. 活动与积分

### 2.1 活动列表

`GET /api/activities`（可匿名）

成功：

```json
{
  "activities": [
    {
      "id": 1,
      "title": "连续签到7天领鸡蛋",
      "category": "sign",
      "rewardPoints": 10,
      "sortOrder": 1,
      "participants": 18230,
      "completed": false,
      "canComplete": true
    }
  ],
  "balance": 210,
  "taskProgress": {
    "total": 3,
    "completed": 1
  }
}
```

### 2.2 每日签到

`POST /api/sign-in`（需鉴权）

成功：

```json
{ "ok": true, "reward": 10, "balance": 220 }
```

错误码：
- `UNAUTHORIZED`
- `NEED_BASIC_VERIFY`
- `ALREADY_SIGNED`

### 2.3 积分汇总

`GET /api/points/summary`（需鉴权）

### 2.4 积分流水

`GET /api/points/transactions`（需鉴权）

### 2.5 完成活动任务

`POST /api/activities/:id/complete`（需鉴权）

成功：

```json
{ "ok": true, "reward": 100, "balance": 310 }
```

错误码：
- `ACTIVITY_NOT_FOUND`
- `USE_SIGN_IN`
- `MANUAL_FLOW_REQUIRED`
- `ALREADY_COMPLETED`

---

## 3. 积分商城与兑换

### 3.1 商品列表

`GET /api/mall/items`

### 3.2 兑换商品

`POST /api/mall/redeem`（需鉴权）

请求：

```json
{ "itemId": 3 }
```

成功：

```json
{ "ok": true, "token": "EX...", "balance": 120 }
```

错误码：
- `UNAUTHORIZED`
- `NEED_BASIC_VERIFY`
- `ITEM_NOT_FOUND`
- `OUT_OF_STOCK`
- `INSUFFICIENT_POINTS`

### 3.3 兑换记录

`GET /api/redemptions`（需鉴权）

### 3.4 核销兑换

`POST /api/redemptions/:id/writeoff`（需鉴权）

请求：

```json
{ "token": "EX..." }
```

错误码：
- `REDEMPTION_NOT_FOUND`
- `ALREADY_WRITTEN_OFF`
- `INVALID_TOKEN`
- `TOKEN_EXPIRED`

---

## 4. 学习模块（已联调）

### 4.1 课程列表 + 分类

`GET /api/learning/courses`

成功：

```json
{
  "categories": ["全部", "医疗", "理赔", "养老"],
  "courses": [
    {
      "id": 1,
      "title": "如何使用手机申领医保报销",
      "desc": "手把手教您在手机上操作，简单又省时",
      "type": "video",
      "typeLabel": "视频课",
      "progress": 80,
      "timeLeft": "2 分钟",
      "image": "https://picsum.photos/...",
      "action": "继续学习",
      "color": "bg-black/60",
      "btnColor": "bg-blue-500 text-white",
      "points": 50,
      "category": "医疗",
      "content": "..."
    }
  ]
}
```

### 4.2 课程详情

`GET /api/learning/courses/:id`

### 4.3 完成课程并领积分

`POST /api/learning/courses/:id/complete`（需鉴权）

首领成功：

```json
{ "ok": true, "duplicated": false, "reward": 50, "balance": 260 }
```

重复领取：

```json
{
  "ok": true,
  "duplicated": true,
  "reward": 0,
  "balance": 260,
  "message": "该课程已领取过积分"
}
```

### 4.4 趣味游戏列表

`GET /api/learning/games`

### 4.5 实用工具列表

`GET /api/learning/tools`

---

## 5. 保障管理模块（已联调）

### 5.1 总览数据

`GET /api/insurance/overview`

成功：

```json
{
  "summary": {
    "totalCoverage": 4500000,
    "healthScore": 85,
    "activePolicies": 3,
    "annualPremium": 13565
  },
  "familyMembers": [
    {
      "id": 1,
      "name": "本人",
      "avatar": "https://picsum.photos/...",
      "score": 85,
      "coveredTypes": ["医疗", "重疾"]
    }
  ],
  "reminders": [
    {
      "id": 1,
      "title": "车险续保提醒",
      "desc": "您的沪A·*****保单即将到期",
      "tag": "剩 5 天",
      "actionText": "立即续保",
      "kind": "renewal"
    }
  ]
}
```

### 5.2 保单列表

`GET /api/insurance/policies`

字段说明：`icon` 取值 `stethoscope | heart-pulse | shield`，前端映射图标。

### 5.3 保单详情

`GET /api/insurance/policies/:id`

### 5.4 OCR识别（模拟）

`POST /api/insurance/policies/scan`

### 5.5 新增保单

`POST /api/insurance/policies`（需鉴权）

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
{
  "ok": true,
  "policy": {
    "id": 4,
    "name": "平安福21重疾险",
    "icon": "heart-pulse"
  }
}
```

错误码：
- `INVALID_POLICY_INPUT`
- `INVALID_POLICY_AMOUNT`
- `UNAUTHORIZED`

---

## 6. 联调顺序建议

1. 调 `POST /api/auth/send-code`
2. 调 `POST /api/auth/verify-basic` 拿 `token`
3. 页面初始化调 `GET /api/me`、`GET /api/points/summary`
4. 学习页调：`/api/learning/courses`、`/api/learning/games`、`/api/learning/tools`
5. 课程完成动作调：`POST /api/learning/courses/:id/complete`
6. 保障管理调：`/api/insurance/overview`、`/api/insurance/policies`、`/api/insurance/policies/:id`
7. 上传保单流程：`POST /api/insurance/policies/scan` -> `POST /api/insurance/policies`
8. 商城页调：`/api/mall/items`、`POST /api/mall/redeem`、`GET /api/redemptions`

---

## 7. 前端当前约定

- token 本地存储键：`insurance_token`
- 需要实名门槛的动作：签到、课程领积分、保单上传、积分兑换
- 你前端改 mock 时，直接按本文档 path 与字段替换即可。
