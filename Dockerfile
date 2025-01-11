FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
COPY vite.config.js ./
COPY index.html ./
COPY src/ ./src/

RUN npm install
RUN npm run build

# Final nginx stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config and SSL certs
COPY nginx.conf /etc/nginx/nginx.conf
COPY cert.pem /etc/nginx/ssl/cert.pem
COPY fullchain.pem /etc/nginx/ssl/fullchain.pem
COPY privkey.pem /etc/nginx/ssl/privkey.pem

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

EXPOSE 8090

CMD ["nginx", "-g", "daemon off;"] 