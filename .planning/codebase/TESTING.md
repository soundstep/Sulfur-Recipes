# Testing Patterns

**Analysis Date:** 2026-04-28

## Test Framework

**Runner:** None detected

No test framework is installed or configured in this codebase. There are no `jest.config.*`, `vitest.config.*`, or equivalent files. No `*.test.*` or `*.spec.*` files exist anywhere in the project tree. No test-related scripts are defined in any `package.json`.

**Run Commands:**
```bash
# No test commands available
pnpm run typecheck       # Closest quality gate: TypeScript typechecking
pnpm run build           # Runs typecheck + build across all packages
```

## Test File Organization

**Location:** None — no test files exist

**Naming:** No established convention

**Structure:** Not applicable

## Test Structure

No test suites, describe blocks, or test cases exist in this codebase.

The only quality assurance mechanisms present are:

1. **TypeScript typechecking** — enforced via strict `tsconfig.base.json` settings across all packages
2. **Build-time validation** — `pnpm run build` runs `typecheck` before building
3. **Runtime validation** — Zod schemas parse and validate API responses at runtime (see `lib/api-zod/src/generated/api.ts`)

## Mocking

**Framework:** None

No mocking library (e.g., `msw`, `nock`, `jest.mock`) is installed.

## Fixtures and Factories

**Test Data:** None

No fixture files, factory functions, or seed data for tests exist.

## Coverage

**Requirements:** None enforced

No coverage thresholds, coverage reporters, or coverage commands are configured.

## Test Types

**Unit Tests:** Not present

**Integration Tests:** Not present

**E2E Tests:** Not present

## Recommendations for Adding Tests

When tests are added to this project, the following patterns are recommended based on the existing stack:

**Recommended Framework:** Vitest (compatible with ESM, TypeScript, and the Vite-based frontend)

**Suggested Config Location:** `artifacts/api-server/vitest.config.ts` for backend; `artifacts/mockup-sandbox/vitest.config.ts` for frontend

**Suggested Test File Locations:**
- Backend: `artifacts/api-server/src/**/*.test.ts` (co-located with source)
- Frontend: `artifacts/mockup-sandbox/src/**/*.test.tsx`
- Shared lib: `lib/api-client-react/src/**/*.test.ts`

**Suggested Test Script:**
```json
// In each package.json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Key Areas Lacking Test Coverage:**

- `artifacts/api-server/src/routes/recipes.ts` — `parseRecipeRows`, `cleanLabel`, `detectType`, `resolveCategoryMembers` are pure functions easily unit-tested
- `artifacts/api-server/src/routes/recipes.ts` — `fetchRecipeFromApi` and `getRecipesData` require mocking `fetch` and cache state
- `lib/api-client-react/src/custom-fetch.ts` — `ApiError`, `ResponseParseError`, `customFetch`, `mergeHeaders`, `buildErrorMessage` are all testable in isolation
- `lib/api-zod/src/generated/api.ts` — Zod schemas can be tested with valid/invalid input objects

**Async Testing Pattern (when implemented):**
```typescript
// Vitest pattern for async
import { describe, it, expect, vi } from "vitest";

describe("parseRecipeRows", () => {
  it("returns empty variants for empty wikitext", () => {
    const result = parseRecipeRows("");
    expect(result.variants).toEqual([]);
  });
});
```

**Mocking Fetch (when implemented):**
```typescript
import { vi } from "vitest";

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ parse: { title: "Bread", wikitext: { "*": "..." } } }),
}));
```

---

*Testing analysis: 2026-04-28*
