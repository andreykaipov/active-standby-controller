FROM node:alpine as builder
WORKDIR /app
COPY package*.json ts*.json ./
COPY src ./src/
RUN npm install
RUN npm run lint && npm run build

FROM node:alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm install --production
COPY docker-entrypoint.sh /usr/local/bin
ENTRYPOINT ["docker-entrypoint.sh"]
