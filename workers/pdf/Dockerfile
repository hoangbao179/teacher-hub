FROM node:24.18.0-bookworm-slim
ENV NODE_ENV=production PORT=8080 PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
WORKDIR /app
# Browser runs only under PDF_PRINT_FALLBACK_ENABLED=true. Existing source
# download path stays the default. Chromium is never placed on the VPS.
RUN apt-get update && apt-get install -y --no-install-recommends qpdf util-linux \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false --no-audit --no-fund \
    && npx playwright install --with-deps --only-shell chromium \
    && chmod -R a+rX /opt/playwright \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node src/ ./src/
USER node
EXPOSE 8080
CMD ["node", "src/server.mjs"]
