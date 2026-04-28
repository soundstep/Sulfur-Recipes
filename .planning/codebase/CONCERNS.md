# Codebase Concerns

**Analysis Date:** 2026-04-28

---

## Tech Debt

**In-Memory Module-Level Cache (Single Instance Only):**
- Issue: Recipe data is cached in module-level variables (`cachedData`, `cacheTimestamp`) with a hardcoded 1-hour TTL. This is a singleton in the Node.js process — incompatible with multi-process or multi-instance deployments (e.g. PM2, containers with horizontal scaling).
- Files: `artifacts/api-server/src/routes/recipes.ts` (lines ~170–185)
- Impact: Cache is not shared across instances; each process independently hammers the wiki API on cold start. Also, an application restart wipes the cache with no persistence.
- Fix approach: Replace with an external cache (Redis, Upstash) or at minimum a persistent file cache. `@workspace/db` (Postgres/Drizzle) is already present and could store cached recipe data.

**Hardcoded Category Members:**
- Issue: `HARDCODED_CATEGORIES` in `artifacts/api-server/src/routes/recipes.ts` (lines ~25–32) contains a static, hard-coded mapping of ingredient categories to their members (e.g. flesh types, milk types). Any new in-game category additions or game updates require manual code edits.
- Files: `artifacts/api-server/src/routes/recipes.ts`
- Impact: Stale data if the game adds new ingredient variants. No mechanism to detect or warn about mismatches.
- Fix approach: Drive categories from a wiki API call (MediaWiki category members endpoint), or store mappings in the database for admin-editable configuration.

**Hardcoded Recipe Slug List:**
- Issue: `RECIPE_SLUGS` array (artifacts/api-server/src/routes/recipes.ts`, lines ~9–24) is a hard-coded list of ~130 wiki page slugs. Adding new recipes requires a code change and redeploy.
- Files: `artifacts/api-server/src/routes/recipes.ts`
- Impact: Any new recipe added to the game's wiki won't appear until a developer manually adds the slug and redeploys.
- Fix approach: Use the MediaWiki `allpages` or category query API to discover recipe pages dynamically.

**`@workspace/db` Schema is Empty/Stub:**
- Issue: `lib/db/src/schema/index.ts` contains only commented-out example code and an empty `export {}`. A Postgres DB is wired up (Drizzle config present, `DATABASE_URL` required) but no tables are defined. The database connection is established but never used by any application logic.
- Files: `lib/db/src/schema/index.ts`, `lib/db/drizzle.config.ts`
- Impact: Infrastructure cost and complexity without benefit. The DB dependency is a dead weight until schema is defined. Risk: `drizzle-kit push` against a production DB with no schema could cause unexpected behavior.
- Fix approach: Either define actual schema (e.g. cached_recipes table) or remove the DB dependency until it's needed.

**`/recipes/refresh` Endpoint Has No Authentication:**
- Issue: `POST /api/recipes/refresh` clears the server cache and triggers a full re-fetch from the wiki (100+ HTTP calls). This endpoint is publicly accessible with no auth, rate limiting, or token requirement.
- Files: `artifacts/api-server/src/routes/recipes.ts` (lines ~200–212), `artifacts/api-server/src/app.ts`
- Impact: Any actor can trigger a cache invalidation loop, causing excessive outbound HTTP traffic to sulfur.wiki.gg and potential IP bans or degraded performance.
- Fix approach: Add a shared secret header check, or rate-limit this endpoint.

**Frontend Uses `localStorage` Directly in Module Scope (SSR Risk):**
- Issue: In `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`, `useState` is initialized with `localStorage.getItem(STORAGE_KEY)` inline (line ~19). This will throw a `ReferenceError` if the component is ever rendered server-side.
- Files: `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`
- Impact: Currently safe since this is a pure client-side Vite app, but will break immediately if SSR/Next.js is introduced.
- Fix approach: Wrap in a `typeof window !== 'undefined'` guard or use a lazy initializer pattern.

**`useEffect` with Missing Dependency (`handleSetIngredients`):**
- Issue: In `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`, there is a `useEffect(() => { handleSetIngredients(inputText); }, [])` with an empty dependency array. The ESLint `exhaustive-deps` rule would flag this as missing `inputText` and `handleSetIngredients` as dependencies. This runs only once on mount which may be intentional, but is fragile.
- Files: `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`
- Impact: If component remounts (e.g. in Strict Mode), behavior may differ from intent. Suppressing the lint rule without comment makes intent unclear.
- Fix approach: Either add a comment explaining intent or use a ref to track first-mount initialization.

---

## Security Considerations

**CORS Wildcard (Open CORS):**
- Risk: `app.use(cors())` in `artifacts/api-server/src/app.ts` (line 28) uses the default cors configuration which allows all origins (`*`).
- Files: `artifacts/api-server/src/app.ts`
- Current mitigation: None.
- Recommendations: Restrict origins to the known frontend domain(s) in production via `cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') })`.

**No Rate Limiting on Any Endpoint:**
- Risk: There is no rate limiting middleware (e.g. `express-rate-limit`) on any route, including the expensive `/recipes/refresh` endpoint.
- Files: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/recipes.ts`
- Current mitigation: None.
- Recommendations: Add `express-rate-limit` at minimum on `/api/recipes/refresh`. Consider global rate limiting for all `/api` routes.

**No HTTP Security Headers:**
- Risk: `helmet` or equivalent is not used. The server sends no `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, or similar headers.
- Files: `artifacts/api-server/src/app.ts`
- Current mitigation: None.
- Recommendations: Add `helmet` as Express middleware.

---

## Performance Bottlenecks

**Cold Start: 100+ Serial Wiki HTTP Requests (Batched but Slow):**
- Problem: On cache miss (server start or after refresh), `getRecipesData()` fetches ~130 recipe slugs in batches of 10 concurrent requests. Each request has a 10-second timeout. Worst case: 13 batches × up to 10s = ~130 seconds for a full cold load.
- Files: `artifacts/api-server/src/routes/recipes.ts` (lines ~186–215)
- Cause: All data sourced from external wiki API with no local persistence.
- Improvement path: Persist scraped data to the Postgres DB (`@workspace/db`). Serve from DB on every request; refresh DB in background. This reduces cold start from minutes to milliseconds.

**`buildCraftableSet` Uses an Unbounded While Loop:**
- Problem: `buildCraftableSet()` in `artifacts/sulfur-recipe-finder/src/pages/Home.tsx` runs a `while (changed)` loop over all recipes. In the worst case (highly connected recipe graph), this is O(R²) where R = number of recipes. With 130+ recipes, this could cause UI jank.
- Files: `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`
- Cause: Naive fixed-point computation with no cycle detection or iteration limit.
- Improvement path: Move to a topological sort or memoized dependency graph approach. At minimum, add an iteration cap to prevent infinite loops if data is malformed.

**Frontend Scoring Runs on Every Render:**
- Problem: Recipe scoring (`scoreRecipe`) is called inside a `useMemo` or render path for every recipe on every filter change. With 130+ recipes and complex scoring logic, this could cause perceptible lag.
- Files: `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`
- Improvement path: Ensure scoring is memoized with stable `haveMap` and `craftableSet` references. Consider web workers for the scoring computation.

---

## Fragile Areas

**Wiki API Parsing (Regex-Based Wikitext Parser):**
- Files: `artifacts/api-server/src/routes/recipes.ts` (`parseRecipeRows`, `cleanLabel`, `detectType` functions)
- Why fragile: Wikitext parsing relies on regex pattern matching (`{{Recipe row...}}` templates). Any change to the wiki template structure, whitespace formatting, or new template parameters will silently break parsing — returning empty variants rather than an error.
- Safe modification: Add validation after parsing (e.g. log a warning if a known recipe returns 0 variants). Add an integration test against a known stable wiki page response fixture.
- Test coverage: Zero — no tests exist in the repository.

**`RECIPE_SLUGS` Contains URL-Encoded Characters:**
- Files: `artifacts/api-server/src/routes/recipes.ts` (lines ~9–24)
- Why fragile: Some slugs like `"Jansson%27s_Temptation"`, `"Mac%27n%27Cheese"`, `"P%C3%B8lse"` are URL-encoded inline in the source array. If anyone adds a new slug without encoding it correctly, the fetch will silently fail (the wiki returns `data.error`).
- Safe modification: Normalize slugs at the fetch call site using `encodeURIComponent` on the raw slug rather than pre-encoding in the array.

**`detectType` Uses Fragile String Matching:**
- Files: `artifacts/api-server/src/routes/recipes.ts` (`detectType` function, lines ~158–163)
- Why fragile: Type detection looks for specific literal strings (`"kind     = equipment"` with multiple spaces and `"kind = equipment"`). Wikitext whitespace variation could cause equipment items to be misclassified as consumables.
- Safe modification: Use a more flexible regex: `/kind\s*=\s*equipment/i`.

---

## Missing Critical Features

**No Tests of Any Kind:**
- Problem: Zero test files exist in the repository (confirmed by search). No unit, integration, or e2e tests.
- Blocks: Safe refactoring of wiki parsing logic, reliable CI, confidence in recipe scoring algorithm correctness.

**No Background Refresh / Cache Warming:**
- Problem: The recipe cache is only refreshed on server start (cold) or when `/recipes/refresh` is manually called. There is no scheduled background job to keep data fresh.
- Blocks: The 1-hour TTL comment in the code suggests intent for time-based expiry, but `getRecipesData()` only checks timestamp — there is no proactive background job that triggers re-fetch after TTL expiry. The cache stays stale indefinitely until the next request after TTL, which then blocks that request during the full re-fetch.

**No Input Validation on API Endpoints:**
- Problem: Express routes have no Zod or other schema validation on request bodies/params. The `/recipes/refresh` POST accepts any body.
- Files: `artifacts/api-server/src/routes/recipes.ts`
- Impact: Malformed requests pass through silently. The Zod infrastructure (`@workspace/api-zod`) exists but is only used for the health check response.

---

## Test Coverage Gaps

**All Application Logic (100% Uncovered):**
- What's not tested: Wiki fetch + parsing (`fetchRecipeFromApi`, `parseRecipeRows`, `cleanLabel`), cache logic (`getRecipesData`), recipe scoring algorithm (`scoreRecipe`, `buildCraftableSet`, `canMakeVariantDirect`, `hasIngredient`), ingredient normalization (`normalizeText`, `baseName`, `requiredQty`).
- Files: `artifacts/api-server/src/routes/recipes.ts`, `artifacts/sulfur-recipe-finder/src/pages/Home.tsx`
- Risk: Any regression in parsing or scoring logic is invisible until a user reports wrong results.
- Priority: High — the wiki parsing and ingredient scoring are the core product logic.

---

*Concerns audit: 2026-04-28*
