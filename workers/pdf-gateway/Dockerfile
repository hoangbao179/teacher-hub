FROM node:24.18.0-alpine
WORKDIR /app
COPY src/server.mjs ./server.mjs
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","/app/server.mjs"]
