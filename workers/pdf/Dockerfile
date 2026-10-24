FROM node:24.18.0-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
# qpdf validates without rasterization. util-linux provides parser resource limits.
RUN apt-get update && apt-get install -y --no-install-recommends qpdf util-linux \
    && rm -rf /var/lib/apt/lists/*
# No runtime npm dependencies or compiler: Node 24 strips erasable TypeScript.
COPY --chown=node:node src/ ./src/
USER node
EXPOSE 8080
CMD ["node", "src/server.mjs"]
