# Coding Conventions

**Analysis Date:** 2026-04-28

## Naming Patterns

**Files:**
- `kebab-case` for multi-word files: `custom-fetch.ts`, `api-server`, `api-zod`, `api-client-react`
- `camelCase` for single-concept files: `logger.ts`, `recipes.ts`, `health.ts`
- `.tsx` extension for React components; `.ts` for everything else
- Generated files live in `src/generated/` and are prefixed with `// Do not edit manually.`
- Schema files named `index.ts` per directory (e.g., `lib/db/src/schema/index.ts`)

**Functions:**
- `camelCase` for all functions: `cleanLabel`, `parseRecipeRows`, `detectType`, `fetchRecipeFromApi`, `getRecipesData`, `resolveMethod`, `mergeHeaders`, `buildErrorMessage`
- Private/module-internal helpers are not exported; public API functions are explicitly exported
- Async functions explicitly typed as `Promise<T>`: `async function fetchRecipeFromApi(slug: string): Promise<...>`
- Utility helpers use descriptive verbs: `resolve`, `detect`, `parse`, `build`, `apply`, `merge`

**Variables:**
- `camelCase` for module-level variables: `cachedData`, `cacheTimestamp`, `CACHE_TTL`
- `SCREAMING_SNAKE_CASE` for true constants: `RECIPE_SLUGS`, `HARDCODED_CATEGORIES`, `CACHE_TTL`, `CONCURRENCY`, `NO_BODY_STATUS`, `DEFAULT_JSON_ACCEPT`
- Boolean flags named as questions: `isProduction`, `cancelled`

**Types & Interfaces:**
- `PascalCase` for all interfaces and types: `Recipe`, `RecipeCache`, `CustomFetchOptions`, `AuthTokenGetter`, `ErrorType`, `BodyType`
- Classes in `PascalCase`: `ApiError`, `ResponseParseError`
- Prefer `interface` for object shapes; `type` for unions, function types, and aliases
- Zod schemas use `PascalCase` matching the shape name: `HealthCheckResponse`, `GetRecipesResponse`

**Classes:**
- Use `readonly` on all class properties that are set once in the constructor
- Always call `Object.setPrototypeOf(this, new.target.prototype)` in Error subclasses for correct `instanceof` checks

## Code Style

**Formatting:**
- Tool: `prettier` ^3.8.1 (workspace devDependency in root `package.json`)
- No `.prettierrc` detected — likely uses Prettier defaults: 2-space indent, double quotes, trailing commas

**Linting:**
- No ESLint config detected in the project
- TypeScript compiler enforces quality through strict settings (see TypeScript section)

**TypeScript Strictness (from `tsconfig.base.json`):**
- `noImplicitAny: true` — no implicit `any`
- `strictNullChecks: true` — null/undefined must be handled
- `noImplicitReturns: true` — all code paths must return
- `noFallthroughCasesInSwitch: true` — switch cases must be exhaustive
- `useUnknownInCatchVariables: true` — catch bindings are typed as `unknown`
- `alwaysStrict: true` — `"use strict"` emitted
- `strictPropertyInitialization: true` — class properties must be initialized
- `noUnusedLocals: false` — unused locals allowed

## Import Organization

**Order (observed pattern):**
1. External packages: `import express from "express"`, `import pino from "pino"`
2. Workspace packages: `import { HealthCheckResponse } from "@workspace/api-zod"`
3. Local relative imports: `import router from "./routes"`, `import { logger } from "./lib/logger"`

**Path Aliases:**
- `@` maps to `src/` in `artifacts/mockup-sandbox` (configured in `vite.config.ts`)
- Workspace packages resolved via `@workspace/*` prefix (pnpm workspace protocol)

**Import Style:**
- Use `import type { ... }` for type-only imports: `import type { IRouter } from "express"`
- Named exports preferred; default exports used for routers and the React App component

## Error Handling

**Patterns:**
- Async route handlers wrapped in `try/catch`; errors logged with `req.log.error({ err }, "message")` and responded with `res.status(500).json({ error: "..." })`
- External fetch failures swallowed per-recipe (return `null`) to allow partial results: `catch { return { recipe: null, ... } }`
- Environment variable validation at startup: throw `new Error(...)` immediately when `PORT` is absent or invalid (see `artifacts/api-server/src/index.ts` and `artifacts/mockup-sandbox/vite.config.ts`)
- Custom `ApiError` and `ResponseParseError` classes in `lib/api-client-react/src/custom-fetch.ts` for typed HTTP error propagation
- Catch variables typed as `unknown` (enforced by `useUnknownInCatchVariables`); narrowed with `instanceof Error` before reading `.message`

**Never:**
- Never `console.error` or `console.log` — use the pino logger (`req.log` in route handlers, `logger` at module level)
- Never swallow errors silently at the route level — always return a structured JSON error response

## Logging

**Framework:** `pino` ^9 (via `pino-http` ^10 for request logging)

**Patterns:**
- Structured log objects: `logger.info({ port }, "Server listening")`, `logger.error({ err }, "...")`
- Request logging via `pinoHttp` middleware in `artifacts/api-server/src/app.ts`
- Sensitive headers redacted via `pino` `redact` config: `authorization`, `cookie`, `set-cookie`
- Pretty printing in development only (`pino-pretty` transport when `NODE_ENV !== "production"`)
- Log level configured via `LOG_LEVEL` env var, defaulting to `"info"`

## Comments

**When to Comment:**
- JSDoc/TSDoc on exported public API functions: `/** Set a base URL... */`
- Inline comments to explain non-obvious runtime behavior: `// Use loose check for URL — some runtimes...`
- Comment blocks explaining cross-runtime compatibility concerns (React Native, browser differences)
- Schema files use `// Export your models here.` guide-comment pattern (see `lib/db/src/schema/index.ts`)

**Generated Code:**
- Files generated by orval are marked with a header: `// Generated by orval v8.5.3 🍺 — Do not edit manually.`

## Function Design

**Size:** Functions are small and single-purpose; parsing, detecting, and fetching each have dedicated functions

**Parameters:** 
- Explicit TypeScript types on all parameters
- Options objects use `interface` types for named shapes
- `_` prefix for intentionally unused parameters: `(_req, res) =>` in health route

**Return Values:**
- Always explicitly typed for exported/async functions
- Return `null` (not `undefined`) for absent optional values; use `null` consistently with JSON semantics

## Module Design

**Exports:**
- One default export per route file (the Router instance)
- Library packages export from `src/index.ts` barrel file
- Generated code exports types from `src/generated/types/index.ts`

**Barrel Files:**
- `lib/api-zod/src/index.ts` re-exports generated types and schema validators
- `lib/api-client-react/src/index.ts` re-exports generated hooks and `custom-fetch` utilities
- `lib/db/src/schema/index.ts` acts as schema barrel (currently empty stub)

**Package Scoping:**
- All workspace packages scoped under `@workspace/*`
- Packages use `"type": "module"` (ESM-first)
- Cross-package dependencies use `workspace:*` protocol

---

*Convention analysis: 2026-04-28*
