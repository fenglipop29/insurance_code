# 保云链 API v1 契约冻结清单（可评审）

版本：v1.0  
冻结日期：2026-02-28  
状态：`READY_FOR_REVIEW`

---

## 1. 冻结目标

1. 固定 P/B/C 当前联调契约边界，避免字段和语义漂移。
2. 为 Node -> Java 迁移提供稳定兼容层。
3. 把契约变更纳入可审计流程（哈希、评审、回归）。

---

## 2. 冻结范围

## 2.1 C 端（强冻结）

1. `docs/openapi-c-v1.yaml`
2. `docs/api-contract-c-v1.md`

## 2.2 B/P 端（联调冻结）

1. `docs/api-contract-bp-v1.md`

## 2.3 埋点相关（口径冻结）

1. `docs/tracking-events-v1.md`
2. `docs/tracking-events-v2.md`

---

## 3. 冻结基线哈希（SHA-256）

1. `docs/openapi-c-v1.yaml`
- `8ef8612c25cbedb56d8653b77d147efa15739d8391fab8586554d9c405012f60`

2. `docs/api-contract-c-v1.md`
- `74117ecc71a238ea65e9e8a18ce08e14b800cde9f2ccc50be49725a84c676d9b`

3. `docs/api-contract-bp-v1.md`
- `1d12de14e52ff50b5b741c3028a40d79e607300cf8db34fc0d38f95f8b10eb2d`

4. `docs/tracking-events-v1.md`
- `d1e19dd415ad4c73224d199151e18ddd65b96b1d5914c54ffc5e8a4d71037052`

5. `docs/tracking-events-v2.md`
- `83a08a274497b060fd0c0c49ede064a4cc660898c1b76eabd7eae47dc3cf3f43`

冻结清单机器可读版本：
- `../../shared-contracts/v1-freeze-manifest.json`

---

## 4. 变更门禁（冻结期）

1. 禁止删除字段、重命名字段、变更字段语义。
2. 禁止改动既有错误码语义；仅允许追加错误码。
3. 允许新增可选字段，但必须同时更新：
- OpenAPI
- `shared-contracts`
- 回归测试用例
4. 涉及埋点口径改动必须附带指标/标签对账方案。

---

## 5. shared-contracts 对齐检查

已建立目录：
- `../../shared-contracts`

已纳入基线文件：
1. `common.ts`
2. `c-endpoint.ts`
3. `error-codes.ts`
4. `index.ts`
5. `README.md`
6. `v1-freeze-manifest.json`

---

## 6. 评审检查项（勾选）

1. [ ] C 端接口路径、请求体、响应体与 OpenAPI 一致。
2. [ ] B/P 端联调接口无隐式默认租户兜底。
3. [ ] 所有权限默认未配置时为不可访问。
4. [ ] 埋点事件名、事件属性、指标口径一致。
5. [ ] 标签规则依赖字段在指标平台或客户属性库可追溯。
6. [ ] 关键错误码在前后端显示文案一致。
7. [ ] 回归脚本已覆盖跨租户与角色差异场景。

---

## 7. 风险与待决策

1. B/P 端目前以 Markdown 契约为主，建议补充 OpenAPI 文件统一校验。
2. token 存储策略需在前端统一收敛为更安全模式（迁移期至少不新增 localStorage 依赖）。
3. Java 落地后是否采用统一 API 网关版本路由（`/v1`）需尽快定版。

---

## 8. 评审通过后动作

1. 将本文件状态改为 `FROZEN`。
2. 在 CI 增加“契约哈希校验步骤”。
3. 锁定 `shared-contracts` 目录 CODEOWNERS。
4. 启动第 2 周任务（租户上下文与鉴权链路）。
