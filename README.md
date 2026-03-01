<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c4d46c6c-1217-4d90-b074-78399e3cf4cc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Engineering Tooling

- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Unit tests: `npm test`
- Format: `npm run format`

## Security Toggles (API)

- `CSRF_PROTECTION=true|false` (default `true`)
- `REQUIRE_SENSITIVE_CONFIRM=true|false` (default `true`)

When enabled:
- Mutating API requests require `x-csrf-token`
- Sensitive operations (e.g. redeem/assign customer) require `x-action-confirm: YES`

## Docker Dev Environment

Use one command to start Web + API + Postgres + Redis:

`docker compose -f docker-compose.dev.yml up --build`

## Backend API (local)

This repo now includes a local Express + PostgreSQL API (runtime state stored in PostgreSQL):

1. Copy env template:
   `cp .env.example .env.local`
2. Configure PostgreSQL env in `.env.local` (see `.env.example`):
   `STORAGE_BACKEND=postgres`
   `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/insurance_code`
3. (First-time data import) generate SQL then apply:
   `node scripts/migrate_dbjson_to_postgres_v1.mjs`
   `npm run db:apply:dbjson`
4. Start API server:
   `npm run dev:api`
5. API health check:
   `http://localhost:4000/api/health`

Core endpoints implemented:

- `POST /api/auth/send-code`
- `POST /api/auth/verify-basic`
- `GET /api/me`
- `GET /api/activities`
- `POST /api/sign-in`
- `GET /api/points/summary`
- `GET /api/points/transactions`
- `GET /api/mall/items`
- `POST /api/mall/redeem`
- `GET /api/redemptions`
- `POST /api/redemptions/:id/writeoff`

## Documentation Index

- Docs index: `/Users/wenshuping/Documents/New project/insurance_code/docs/INDEX.md`
- Hybrid architecture roadmap (new): `/Users/wenshuping/Documents/New project/insurance_code/docs/architecture-hybrid-roadmap-v2.md`
