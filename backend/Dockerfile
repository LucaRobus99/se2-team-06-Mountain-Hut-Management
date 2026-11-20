# syntax=docker/dockerfile:1
# Mountain Hut backend (Express REST API). Needs a PostgreSQL server: set DATABASE_URL.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# Production dependencies only (PGlite, Vitest, Supertest are dev-only).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# scripts/*.sql are applied by the backend on first start against an empty database.
COPY src ./src
COPY scripts ./scripts
# Mailgun template sources used by `npm run mailgun:templates` (no dashboard needed).
COPY email-templates ./email-templates

USER node
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
