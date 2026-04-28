# Roadmap: Sulfur Recipes — Local Migration

## Overview

Two-phase migration: strip Replit/DB cruft from the codebase, then Dockerize both services and document local dev. When done, `docker compose up` delivers a fully working app with no cloud accounts required.

## Phases

- [ ] **Phase 1: Cleanup** - Remove Replit dependencies, Vite env-var throws, and the unused DB package
- [ ] **Phase 2: Docker & DX** - Containerize both services, wire them together, document local dev

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
**Plans**: TBD

### Phase 2: Docker & DX
**Goal**: Full app runs locally with `docker compose up` and developer onboarding is documented
**Depends on**: Phase 1
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, DX-01, DX-02
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts both services with no manual steps
  2. Frontend loads in the browser and recipe searches return data
  3. `.env.example` documents every env var needed to run locally
  4. README (or replit.md) explains how to run the app with Docker
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cleanup | 0/? | Not started | - |
| 2. Docker & DX | 0/? | Not started | - |
