# External Integrations

**Analysis Date:** 2026-04-28

## APIs & External Services

**Sulfur Wiki (MediaWiki API):**
- Purpose: Fetches recipe wikitext for all items in the Sulfur game
- Endpoint: `https://sulfur.wiki.gg/api.php?action=parse&page={slug}&prop=wikitext&format=json`
- Auth: None (public API, User-Agent header sent: `SulfurRecipeFinder/1.0`)
- Implementation: `artifacts/api-server/src/routes/recipes.ts`
- Pattern: Batched concurrent fetches (10 at a time), in-memory cache with 1h TTL
- Timeout: 10 seconds per request (`AbortSignal.timeout(10000)`)
- ~130 recipe slugs fetched on first request, cached at module level

## Data Storage

**Databases:**
- PostgreSQL
  - Connection env var: `DATABASE_URL`
  - Client: `pg` ^8.20.0 (node-postgres) via `Pool`
  - ORM: Drizzle ORM ^0.45.1
  - Implementation: `lib/db/src/index.ts`
  - Schema push command: `pnpm run push` (via `drizzle-kit push`)
  - Schema location: `lib/db/src/schema/`

**File Storage:**
- Not detected — no S3, GCS, or local upload handling found

**Caching:**
- In-memory only — recipe data cached in module-level variable in `artifacts/api-server/src/routes/recipes.ts`
- TTL: 1 hour (`CACHE_TTL = 60 * 60 * 1000`)
- No Redis or distributed cache

## Authentication & Identity

**Auth Provider:**
- Not detected — no authentication middleware, sessions, or identity providers found
- API endpoints are open (no auth guards observed)

## Monitoring & Observability

**Logging:**
- Pino 9.x structured JSON logging (`artifacts/api-server/src/`)
- HTTP request logging via `pino-http` middleware in `artifacts/api-server/src/app.ts`
- Logger instance: `artifacts/api-server/src/lib/logger.ts`
- Dev: pino-pretty for human-readable output

**Error Tracking:**
- Not detected — no Sentry, Datadog, or equivalent SDK

**Metrics:**
- Not detected

## CI/CD & Deployment

**Hosting:**
- Replit — evidenced by `@replit/vite-plugin-*` packages, `REPL_ID` env var check in vite config, and `replit.md` at root

**CI Pipeline:**
- Not detected — no GitHub Actions, CircleCI, or equivalent config found

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL connection string (checked in `lib/db/src/index.ts`)
- `PORT` — HTTP port for API server and Vite dev server
- `BASE_PATH` — Vite base path for frontend build (checked in `artifacts/sulfur-recipe-finder/vite.config.ts`)

**Optional env vars:**
- `NODE_ENV` — Controls dev/production behavior
- `REPL_ID` — Presence enables Replit-specific Vite plugins (cartographer, dev-banner)

**Secrets location:**
- No `.env` files present — secrets injected via Replit's environment/secrets system

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Internal Service Communication

**Frontend → API Server:**
- Via `@workspace/api-client-react` lib (`lib/api-client-react/`)
- Uses TanStack React Query for data fetching
- REST API at `/api/recipes` (GET) and `/api/recipes/refresh` (POST)
- Frontend package: `artifacts/sulfur-recipe-finder/`
- API type contracts: `@workspace/api-zod` (`lib/api-zod/`) — shared Zod schemas

---

*Integration audit: 2026-04-28*
