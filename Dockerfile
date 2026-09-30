# Builds the back-office and serves it with nginx, which also proxies /api to
# the NestJS API so calls stay same-origin (the refresh cookie is
# SameSite=Strict). Set API_URL to the API's base URL, e.g.
# https://tennis-backend-production.up.railway.app
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
# The nginx image renders /etc/nginx/templates/*.template with these env vars.
ENV NGINX_ENVSUBST_FILTER="^(PORT|API_URL|API_HOST)$" \
    PORT=8080
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/api-host.envsh /docker-entrypoint.d/15-api-host.envsh
COPY --from=build /app/dist/tennis-backoffice/browser /usr/share/nginx/html
