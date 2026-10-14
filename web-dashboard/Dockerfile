# SPDX-License-Identifier: MIT
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build -- --noEmit || npm run build

# Runtime stage
FROM nginx:alpine

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  
  # Gzip compression
  gzip on;
  gzip_types text/plain text/css text/javascript application/json application/javascript;
  
  # Cache static assets
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }
  
  # API proxy to backend
  location /api/ {
    proxy_pass http://backend:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90s;
  }
  
  # React Router: route all other requests to index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
