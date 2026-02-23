# Backend Handoff Package - auth_user_activities_points

## Branch
- Suggested branch: `codex/auth_user_activities_points`

## Included files
- `api-contract-c-v1.md` (C-side frozen API contract)
- `openapi-c-v1.yaml` (OpenAPI source of truth)
- `architecture.md` (system architecture)
- `保云链需求文档 (1).docx` (business PRD)

## Prototype reference
- C-side prototype folder:
  - `/Users/wenshuping/Desktop/code/insurance_increase/ui_product 3/客户端小程序UI`

## Module scope
- Auth
  - `POST /api/auth/send-code`
  - `POST /api/auth/verify-basic`
- User
  - `GET /api/bootstrap`
  - `GET /api/me`
- Activities
  - `GET /api/activities`
  - `POST /api/activities/:id/complete`
  - `POST /api/sign-in`
- Points
  - `GET /api/points/summary`
  - `GET /api/points/transactions`

## Skeleton files to implement
- `server/skeleton-c-v1/routes/auth.routes.mjs`
- `server/skeleton-c-v1/routes/user.routes.mjs`
- `server/skeleton-c-v1/routes/activities.routes.mjs`
- `server/skeleton-c-v1/routes/points.routes.mjs`

## Definition of done
1. All endpoints above return contract-compliant payloads.
2. Error format is exactly `{code, message}`.
3. Auth-required endpoints enforce Bearer auth.
4. Idempotency applied for sign-in and activity-complete.
5. Self smoke test passed (success + at least one failure case per endpoint).
