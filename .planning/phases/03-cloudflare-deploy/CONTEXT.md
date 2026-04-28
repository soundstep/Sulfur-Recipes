# Phase 3: Cloudflare Deploy — Context

## Goal

Deploy the Sulfur Recipes app to Cloudflare: frontend on Pages, API as a Worker with KV cache. No sleep, no cold starts, free tier.

## User Constraints

- **Keep Cloudflare-specific code isolated** — the implementation must not bleed CF-specific APIs throughout the codebase. The core scraping/recipe logic must remain platform-agnostic. If Cloudflare doesn't work out, it should be swappable with minimal effort.
- Wrangler 4.85.0 is already installed globally.
- The Cloudflare MCP is available.

## What Exists

### Monorepo structure (pnpm)
```
artifacts/
  api-server/       — Express 5, esbuild bundle, Node 24
  sulfur-recipe-finder/ — React + Vite + Tailwind + shadcn/ui
lib/
  api-spec/         — shared route types
  api-zod/          — shared Zod schemas
  api-client-react/ — React Query hooks
```

### API Server (`artifacts/api-server`)
- Express 5 app, `"type": "module"`, compiled with esbuild
- Single routes file: `routes/recipes.ts`
  - `GET /api/recipes` — fetches + parses wikitext from sulfur.wiki.gg, caches in-memory (1h TTL)
  - `POST /api/recipes/refresh` — busts cache and re-fetches
- Core logic: `fetchRecipeFromApi()`, `parseRecipeRows()`, `detectType()`, `resolveCategoryMembers()` — pure functions, no Node-specific APIs (uses native `fetch`, no fs, no path)
- Cache: module-level variables (`cachedData`, `cacheTimestamp`) — must move to KV for Worker

### Frontend (`artifacts/sulfur-recipe-finder`)
- React + Vite SPA, outputs static files to `dist/`
- Talks to API via `/api/recipes` (relative URL, proxied through nginx in Docker)
- For Cloudflare: frontend on Pages, API on Workers — CORS or same-origin via Pages Functions proxy

## Portability Strategy (Key Constraint)

The goal is to isolate Cloudflare bindings at the **edge entry point only**. The recipe logic (scraping, parsing, cache read/write) should be expressed through thin interfaces:

```
Worker entry (CF-specific) → CachePort interface → KV adapter (CF-specific)
                           → recipe logic (platform-agnostic, reusable)
```

If we later move to Deno Deploy, Bun, or another edge runtime, only the entry file and KV adapter need to change.

**Concretely:**
- Extract `getRecipesData()` and its helpers into a platform-agnostic module (no Express, no Node-specific imports)
- Define a `CacheStore` interface with `get(key)` / `put(key, value, ttl)` — implemented by a KV adapter for CF, an in-memory adapter for local dev and Docker
- The Worker entry file (`worker/index.ts`) is the only file that imports `Env`, `KVNamespace`, etc.
- Express stays untouched for Docker local dev — it uses the in-memory cache adapter

## What Needs to Be Built

### 1. Extract recipe logic into a shared library (`lib/recipe-core`)
Platform-agnostic: `fetchRecipe`, `parseRecipeRows`, `getRecipesData(cache: CacheStore)`, `CacheStore` interface. No Express, no Node deps, no CF deps.

### 2. Cloudflare Worker (`artifacts/worker`)
- Thin entry: handles `GET /api/recipes`, `POST /api/recipes/refresh`
- Uses KV adapter implementing `CacheStore`
- `wrangler.jsonc` with KV binding `CACHE`
- CORS headers for Pages → Worker cross-origin

### 3. Cloudflare Pages (`artifacts/sulfur-recipe-finder`)
- `wrangler pages deploy ./dist` from existing Vite build
- Configure API base URL via env var (`VITE_API_URL`) pointing at Worker URL
- Or: use Pages Functions as a proxy (`/api/*` → Worker) to keep same-origin

### 4. Update Express server to use `lib/recipe-core`
Wire Express routes to call `getRecipesData()` with the in-memory `CacheStore` adapter. Logic lives in `lib/recipe-core`, Express is just the HTTP wrapper.

## Success Criteria (from ROADMAP)

1. Frontend deploys to Cloudflare Pages and loads in the browser
2. API runs as a Cloudflare Worker — scrape routes return data
3. Cache uses Cloudflare KV with 1h TTL (no in-memory cache in Worker)
4. `wrangler deploy` ships both frontend and worker from the monorepo

## Open Questions to Resolve During Planning

1. **Same-origin vs CORS**: Use Pages Functions proxy (`/api/*`) or expose Worker URL directly with CORS? Pages proxy keeps it cleaner (no VITE_API_URL needed, SPA just calls `/api/recipes`).
2. **wrangler.jsonc placement**: Root-level monorepo config vs per-package? Per-package is cleaner given existing workspace structure.
3. **`lib/recipe-core` as a workspace package or collocated?** Workspace package is consistent with existing `lib/` pattern.
4. **KV namespace creation**: Manual via `wrangler kv namespace create` + paste ID, or use `wrangler.jsonc` automatic provisioning (`preview_id` omitted)?
5. **Deploy script**: Single `wrangler deploy` (worker) + `wrangler pages deploy` (frontend) wired into a root `package.json` `deploy` script?

## Risks

- **Wiki scraping from CF Workers**: `fetch()` is available in Workers. sulfur.wiki.gg is a public site, no auth needed. Should work fine.
- **Worker startup size**: esbuild bundle of the recipe logic is small. KV + fetch is all that's needed. Low risk.
- **KV cold read**: First request after deploy hits KV miss → fetches all ~140 slugs. Concurrency=10 batches. ~14 sequential batches × network latency. Acceptable for a personal app.
- **Pages Functions proxy**: Adds a hop but avoids CORS complexity and VITE_API_URL config. Recommended unless latency is a concern.

## Deferred (v2 / Backlog)

- CI/CD pipeline (GitHub Actions → wrangler deploy on push)
- Custom domain
- Render.com fallback (researched in quick/20260428-001 — viable if CF doesn't work)
