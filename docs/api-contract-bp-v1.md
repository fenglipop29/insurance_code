# 保云链 B/P 端接口契约（联调版 v1）

文档状态：`ACTIVE`  
版本：`v1.0`  
更新时间：`2026-02-25`

## 1. 统一约定

- Base URL：`http://127.0.0.1:4000`
- Content-Type：`application/json`
- 多租户请求头（B/P 必传）：
  - `x-actor-type: agent|employee`
  - `x-actor-id: <number>`
  - `x-tenant-id: <number>`
  - `x-team-id: <number>`（B端建议传）
- 统一错误结构：

```json
{ "code": "ERROR_CODE", "message": "错误信息" }
```

## 2. B 端契约

### 2.1 客户与订单

- `GET /api/b/customers`：客户列表
- `GET /api/b/orders`：订单列表
- `POST /api/b/orders/:id/writeoff`：订单核销

### 2.2 标签能力（新增）

- `GET /api/b/tags/library`：标签库（含推荐标签与分组）
- `POST /api/b/tags/custom`：新增自定义标签
  - body: `{ "name": "待跟进" }`
- `POST /api/b/customers/:id/tags`：给客户绑定标签
  - body: `{ "tag": "高潜力" }`

### 2.3 获客工具新增能力（新增）

- `POST /api/b/content/items`：新增内容管理文章
  - body: `{ "title": "...", "body": "...", "rewardPoints": 50, "sortOrder": 1, "media": [] }`
- `POST /api/b/activity-configs`：新增活动配置
  - body: `{ "title": "...", "desc": "...", "rewardPoints": 100, "sortOrder": 2, "media": [] }`
- `POST /api/b/mall/products`：新增商城商品
  - body: `{ "name": "...", "desc": "...", "pointsCost": 99, "stock": 20, "sortOrder": 1, "media": [] }`
- `POST /api/b/mall/activities`：新增商城活动
  - body: `{ "title": "...", "desc": "...", "rewardPoints": 88, "sortOrder": 3, "media": [] }`

## 3. P 端契约

- `GET /api/p/tenants`：租户列表
- `POST /api/p/tenants`：创建租户
- `GET /api/p/permissions/matrix`：权限矩阵
- `POST /api/p/approvals`：创建审批
- `POST /api/p/approvals/:id/approve`：审批通过
- `POST /api/p/orders/:id/refund`：订单退款
- `POST /api/p/stats/rebuild`：重建统计
- `GET /api/p/stats/overview?limit=7`：统计概览
- `POST /api/p/reconciliation/run`：触发对账

## 4. 前端映射

### B 端前端（`insurance_code_B`）

- API 文件：`._B/src/lib/api.ts`
- 页面文件：`._B/src/App.tsx`

### P 端前端（`insurance_code_P`）

- API 文件：`._P/src/lib/api.ts`
- 页面文件：`._P/src/App.tsx`

## 5. 联调状态（2026-02-25）

已通过冒烟：
- `GET /api/b/tags/library`
- `POST /api/b/tags/custom`
- `POST /api/b/content/items`
- `POST /api/b/activity-configs`
- `POST /api/b/mall/products`
- `POST /api/b/mall/activities`

说明：C端仍以 `openapi-c-v1.yaml` 为唯一冻结契约，B/P 为当前联调契约，后续可补充 OpenAPI。
