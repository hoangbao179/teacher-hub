FROM node:24.18.0-alpine
WORKDIR /repo
COPY shared/dist shared/dist
COPY workers/pdf-gateway/src workers/pdf-gateway/src
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","workers/pdf-gateway/src/server.mjs"]
