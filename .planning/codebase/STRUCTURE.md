# Codebase Structure

**Analysis Date:** 2026-04-28

## Directory Layout

```
Sulfur-Recipes/                     # pnpm workspace root
├── artifacts/                      # Deployable applications
│   ├── api-server/                 # Node.js Express REST API
│   │   └── src/
│   │       ├── index.ts            # Server entry point (requires PORT env)
│   │       ├── app.ts              # Express app setup + middleware
│   │       ├── lib/
│   │       │   └── logger.ts       # Pino logger instance
│   │       ├── middlewares/        # Placeholder (currently empty, .gitkeep)
│   │       └── routes/
│   │           ├── index.ts        # Root router — mounts health + recipes
│   │           ├── health.ts       # GET /api/healthz
│   │           └── recipes.ts      # GET /api/recipes, POST /api/recipes/refresh
│   ├── sulfur-recipe-finder/       # React SPA (Vite)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.tsx            # React entry point
│   │       ├── App.tsx             # QueryClientProvider + router
│   │       ├── index.css           # Global styles + Tailwind v4 tokens
│   │       ├── pages/
│   │       │   ├── Home.tsx        # Main page: inventory, scoring, recipe list
│   │       │   └── not-found.tsx   # 404 fallback
│   │       ├── components/
│   │       │   ├── recipe-card.tsx # Recipe display component + ScoredRecipe type
│   │       │   └── ui/             # shadcn/ui + custom cyber-themed primitives
│   │       ├── hooks/
│   │       │   ├── use-recipes.ts  # Wrappers around generated API hooks
│   │       │   ├── use-mobile.tsx  # Breakpoint detection hook
│   │       │   └── use-toast.ts    # Toast notification hook
│   │       └── lib/
│   │           └── utils.ts        # cn() Tailwind merge utility
│   └── mockup-sandbox/             # Vite sandbox for UI prototyping
│       └── src/
│           ├── App.tsx             # Mockup renderer
│           ├── .generated/
│           │   └── mockup-components.ts  # Auto-generated component registry
│           └── components/ui/      # Mirror of recipe-finder ui components
├── lib/                            # Shared workspace libraries
│   ├── api-spec/                   # OpenAPI contract (source of truth)
│   │   ├── openapi.yaml            # OpenAPI 3.1 spec
│   │   └── orval.config.ts         # Code generation config → lib/api-zod & lib/api-client-react
│   ├── api-zod/                    # Zod schemas + TS types (generated)
│   │   └── src/
│   │       ├── index.ts            # Public barrel export
│   │       └── generated/
│   │           ├── api.ts          # Route-level zod schemas
│   │           └── types/          # One file per schema (Recipe, ErrorResponse, etc.)
│   ├── api-client-react/           # React Query hooks (generated)
│   │   └── src/
│   │       ├── index.ts            # Public barrel export
│   │       ├── custom-fetch.ts     # Base URL + auth token configuration
│   │       └── generated/
│   │           ├── api.ts          # useGetRecipes, useRefreshRecipes hooks
│   │           └── api.schemas.ts  # Zod validators for API responses
│   └── db/                         # Drizzle ORM (scaffolded, no tables)
│       ├── drizzle.config.ts
│       └── src/
│           ├── index.ts
│           └── schema/
│               └── index.ts        # Schema barrel (empty — export {})
├── scripts/                        # Workspace utility scripts
│   ├── src/
│   │   └── hello.ts
│   └── post-merge.sh
├── package.json                    # Workspace root — typecheck + build scripts
├── pnpm-workspace.yaml             # Workspace package globs + catalog versions
├── tsconfig.base.json              # Shared TS base config
├── tsconfig.json                   # Composite project references
└── .planning/                      # GSD planning documents
    └── codebase/                   # Codebase map documents (this file's home)
```

## Directory Purposes

**`artifacts/`:**
- Purpose: Contains all deployable application packages
- Contains: API server and React SPA; each is an independent `pnpm` workspace package
- Key files: `artifacts/api-server/src/routes/recipes.ts`, `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`

**`lib/`:**
- Purpose: Shared library packages consumed by artifacts
- Contains: OpenAPI spec, generated type/validation libraries, DB schema
- Key files: `lib/api-spec/openapi.yaml`, `lib/api-client-react/src/custom-fetch.ts`

**`lib/api-spec/`:**
- Purpose: The authoritative API contract — edit here to update all generated code
- Key files: `openapi.yaml` (spec), `orval.config.ts` (points Orval at api-zod and api-client-react output dirs)

**`lib/api-zod/src/generated/`:**
- Purpose: Machine-generated Zod schemas and TypeScript types — **never edit manually**
- Generated: Yes (by Orval from `lib/api-spec/openapi.yaml`)

**`lib/api-client-react/src/generated/`:**
- Purpose: Machine-generated React Query hooks — **never edit manually**
- Generated: Yes (by Orval from `lib/api-spec/openapi.yaml`)

**`artifacts/sulfur-recipe-finder/src/components/ui/`:**
- Purpose: shadcn/ui component library plus two custom cyber-themed primitives
- Key files: `cyber-button.tsx`, `cyber-panel.tsx` (custom); all others are standard shadcn/ui

**`artifacts/mockup-sandbox/`:**
- Purpose: Isolated Vite environment to prototype UI components without the API dependency
- Generated: `src/.generated/mockup-components.ts` is auto-generated by `mockupPreviewPlugin.ts`

## Key File Locations

**Entry Points:**
- `artifacts/api-server/src/index.ts`: API server bootstrap (reads `PORT` env var)
- `artifacts/sulfur-recipe-finder/src/main.tsx`: React app mount point
- `artifacts/mockup-sandbox/src/main.tsx`: Mockup sandbox mount point

**API Contract:**
- `lib/api-spec/openapi.yaml`: OpenAPI 3.1 spec — the single source of truth for all endpoints

**Core Business Logic:**
- `artifacts/api-server/src/routes/recipes.ts`: Wiki scraping, wikitext parsing, in-memory cache
- `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`: Inventory scoring algorithm (`buildCraftableSet`, `scoreRecipe`)

**Shared Hooks:**
- `artifacts/sulfur-recipe-finder/src/hooks/use-recipes.ts`: Thin wrappers over generated API hooks

**UI Primitives:**
- `artifacts/sulfur-recipe-finder/src/components/ui/cyber-button.tsx`: Custom cyber button
- `artifacts/sulfur-recipe-finder/src/components/ui/cyber-panel.tsx`: Custom cyber panel wrapper
- `artifacts/sulfur-recipe-finder/src/lib/utils.ts`: `cn()` helper (clsx + tailwind-merge)

**Configuration:**
- `pnpm-workspace.yaml`: Package catalog versions (authoritative for all dependency versions)
- `tsconfig.base.json`: Shared TypeScript compiler options
- `lib/api-spec/orval.config.ts`: Code generation targets and options

## Naming Conventions

**Files:**
- React components: `kebab-case.tsx` (e.g., `recipe-card.tsx`, `cyber-button.tsx`)
- React pages: `PascalCase.tsx` for main pages (e.g., `Home.tsx`), `kebab-case.tsx` for error pages (e.g., `not-found.tsx`)
- Hooks: `use-<name>.ts` (e.g., `use-recipes.ts`, `use-mobile.tsx`)
- Server files: `kebab-case.ts` (e.g., `app.ts`, `routes/health.ts`)

**Directories:**
- Feature directories: `kebab-case` (e.g., `api-server`, `api-client-react`)
- Auto-generated output: `generated/` subdirectory within each lib package
- UI components: `ui/` subdirectory within `components/`

**Package names:**
- All workspace packages follow `@workspace/<name>` convention (e.g., `@workspace/api-client-react`)

## Where to Add New Code

**New API endpoint:**
1. Add path/schema to `lib/api-spec/openapi.yaml`
2. Run Orval to regenerate `lib/api-zod/` and `lib/api-client-react/`
3. Implement handler in a new file: `artifacts/api-server/src/routes/<resource>.ts`
4. Mount it in `artifacts/api-server/src/routes/index.ts`

**New React page:**
- Implementation: `artifacts/sulfur-recipe-finder/src/pages/<PageName>.tsx`
- Add route in: `artifacts/sulfur-recipe-finder/src/App.tsx`

**New shared UI component:**
- shadcn/ui components: `artifacts/sulfur-recipe-finder/src/components/ui/<component-name>.tsx`
- Feature-specific components: `artifacts/sulfur-recipe-finder/src/components/<component-name>.tsx`

**New custom hook:**
- Location: `artifacts/sulfur-recipe-finder/src/hooks/use-<name>.ts`

**New database table:**
- Define table in a new file: `lib/db/src/schema/<table-name>.ts` (use drizzle-orm/pg-core pattern from comments in `lib/db/src/schema/index.ts`)
- Export from: `lib/db/src/schema/index.ts`

**New shared utility script:**
- Location: `scripts/src/<script-name>.ts`

## Special Directories

**`lib/api-zod/src/generated/`:**
- Purpose: Zod schemas generated by Orval
- Generated: Yes — run Orval from `lib/api-spec/`
- Committed: Yes (generated output is committed)

**`lib/api-client-react/src/generated/`:**
- Purpose: React Query hooks generated by Orval
- Generated: Yes — run Orval from `lib/api-spec/`
- Committed: Yes

**`artifacts/mockup-sandbox/src/.generated/`:**
- Purpose: Auto-generated mockup component registry
- Generated: Yes (by `mockupPreviewPlugin.ts` at dev time)
- Committed: Yes

**`artifacts/api-server/src/middlewares/`:**
- Purpose: Placeholder directory for future Express middleware
- Generated: No
- Committed: Yes (contains `.gitkeep` only)

---

*Structure analysis: 2026-04-28*
