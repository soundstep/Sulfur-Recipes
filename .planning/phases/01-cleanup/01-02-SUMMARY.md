# Plan 01-02 Summary: Rewrite vite.config.ts, Remove Replit Plugins

**Phase:** 01-cleanup  
**Plan:** 01-02  
**Status:** Complete  
**Completed:** 2026-04-28

## What Was Built

Removed all Replit-specific Vite plugins from the frontend and replaced the throw-on-missing-env pattern with sensible local defaults. Also fixed a pre-existing build breakage caused by workspace overrides that excluded macOS native binaries for rollup and lightningcss.

## Tasks Completed

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Rewrite vite.config.ts | ✓ | Removed 3 Replit plugin imports, replaced throw-on-missing-env with defaults (PORT→5173, BASE_PATH→"/") |
| Task 2: Remove @replit/* devDeps and verify build | ✓ | Removed from both sulfur-recipe-finder and mockup-sandbox; pnpm build exits 0 |

## Key Files Modified

- `artifacts/sulfur-recipe-finder/vite.config.ts` — rewritten with safe defaults
- `artifacts/sulfur-recipe-finder/package.json` — removed 3 `@replit/vite-plugin-*` devDependencies
- `artifacts/mockup-sandbox/package.json` — removed 2 `@replit/vite-plugin-*` devDependencies
- `pnpm-workspace.yaml` — removed `@replit/vite-plugin-*` and `drizzle-orm` catalog entries; fixed darwin rollup/lightningcss overrides

## Deviations

- **mockup-sandbox/package.json modified (not in original file list):** The `@replit/*` catalog entries could not be removed from `pnpm-workspace.yaml` until all packages referencing them were updated. `mockup-sandbox` referenced two of them, so it was cleaned alongside `sulfur-recipe-finder`.
- **rollup and lightningcss darwin overrides fixed:** Pre-existing overrides excluded `@rollup/rollup-darwin-arm64` and `lightningcss-darwin-arm64` (and x64 variants) from installation, which caused `pnpm build` to fail on macOS before our changes. Changed from `'-'` (exclude) to `'*'` (allow) to restore macOS build capability.

## Verification

```
✓ 0 @replit imports in vite.config.ts
✓ 0 throw new Error statements in vite.config.ts
✓ port defaults to 5173 (no PORT env required)
✓ 0 @replit deps in sulfur-recipe-finder/package.json
✓ 0 @replit deps in mockup-sandbox/package.json
✓ pnpm install exits 0
✓ pnpm build in artifacts/sulfur-recipe-finder exits 0
✓ dist/public/index.html exists
```

## Self-Check: PASSED
