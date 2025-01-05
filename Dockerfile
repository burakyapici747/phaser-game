FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
COPY vite.config.js ./
COPY index.html ./
COPY src/ ./src/

RUN npm install
RUN npm run build

CMD ["tail", "-f", "/dev/null"] 