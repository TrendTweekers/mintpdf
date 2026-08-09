FROM node:24-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:24-slim
WORKDIR /app

# Chromium runtime dependencies + fonts (incl. CJK and emoji so agent documents render properly)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-noto-color-emoji fonts-noto-cjk \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 \
    libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 \
    libxrandr2 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/app/.chrome
COPY package*.json ./
RUN npm ci --omit=dev && npx puppeteer browsers install chrome && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY public ./public
COPY content ./content

ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "dist/server.js"]
