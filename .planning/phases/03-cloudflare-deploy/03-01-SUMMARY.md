---
phase: 03-cloudflare-deploy
plan: "01"
subsystem: infra
tags: [typescript, monorepo, pnpm, workspace, recipe-core, cachestore]

requires:
  - phase: 01-cleanup
    provides: Clean monorepo with artifacts/api-server Express server and existing recipe logic

provides:
  - Platform-agnostic lib/recipe-core package with CacheStore interface
  - MemoryCacheStore in-memory adapter
  - getRecipesData(cache) accepting any CacheStore implementation
  - artifacts/api-server wired to use recipe-core via MemoryCacheStore

affects:
  - 03-02 (Worker plan — imports lib/recipe-core and provides KV adapter)

tech-stack:
  added: ["@workspace/recipe-core workspace package"]
  patterns:
    - "CacheStore interface pattern — platform-agnostic cache abstraction"
    - "Adapter pattern — MemoryCacheStore for local/Express, KVCacheStore for Worker"

key-files:
  created:
    - lib/recipe-core/package.json
    - lib/recipe-core/tsconfig.json
    - lib/recipe-core/src/cache.ts
    - lib/recipe-core/src/recipes.ts
    - lib/recipe-core/src/adapters/memory.ts
    - lib/recipe-core/src/index.ts
  modified:
    - artifacts/api-server/package.json
    - artifacts/api-server/src/routes/recipes.ts
    - artifacts/api-server/tsconfig.json

key-decisions:
  - "Added lib: dom to recipe-core tsconfig for fetch/AbortSignal types (platform-agnostic fetch is dom-typed)"
  - "MemoryCacheStore.invalidate() accepts optional key — clear one entry or all"
  - "Removed stale lib/db tsconfig reference from api-server (lib/db does not exist)"

requirements-completed: []

duration: 3min
completed: 2026-04-28
---

# Phase 3 Plan 01: Extract recipe logic into `lib/recipe-core` Summary

**Platform-agnostic `@workspace/recipe-core` package with CacheStore interface and MemoryCacheStore adapter; Express routes rewritten to ~30 lines using the shared library**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-28T13:09:57Z
- **Completed:** 2026-04-28T13:13:15Z
- **Tasks:** 6
- **Files modified:** 9

## Accomplishments
- Created `lib/recipe-core` workspace package with all platform-agnostic recipe logic
- Defined `CacheStore` interface enabling swappable KV/memory implementations
- `MemoryCacheStore` in-memory adapter with TTL expiry and `invalidate()` method
- Express `routes/recipes.ts` reduced from 213 lines to 32 lines using imported library
- Both `lib/recipe-core` and `artifacts/api-server` typecheck clean

## Task Commits

1. **Task 1: Scaffold lib/recipe-core** - `e89644c` (chore)
2. **Tasks 2-4: CacheStore, recipes.ts, adapters, index** - `1798878`, `0fdd71d` (feat)
3. **Task 5: Wire api-server** - `8e2f279` (feat)

## Files Created/Modified
- `lib/recipe-core/package.json` - Workspace package declaration (`@workspace/recipe-core`)
- `lib/recipe-core/tsconfig.json` - Extends tsconfig.base.json, composite build with dom lib
- `lib/recipe-core/src/cache.ts` - `CacheStore` interface
- `lib/recipe-core/src/recipes.ts` - All recipe logic: slugs, parsing, fetching, `getRecipesData(cache)`
- `lib/recipe-core/src/adapters/memory.ts` - `MemoryCacheStore` with TTL + invalidate
- `lib/recipe-core/src/index.ts` - Public exports
- `artifacts/api-server/package.json` - Added `@workspace/recipe-core` dependency
- `artifacts/api-server/src/routes/recipes.ts` - Rewritten to use recipe-core
- `artifacts/api-server/tsconfig.json` - Removed stale lib/db ref, added recipe-core ref

## Decisions Made
- Added `"lib": ["es2022", "dom"]` to recipe-core tsconfig — `fetch` and `AbortSignal` are typed under `dom` even in non-browser runtimes; this is standard for isomorphic/edge code
- `MemoryCacheStore.invalidate()` accepts optional key for targeted or full cache bust
- Stale `lib/db` reference removed from api-server tsconfig (pre-existing, lib/db does not exist)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed stale `lib/db` tsconfig reference**
- **Found during:** Task 5 (api-server typecheck)
- **Issue:** `artifacts/api-server/tsconfig.json` referenced `../../lib/db` which doesn't exist, causing TS6053 error
- **Fix:** Removed the stale reference, added `../../lib/recipe-core` instead
- **Files modified:** artifacts/api-server/tsconfig.json
- **Verification:** `pnpm typecheck` passes with exit 0
- **Committed in:** 8e2f279

**2. [Rule 2 - Missing Critical] Added `lib: dom` to recipe-core tsconfig**
- **Found during:** Task 3/4 (building recipe-core declarations)
- **Issue:** Base tsconfig has `lib: ["es2022"]` only; `fetch` and `AbortSignal` not found
- **Fix:** Added `"lib": ["es2022", "dom"]` in recipe-core tsconfig override
- **Files modified:** lib/recipe-core/tsconfig.json
- **Verification:** `npx tsc -p tsconfig.json` builds clean
- **Committed in:** 8e2f279

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes essential for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `lib/recipe-core` is ready for the Cloudflare Worker (03-02) to import
- Worker needs only to implement a `KVCacheStore implements CacheStore` using `KVNamespace`
- Express local dev continues to work unchanged in behavior

---
*Phase: 03-cloudflare-deploy*
*Completed: 2026-04-28*

## Self-Check: PASSED

- [x] `lib/recipe-core/src/cache.ts` exists
- [x] `lib/recipe-core/src/recipes.ts` exists
- [x] `lib/recipe-core/src/adapters/memory.ts` exists
- [x] `lib/recipe-core/src/index.ts` exists
- [x] `pnpm typecheck` in api-server exits 0
- [x] `tsc -p tsconfig.json --noEmit` in recipe-core exits 0
- [x] No recipe logic (RECIPE_SLUGS, parseRecipeRows, fetchRecipeFromApi) in routes/recipes.ts
- [x] MemoryCacheStore and CacheStore exported from @workspace/recipe-core
