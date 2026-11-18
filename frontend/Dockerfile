# syntax=docker/dockerfile:1
# Mountain Hut frontend: React build served by nginx, which also proxies /api
# to the backend container. The browser sees a single origin, so no CORS and
# the session cookie works exactly like with the Vite dev proxy.

FROM node:22-alpine AS build
WORKDIR /app
# --ignore-scripts: no lifecycle scripts from dependencies run at install time
# (Sonar S6505). The build does not need any: esbuild ships its binary as an
# optional @esbuild/* package, and Cypress's browser download is not wanted here.
# Cypress is listed in dependencies; its ~500 MB test browser binary is not needed to build.
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Unprivileged variant of the official image: nginx runs as the "nginx" user
# (uid 101) instead of root, so it listens on 8080 (ports below 1024 need root).
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
