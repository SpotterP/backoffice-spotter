FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_ENV=production

# URL publica de la API. Se compila dentro del bundle, por eso se inyecta antes del
# build y no como variable de entorno del contenedor. Ver .github/workflows/ci.yml.
ARG API_URL
RUN set -eu; \
    test -n "$API_URL" || { echo "ERROR: falta --build-arg API_URL (URL publica de la API)" >&2; exit 1; }; \
    API_URL="${API_URL%/}"; \
    printf "export const environment = {\n  apiUrl: '%s',\n};\n" "$API_URL" > src/environments/environment.production.ts

RUN npx ng build --configuration "${APP_ENV}"

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/backoffice/browser /usr/share/nginx/html
EXPOSE 80
