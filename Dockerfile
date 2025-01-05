FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
COPY vite.config.js ./
COPY index.html ./
COPY src/ ./src/

RUN npm install
RUN npm run build

# Keep container running and wait for nginx
CMD ["sh", "-c", "cp -r dist/* /app/dist/ && tail -f /dev/null"] 