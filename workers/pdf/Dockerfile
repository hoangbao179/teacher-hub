FROM node:24.18.0-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
# No npm install: this foundation only uses Node built-ins.
COPY --chown=node:node src/ ./src/
USER node
EXPOSE 8080
CMD ["node", "src/server.mjs"]
