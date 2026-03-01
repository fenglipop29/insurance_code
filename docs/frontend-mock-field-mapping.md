# 前端 Mock 字段 -> 接口字段映射表（逐页面）

文档路径：`./frontend-mock-field-mapping.md`

适用范围：当前已联调页面（活动中心、积分商城、学习、保障管理、个人中心中的兑换相关）。

## 0. 全局约定

| 前端使用 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `localStorage.insurance_token` | `token` | `POST /api/auth/verify-basic` | 登录成功后保存 |
| `user.is_verified_basic` | `user.is_verified_basic` | `GET /api/me` | 作为实名门槛判断 |
| `pointsBalance` | `balance` | `GET /api/me` / `GET /api/points/summary` | 全局积分显示 |

## 1. 实名弹窗 `RealNameAuthModal`

### 1.1 发送验证码

| 前端输入字段 | 接口请求字段 | 来源接口 | 备注 |
|---|---|---|---|
| `phone` | `mobile` | `POST /api/auth/send-code` | 手机号正则前端已校验 |

### 1.2 提交实名

| 前端输入字段 | 接口请求字段 | 来源接口 | 备注 |
|---|---|---|---|
| `name` | `name` | `POST /api/auth/verify-basic` | 中文姓名 |
| `phone` | `mobile` | `POST /api/auth/verify-basic` | 11位手机号 |
| `code` | `code` | `POST /api/auth/verify-basic` | 6位验证码 |

### 1.3 成功返回

| 前端状态 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `setToken(token)` | `token` | `POST /api/auth/verify-basic` | 用于后续 Bearer |
| `setUser(user)` | `user` | `POST /api/auth/verify-basic` | 结构同 `GET /api/me` |

## 2. 活动中心 `pages/Activities.tsx`

### 2.1 已接接口字段

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `activities[]` | `activities[]` | `GET /api/activities` | 热门活动与任务列表数据源 |
| `points` | `balance` | `GET /api/activities` | 页面顶部“我的积分” |
| `tasksCompleted/tasksTotal` | `taskProgress.completed/total` | `GET /api/activities` | 任务进度条 |
| `签到成功提示` | `reward` | `POST /api/sign-in` | 签到成功提示 |
| `签到后积分` | `balance` | `POST /api/sign-in` | 签到后更新积分 |
| `任务完成提示` | `reward` | `POST /api/activities/:id/complete` | 非签到任务领取积分 |
| `任务完成后积分` | `balance` | `POST /api/activities/:id/complete` | 更新积分 |

## 3. 积分商城 `components/mall/PointsMall.tsx`

### 3.1 商城首页

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `balance` | `balance` | `GET /api/points/summary` | 顶部积分卡 |
| `items[]` | `items[]` | `GET /api/mall/items` | 商品列表 |
| `item.id` | `id` | `GET /api/mall/items` | 兑换入参 |
| `item.name` | `name` | `GET /api/mall/items` | 商品名 |
| `item.pointsCost` | `pointsCost` | `GET /api/mall/items` | 所需积分 |
| `item.stock` | `stock` | `GET /api/mall/items` | 库存 |

### 3.2 兑换动作

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `handleRedeem(itemId)` | `itemId` | `POST /api/mall/redeem` | 兑换请求 |
| 兑换后积分 | `balance` | `POST /api/mall/redeem` | 成功后更新 |
| 核销码（隐式） | `token` | `POST /api/mall/redeem` | 在“我的兑换”里展示 |

## 4. 我的兑换 `components/profile/MyExchanges.tsx`

### 4.1 列表映射

| 前端展示字段 | 接口字段 | 来源接口 | 转换规则 |
|---|---|---|---|
| `id` | `id` | `GET /api/redemptions` | 直接使用 |
| `orderNo` | `id` | `GET /api/redemptions` | 前端拼接 `EX${id}` |
| `name` | `itemName` | `GET /api/redemptions` | 直接映射 |
| `date` | `createdAt` | `GET /api/redemptions` | 截取 `YYYY-MM-DD` |
| `points` | `pointsCost` | `GET /api/redemptions` | 直接映射 |
| `code` | `writeoffToken` | `GET /api/redemptions` | 直接映射 |
| `completedDate` | `writtenOffAt` | `GET /api/redemptions` | 存在时截取日期 |
| `status` | `status` + `expiresAt` | `GET /api/redemptions` | `written_off -> 已完成`，过期 -> `已过期`，其他 -> `待核销` |

### 4.2 二维码映射

| 前端字段 | 来源字段 | 规则 |
|---|---|---|
| `qrCode` | `writeoffToken` | 前端拼接 `https://api.qrserver.com/...data=${writeoffToken}` |

## 5. 兑换详情 `components/profile/ExchangeDetail.tsx`

### 5.1 核销动作

| 前端参数 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `exchange.rawId || exchange.id` | `:id` | `POST /api/redemptions/:id/writeoff` | 兑换记录ID |
| `exchange.code` | `token` | `POST /api/redemptions/:id/writeoff` | 核销码 |

## 6. 学习页 `pages/Learning.tsx`

## 6.1 保险课堂 `components/learning/InsuranceClass.tsx`

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `categories` | `categories` | `GET /api/learning/courses` | 分类 pills |
| `courses` | `courses` | `GET /api/learning/courses` | 课程卡片数据源 |
| `course.icon` | `course.type` | `GET /api/learning/courses` | 前端映射：`video/comic/article` 到图标 |

课程对象字段一一对应：
`id/title/desc/type/typeLabel/progress/timeLeft/image/action/color/btnColor/points/category/content`

### 6.2 课程详情 `components/learning/CourseDetail.tsx`

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `courseData` | `course` | `GET /api/learning/courses/:id` | 打开详情后刷新最新课程数据 |
| 完成领取结果 | `duplicated/reward/balance/message` | `POST /api/learning/courses/:id/complete` | 用于成功提示文案 |

### 6.3 趣味游戏 `components/learning/FunGames.tsx`

| 前端字段 | 接口字段 | 来源接口 | 转换规则 |
|---|---|---|---|
| `games` | `games` | `GET /api/learning/games` | 列表数据 |
| `Icon` | `id` | `GET /api/learning/games` | 前端按 `id` 映射图标 |

### 6.4 实用工具 `components/learning/PracticalTools.tsx`

| 前端字段 | 接口字段 | 来源接口 | 转换规则 |
|---|---|---|---|
| `tools` | `tools` | `GET /api/learning/tools` | 列表数据 |
| `Icon` | `id` | `GET /api/learning/tools` | 前端按 `id` 映射图标 |

## 7. 保障管理页 `pages/InsuranceManagement.tsx`

### 7.1 总览 `components/insurance/OverviewTab.tsx`

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `summary.totalCoverage` | `summary.totalCoverage` | `GET /api/insurance/overview` | 前端格式化千分位 |
| `summary.healthScore` | `summary.healthScore` | `GET /api/insurance/overview` | 环形进度 |
| `summary.activePolicies` | `summary.activePolicies` | `GET /api/insurance/overview` | 有效保单数 |
| `summary.annualPremium` | `summary.annualPremium` | `GET /api/insurance/overview` | 年保费 |
| `familyMembers` | `familyMembers` | `GET /api/insurance/overview` | 家庭成员卡片 |
| `reminders` | `reminders` | `GET /api/insurance/overview` | 提醒列表 |
| `提醒样式` | `kind` | `GET /api/insurance/overview` | 前端根据 `renewal/birthday/report` 映射图标和颜色 |

### 7.2 保单列表 `components/insurance/PolicyListTab.tsx`

| 前端字段 | 接口字段 | 来源接口 | 转换规则 |
|---|---|---|---|
| `policies` | `policies` | `GET /api/insurance/policies` | 列表数据 |
| `Icon` | `icon` | `GET /api/insurance/policies` | `stethoscope/heart-pulse/shield` 映射图标 |
| `保障额度` | `amount` | `GET /api/insurance/policies` | 前端转 `万` 显示 |
| `下次缴费日` | `nextPayment` | `GET /api/insurance/policies` | 直接显示 |

### 7.3 保单详情 `components/insurance/PolicyDetail.tsx`

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `detail` | `policy` | `GET /api/insurance/policies/:id` | 详情数据 |
| `detail.policyNo` | `policyNo` | `GET /api/insurance/policies/:id` | 单号展示 |
| `detail.responsibilities[]` | `responsibilities[]` | `GET /api/insurance/policies/:id` | 责任列表 |
| `detail.paymentHistory[]` | `paymentHistory[]` | `GET /api/insurance/policies/:id` | 缴费记录 |

### 7.4 上传保单 `components/insurance/UploadPolicy.tsx`

#### OCR 自动填充

| 前端 `formData` 字段 | 接口字段 | 来源接口 |
|---|---|---|
| `company` | `data.company` | `POST /api/insurance/policies/scan` |
| `name` | `data.name` | `POST /api/insurance/policies/scan` |
| `applicant` | `data.applicant` | `POST /api/insurance/policies/scan` |
| `insured` | `data.insured` | `POST /api/insurance/policies/scan` |
| `date` | `data.date` | `POST /api/insurance/policies/scan` |
| `paymentPeriod` | `data.paymentPeriod` | `POST /api/insurance/policies/scan` |
| `coveragePeriod` | `data.coveragePeriod` | `POST /api/insurance/policies/scan` |
| `amount` | `data.amount` | `POST /api/insurance/policies/scan` |
| `firstPremium` | `data.firstPremium` | `POST /api/insurance/policies/scan` |

#### 提交新增

| 前端 `formData` 字段 | 接口请求字段 | 来源接口 | 备注 |
|---|---|---|---|
| `company` | `company` | `POST /api/insurance/policies` | 必填 |
| `name` | `name` | `POST /api/insurance/policies` | 必填 |
| `applicant` | `applicant` | `POST /api/insurance/policies` | 必填 |
| `insured` | `insured` | `POST /api/insurance/policies` | 必填 |
| `date` | `date` | `POST /api/insurance/policies` | 必填 |
| `paymentPeriod` | `paymentPeriod` | `POST /api/insurance/policies` | 必填 |
| `coveragePeriod` | `coveragePeriod` | `POST /api/insurance/policies` | 必填 |
| `amount` | `amount` | `POST /api/insurance/policies` | 前端 `Number()` |
| `firstPremium` | `firstPremium` | `POST /api/insurance/policies` | 前端 `Number()` |

## 8. 个人中心 `pages/Profile.tsx`

### 8.1 已接接口字段

| 前端字段 | 接口字段 | 来源接口 | 备注 |
|---|---|---|---|
| `user?.name` | `user.name` | `GET /api/me` | 头像旁昵称 |
| `isAuthenticated` | `user.is_verified_basic` | `GET /api/me` | 显示“去实名/已实名” |
| `pointsBalance` | `balance` | `GET /api/me` / `GET /api/points/summary` | 我的积分 |
| 首页兑换预览 | `list[]` | `GET /api/redemptions` | 取最新待核销记录 |
| 家庭成员数量 | `familyMembers.length` | `GET /api/insurance/overview` | “已添加 X 位成员” |
| 保单数量 | `policies.length` | `GET /api/insurance/policies` | “在保 X” |
| 活动完成数 | `taskProgress.completed` | `GET /api/activities` | “今日已完成 X 项” |

## 9. 建议替换顺序（你改 mock 可直接照做）

1. 先统一 token 注入（`api.ts` 已完成）。
2. 再替换实名、积分、商城（已完成）。
3. 再替换学习页三大 tab（已完成）。
4. 再替换保障管理总览/列表/详情/上传（已完成）。
5. 最后处理“仍为本地 mock”的任务进度与功能区入口（已完成：活动进度、热门活动、个人中心核心统计）。
