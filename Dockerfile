# ── Stage 1: Build the frontend ──────────────────────────────────────────────
# node:24-slim uses glibc (Debian) — required for rollup/lightningcss gnu binaries
FROM node:24-slim AS fe-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Workspace manifests first (layer cache for install)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/sulfur-recipe-finder/package.json ./artifacts/sulfur-recipe-finder/
RUN pnpm install --frozen-lockfile

# Source + assets
COPY lib/ ./lib/
COPY attached_assets/ ./attached_assets/
COPY artifacts/sulfur-recipe-finder/ ./artifacts/sulfur-recipe-finder/

WORKDIR /app/artifacts/sulfur-recipe-finder
RUN pnpm run build
# Output: /app/artifacts/sulfur-recipe-finder/dist/public/

# ── Stage 2: Build the API server ────────────────────────────────────────────
# node:24-slim uses glibc — esbuild linux-arm64-gnu binary works here
FROM node:24-slim AS api-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/api-zod/package.json ./lib/api-zod/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --frozen-lockfile

COPY lib/api-zod/ ./lib/api-zod/
COPY artifacts/api-server/ ./artifacts/api-server/

WORKDIR /app/artifacts/api-server
RUN pnpm run build
# Output: /app/artifacts/api-server/dist/index.mjs

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
# node:24-alpine for a smaller runtime image — no native build tools needed
FROM node:24-alpine AS runner
WORKDIR /app

# API server bundle + pino worker files
COPY --from=api-builder /app/artifacts/api-server/dist ./dist
# node_modules needed at runtime (pino thread-stream workers)
COPY --from=api-builder /app/node_modules ./node_modules

# Frontend static files served by Express at /public
COPY --from=fe-builder /app/artifacts/sulfur-recipe-finder/dist/public ./public

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
