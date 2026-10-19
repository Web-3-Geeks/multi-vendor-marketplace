# Marketplace web image: build the React app with Node, then serve the static files with nginx.

# --- Stage 1: build ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite compiles VITE_* variables into the bundle at BUILD time, so the API URL is a
# build argument, not a run-time env var. It is public: never pass a secret here.
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Stage 2: serve ---
# Only the built files are copied over; Node, node_modules and the source stay behind.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# 127.0.0.1, not localhost: inside alpine "localhost" resolves to IPv6 ::1 first,
# and nginx here only listens on IPv4.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
