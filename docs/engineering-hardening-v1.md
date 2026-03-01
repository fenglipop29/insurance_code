# 工程加固说明 v1（缓存 / 安全 / 测试 / 规范）

更新时间：2026-02-28

## 1. 缓存策略

### 1.1 前端缓存
- 本地缓存采用 TTL 包装（`src/lib/cache.ts`）。
- 已接入缓存项：
  - `me`：30s
  - `pointsSummary`：30s
- 失效策略：所有写请求（POST/PUT/PATCH/DELETE）自动清理用户与积分缓存。

### 1.2 图片与静态资源
- 开发态：Vite 本地静态资源。
- 生产建议：
  - 前端静态资源上 CDN（按文件 hash 长缓存）
  - 用户上传媒体走对象存储 + CDN 域名（建议签名 URL + 缓存头）

## 2. 安全加固

### 2.1 Token 存储
- 从 `localStorage` 调整为 `sessionStorage` 优先（降低长期暴露风险）。

### 2.2 CSRF 保护
- 新增中间件 `csrfProtection`（默认开启，可开关）：
  - `CSRF_PROTECTION=true` 时，所有鉴权后写请求必须带 `x-csrf-token`。
  - 登录成功返回 `csrfToken`，前端自动透传。
- P/B 端 `x-actor-*` 会话也纳入 CSRF 校验：
  - 后端在 P/B 登录时按 `(tenantId, actorType, actorId)` 生成并保存 actor 级 `csrfToken`
  - 写请求按 actor 身份强制比对 `x-csrf-token`

### 2.3 敏感操作二次确认
- 新增中间件 `requireActionConfirmation`（默认开启，可开关）：
  - `REQUIRE_SENSITIVE_CONFIRM=true` 时，敏感操作需 `x-action-confirm: YES`。
- 已接入接口：
  - `POST /api/mall/redeem`
  - `POST /api/p/customers/system-assign`
  - `POST /api/p/customers/assign-by-mobile`

## 3. 自动化测试

- 新增 Vitest 单元测试：
  - `tests/template-visibility.test.ts`
  - `tests/customer-assignment.service.test.ts`
  - `tests/cache.test.ts`
- 覆盖的核心逻辑：
  - 客户可见范围与模板可见性
  - 客户分配业务逻辑
  - 前端缓存 TTL 行为

## 4. 工程规范

- ESLint：`eslint.config.mjs`
- Prettier：`.prettierrc.json` + `.prettierignore`
- NPM scripts：
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run format`

## 6. 前后端类型一致性

- 新增共享契约目录：`../../shared-contracts/index.ts`
- C/B/P 三端通过 `@contracts/*` 引用统一 session / user / auth response 类型。

## 5. Docker 开发环境

- `docker-compose.dev.yml` 提供：
  - `postgres`
  - `redis`
  - `api`
  - `web`
- 一键启动：
  - `docker compose -f docker-compose.dev.yml up --build`
