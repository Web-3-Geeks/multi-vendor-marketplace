# Marketplace API image. Config comes from environment variables at run time
# (docker-compose, Render), never from a .env file baked into the image.
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first: this layer is cached and only rebuilt when package*.json change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# The official image ships a non-root "node" user; the app does not need root.
USER node

EXPOSE 5000

# /api/health answers 200 only when MongoDB is connected.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-5000}/api/health || exit 1

CMD ["node", "server.js"]
