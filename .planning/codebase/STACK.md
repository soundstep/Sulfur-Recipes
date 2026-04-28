# Technology Stack

**Analysis Date:** 2026-04-28

## Languages

**Primary:**
- TypeScript ~5.9.2 - All packages (strict mode, ES2022 target, `noImplicitAny`, `strictNullChecks`)

**Secondary:**
- None - pure TypeScript monorepo

## Runtime

**Environment:**
- Node.js (ESM modules — `"type": "module"` in all packages)

**Package Manager:**
- pnpm (enforced via preinstall script that rejects npm/yarn)
- Lockfile: `pnpm-lock.yaml` — present
- Workspace: `pnpm-workspace.yaml` — defines catalog versions for shared deps

## Frameworks

**Frontend:**
- React 19.1.0 — UI framework (`artifacts/sulfur-recipe-finder/`)
- Vite 7.x — dev server and build tool
- Tailwind CSS 4.x — utility-first CSS (via `@tailwindcss/vite` plugin)
- shadcn/ui (new-york style) — component library built on Radix UI primitives

**Backend:**
- Express 5.x — HTTP server (`artifacts/api-server/`)
- Pino 9.x + pino-http 10.x — structured JSON logging

**Testing:**
- Not detected

**Build/Dev:**
- esbuild 0.27.3 — bundles the API server (via `build.mjs`)
- `esbuild-plugin-pino` ^2.3.3 — Pino transport support for esbuild
- tsx ^4.21.0 — TypeScript execution for scripts

## Key Dependencies

**Critical:**
- `drizzle-orm` ^0.45.1 — ORM for PostgreSQL (`lib/db/`)
- `drizzle-kit` ^0.31.9 — schema push CLI tool
- `drizzle-zod` ^0.8.3 — auto-generates Zod schemas from Drizzle tables
- `zod` ^3.25.76 — runtime validation, shared across all packages via catalog
- `pg` ^8.20.0 — PostgreSQL client (`lib/db/`)
- `@tanstack/react-query` ^5.90.21 — server state management (`lib/api-client-react/`, frontend)

**UI Components (Frontend):**
- `@radix-ui/*` — full suite of headless UI primitives (accordion, dialog, select, etc.)
- `lucide-react` ^0.545.0 — icon library
- `framer-motion` 12.35.1 — animation
- `wouter` ^3.3.5 — client-side routing
- `react-hook-form` ^7.55.0 + `@hookform/resolvers` — form handling
- `sonner` ^2.0.7 — toast notifications
- `recharts` ^2.15.2 — charts

**Infrastructure:**
- `cors` ^2 — CORS middleware for API server
- `cookie-parser` ^1.4.7 — cookie parsing middleware
- `cheerio` ^1.2.0 — HTML/XML parsing (server-side scraping)

## Configuration

**TypeScript:**
- Base config: `tsconfig.base.json` — shared strict settings, `moduleResolution: bundler`
- Root config: `tsconfig.json` — references lib packages
- Per-package: `artifacts/*/tsconfig.json`, `lib/*/tsconfig.json`, `scripts/tsconfig.json`

**Path Aliases (frontend):**
- `@/` → `artifacts/sulfur-recipe-finder/src/`
- `@assets/` → `attached_assets/`
- Configured in: `artifacts/sulfur-recipe-finder/vite.config.ts`

**shadcn/ui:**
- Config: `artifacts/sulfur-recipe-finder/components.json`
- Style: new-york, base color: neutral, CSS variables enabled

**Environment:**
- `DATABASE_URL` — PostgreSQL connection string (required at DB lib startup)
- `PORT` — HTTP port (required for both API server and frontend dev server)
- `BASE_PATH` — Vite base path for frontend build (required)
- No `.env` files detected — environment must be injected externally (Replit secrets)

**Build:**
- API server: `artifacts/api-server/build.mjs` (esbuild script)
- Frontend: Vite build → `artifacts/sulfur-recipe-finder/dist/public/`

## Platform Requirements

**Development:**
- Replit platform (Replit-specific Vite plugins: `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal`)
- pnpm required (enforced via preinstall hook)

**Production:**
- Node.js ESM runtime
- PostgreSQL database (required)
- Replit or compatible hosting

---

*Stack analysis: 2026-04-28*
