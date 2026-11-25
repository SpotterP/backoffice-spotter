FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_ENV=production
RUN npx ng build --configuration "${APP_ENV}"
