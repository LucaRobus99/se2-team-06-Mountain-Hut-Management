# syntax=docker/dockerfile:1
# Mountain Hut frontend: React build served by nginx, which also proxies /api
# to the backend container. The browser sees a single origin, so no CORS and
# the session cookie works exactly like with the Vite dev proxy.

FROM node:22-alpine AS build
WORKDIR /app
# Cypress is listed in dependencies; its ~500 MB test browser binary is not needed to build.
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
