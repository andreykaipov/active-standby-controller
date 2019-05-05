FROM node:alpine as builder
WORKDIR /app
COPY package*.json ts*.json ./
COPY src ./src/
RUN npm install
RUN npm run lint && npm run build
ENTRYPOINT ["node", "dist/main.js"]
