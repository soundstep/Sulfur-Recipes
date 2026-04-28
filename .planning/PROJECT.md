# Sulfur Recipes — Local Migration

## What This Is

A recipe finder app for the game Sulfur, originally built on Replit. It consists of a React frontend (Vite + Tailwind + shadcn/ui) and an Express API server that scrapes and caches recipe data from the Sulfur wiki. The goal of this project is to make it run cleanly outside of Replit — locally via Docker, and eventually on a free hosting provider.

## Core Value

A developer can clone the repo, run `docker compose up`, and have the full app working locally without any Replit account or cloud dependencies.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Remove all Replit-specific dependencies and configuration (vite plugins, env var assumptions)
- [ ] Remove the unused PostgreSQL/DB lib entirely (no tables, never imported)
- [ ] Clean up vite.config.ts to work without PORT/BASE_PATH env var requirements
- [ ] Add Dockerfile for the API server
- [ ] Add Dockerfile for the frontend (build + serve)
- [ ] Add docker-compose.yml that wires both services together
- [ ] App runs end-to-end with `docker compose up` locally
- [ ] Investigate free hosting options for future deployment

### Out of Scope

- Adding new features to the recipe finder — migration only
- Rewriting the wiki scraping logic — it works, leave it
- Adding a database for persistence — app currently has no persistence needs

## Context

- pnpm monorepo workspace with shared libs
- `artifacts/api-server`: Express server, scrapes sulfur.wiki.gg, caches in memory (1h TTL)
- `artifacts/sulfur-recipe-finder`: React + Vite frontend
- `lib/db`: Drizzle ORM + pg scaffolding — **completely unused**, no tables defined, no imports
- `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`: shared API types and client
- Replit config (`.replit`, `replit.md`) can be left in place or removed — not harmful
- The Vite config currently throws if `PORT` or `BASE_PATH` env vars are missing — needs fixing

## Constraints

- **Tech stack**: Must stay pnpm monorepo — don't flatten or restructure the workspace
- **Runtime**: Node.js (currently node 24 per `.replit` modules)
- **No DB**: Removing postgres is the right call — nothing uses it

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remove lib/db entirely | Zero tables, never imported, postgres dep has no purpose | — Pending |
| Clean vite.config.ts | Replit plugins + mandatory PORT/BASE_PATH are local-only concerns | — Pending |
| Docker Compose for local dev | Standard approach, easy to extend for hosting later | — Pending |

---
*Last updated: 2026-04-28 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
