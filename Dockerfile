FROM node:alpine as builder
WORKDIR /app
COPY package*.json ts*.json ./
COPY src ./src/
RUN npm install
RUN npm run lint && npm run build
COPY docker-entrypoint.sh /usr/local/bin
ENTRYPOINT ["docker-entrypoint.sh"]
