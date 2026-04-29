# Contributing

pnpm monorepo. Node 24. Two ways to run: Docker (simplest) or bare Node for development.

## Prerequisites

- [Node.js 24](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation) — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Docker workflow only)

---

## Local development — Docker

The simplest way. No Node setup needed beyond Docker.

```bash
cp .env.example .env
docker compose up --build
```

App runs at `http://localhost:3000`. Rebuild after code changes:

```bash
docker compose up --build
docker compose down   # stop
```

---

## Local development — bare Node

```bash
pnpm install
```

The API server and frontend must be run separately. The frontend dev server proxies `/api/*` to the API server.

```bash
# Terminal 1 — API server (http://localhost:3001)
PORT=3001 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (http://localhost:5173)
pnpm --filter @workspace/sulfur-recipe-finder run dev
```

---

## Common commands

| Command | What it does |
|---------|--------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm run typecheck` | Typecheck all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-server run dev` | Run API server in dev mode |
| `pnpm --filter @workspace/sulfur-recipe-finder run dev` | Run frontend dev server |
| `pnpm --filter @workspace/api-server run typecheck` | Typecheck API server only |
| `pnpm --filter @workspace/sulfur-recipe-finder run build` | Build frontend only |

---

## Project structure

```
artifacts/
  api-server/             — Express 5 API (scrapes sulfur.wiki.gg, caches recipes)
  sulfur-recipe-finder/   — React + Vite frontend
  worker/                 — Cloudflare Worker (production API, uses KV cache)
lib/
  recipe-core/            — Platform-agnostic recipe logic shared by api-server and worker
  api-spec/               — OpenAPI spec + Orval codegen config
  api-zod/                — Generated Zod schemas
  api-client-react/       — Generated React Query hooks
scripts/
  seed-kv.mjs             — Pre-populate Cloudflare KV with recipe data
```

---

## Adding a new recipe

When a new recipe is added to [sulfur.wiki.gg](https://sulfur.wiki.gg), you need to add its slug in **two places**:

**1. `lib/recipe-core/src/recipes.ts`** — `RECIPE_SLUGS` array. Used by the local Docker/Express server.

**2. `scripts/seed-kv.mjs`** — `RECIPE_SLUGS` array. Used by the Cloudflare KV seeder.

The slug is the page name from the wiki URL. For example:
- `https://sulfur.wiki.gg/wiki/Mushroom_Soup` → `"Mushroom_Soup"`
- `https://sulfur.wiki.gg/wiki/Mac%27n%27Cheese` → `"Mac%27n%27Cheese"` (URL-encoded as-is)

After adding the slug, re-seed the production cache:

```bash
node scripts/seed-kv.mjs
```

This fetches all recipes from the wiki and writes the result to Cloudflare KV. No redeploy needed — the Worker reads from KV on every request.

> **Note:** You must be authenticated with Cloudflare (`npx wrangler whoami`) to run the seed script.

---

## Cloudflare deployment

The app is deployed as:
- **Frontend** — Cloudflare Pages
- **API** — Cloudflare Worker with KV cache

Deploy both with one command from the repo root:

```bash
pnpm run deploy
```

This builds the frontend, deploys the Worker, then deploys the Pages site.

To update only the Worker:

```bash
npx wrangler deploy --config artifacts/worker/wrangler.jsonc
```

To update only the frontend:

```bash
pnpm --filter @workspace/sulfur-recipe-finder build
npx wrangler pages deploy artifacts/sulfur-recipe-finder/dist/public --project-name sulfur-recipes
```

### KV cache

The Worker serves recipes from Cloudflare KV (24h TTL). On cache miss it attempts a live fetch from the wiki, but this can time out on the Worker free tier due to the volume of requests. Pre-seeding KV is the reliable path:

```bash
node scripts/seed-kv.mjs
```

Run this after any deployment or when recipes are stale.
