# Roadmap: Sulfur Recipes — Local Migration

## Overview

Three-phase migration: strip Replit/DB cruft, Dockerize for local dev, then deploy to Cloudflare (Pages + Workers + KV). When done, `docker compose up` works locally and the app runs for free on Cloudflare's edge with no sleep or cold starts.

## Phases

- [x] **Phase 1: Cleanup** - Remove Replit dependencies, Vite env-var throws, and the unused DB package
- [x] **Phase 2: Docker & DX** - Containerize both services, wire them together, document local dev
- [ ] **Phase 3: Cloudflare Deploy** - Frontend on Cloudflare Pages, API rewritten as a Cloudflare Worker with KV cache

## Phase Details

### Phase 1: Cleanup
**Goal**: Codebase runs without Replit or PostgreSQL dependencies
**Depends on**: Nothing (first phase)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04
**Success Criteria** (what must be TRUE):
  1. `lib/db` package and all postgres-related deps are absent from the workspace
  2. Vite config builds without `PORT` or `BASE_PATH` env vars set — no throw, no error
  3. Replit Vite plugins are removed from `artifacts/sulfur-recipe-finder`
  4. `pnpm-workspace.yaml` and root `tsconfig.json` have no reference to `lib/db`
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Remove lib/db package and all postgres deps from workspace
- [x] 01-02-PLAN.md — Remove Replit Vite plugins and rewrite vite.config.ts with safe defaults

### Phase 2: Docker & DX
**Goal**: Full app runs locally with `docker compose up` and developer onboarding is documented
**Depends on**: Phase 1
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, DX-01, DX-02
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts both services with no manual steps
  2. Frontend loads in the browser and recipe searches return data
  3. `.env.example` documents every env var needed to run locally
  4. README (or replit.md) explains how to run the app with Docker
**Plans**: 2 plans
Plans:
- [x] 02-01-PLAN.md — Dockerfiles for api-server (multi-stage esbuild) and frontend (multi-stage nginx)
- [x] 02-02-PLAN.md — docker-compose.yml, nginx.conf proxy, .env.example, replit.md local-dev section
**UI hint**: yes

### Phase 3: Cloudflare Deploy
**Goal**: App runs for free on Cloudflare with no sleep, no cold starts, global edge network
**Depends on**: Phase 1 (Phase 2 optional — Docker is local-dev only)
**Requirements**: HOST-01, HOST-02, HOST-03
**Success Criteria** (what must be TRUE):
  1. Frontend deploys to Cloudflare Pages and loads in the browser
  2. API runs as a Cloudflare Worker — scrape routes return data
  3. Cache uses Cloudflare KV with 1h TTL (no in-memory cache)
  4. `wrangler deploy` ships both frontend and worker from the monorepo
**Plans**: TBD — plan when ready
**Notes**: In-memory cache replaced with KV (`env.CACHE.get/put`). Scraping logic unchanged.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cleanup | 2/2 | ✅ Done | 2026-04-28 |
| 2. Docker & DX | 2/2 | ✅ Done | 2026-04-28 |
| 3. Cloudflare Deploy | 0/? | Not started | - |
