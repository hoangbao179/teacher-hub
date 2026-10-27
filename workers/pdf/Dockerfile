FROM node:24.18.0-bookworm-slim
ENV NODE_ENV=production PORT=8080 PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
WORKDIR /app/worker
# Browser runs only under PDF_PRINT_FALLBACK_ENABLED=true. Shared product limits
# are built before image build (see docker-smoke / CI).
RUN apt-get update && apt-get install -y --no-install-recommends qpdf util-linux \
    && rm -rf /var/lib/apt/lists/*
COPY shared/package.json /shared/package.json
COPY shared/dist /shared/dist
COPY workers/pdf/package.json workers/pdf/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false --no-audit --no-fund \
    && npm install /shared --omit=dev --no-audit --no-fund \
    && npx playwright install --with-deps --only-shell chromium \
    && chmod -R a+rX /opt/playwright \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*
COPY workers/pdf/src/ ./src/
USER node
EXPOSE 8080
CMD ["node", "src/server.mjs"]
