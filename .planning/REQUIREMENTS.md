# Requirements: Sulfur Recipes — Local Migration

**Defined:** 2026-04-28
**Core Value:** Clone the repo, run `docker compose up`, full app works locally with no Replit dependencies.

## v1 Requirements

### Cleanup

- [ ] **CLEAN-01**: Remove `lib/db` package and all PostgreSQL dependencies (`pg`, `drizzle-orm` postgres adapter, `@types/pg`, `drizzle-kit`, `drizzle-zod`) from the workspace
- [ ] **CLEAN-02**: Remove Replit-specific Vite plugins (`@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`) from `artifacts/sulfur-recipe-finder`
- [ ] **CLEAN-03**: Rewrite `vite.config.ts` so it does not throw when `PORT` or `BASE_PATH` env vars are absent — use sensible local defaults (port 5173, base `/`)
- [ ] **CLEAN-04**: Remove `lib/db` workspace reference from `pnpm-workspace.yaml` and root `tsconfig.json`

### Docker

- [ ] **DOCK-01**: Add `Dockerfile` for `artifacts/api-server` that builds and runs the Express server
- [ ] **DOCK-02**: Add `Dockerfile` for `artifacts/sulfur-recipe-finder` that builds the Vite app and serves it (nginx or node `vite preview`)
- [ ] **DOCK-03**: Add `docker-compose.yml` at the repo root that starts both services and wires them together (frontend proxies `/api` to the backend)
- [ ] **DOCK-04**: App starts and responds correctly with `docker compose up` — frontend loads, recipe fetch returns data

### Developer Experience

- [ ] **DX-01**: Add `.env.example` documenting any env vars needed to run locally
- [ ] **DX-02**: Add a brief local-dev section to `replit.md` or a new `README.md` explaining how to run with Docker

## v2 Requirements

### Hosting

- **HOST-01**: Evaluate free hosting options (Fly.io free tier, Render free tier, Railway free tier, Koyeb)
- **HOST-02**: Document chosen hosting provider and deploy steps
- **HOST-03**: Add CI/CD pipeline (GitHub Actions) for automatic deploys

## Out of Scope

| Feature | Reason |
|---------|--------|
| Adding SQLite or any database | App has no persistence needs — wiki data cached in memory |
| Adding new recipe features | Migration only — feature work is separate |
| Kubernetes / production orchestration | Overkill for a personal app |
| Rewriting the wiki scraper | It works — leave it |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 1 | Pending |
| CLEAN-02 | Phase 1 | Pending |
| CLEAN-03 | Phase 1 | Pending |
| CLEAN-04 | Phase 1 | Pending |
| DOCK-01 | Phase 2 | Pending |
| DOCK-02 | Phase 2 | Pending |
| DOCK-03 | Phase 2 | Pending |
| DOCK-04 | Phase 2 | Pending |
| DX-01 | Phase 2 | Pending |
| DX-02 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-04-28 after initial definition*
