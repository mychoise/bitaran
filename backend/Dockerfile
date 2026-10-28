# syntax=docker/dockerfile:1

# ---- build: compile TypeScript, then drop dev dependencies ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
# Same base as the build stage, so native modules (sharp, argon2) match.
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    LOCAL_STORAGE_PATH=/app/uploads
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Migrations are read from ./drizzle at run time.
COPY --chown=node:node drizzle ./drizzle
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Exec form, so SIGTERM reaches Node and the app shuts down cleanly.
# Migrations: node dist/database/migrate.js   Seed: node dist/database/seed/run-seed.js
CMD ["node", "dist/main.js"]
