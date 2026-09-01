# TechShop SaaS Platform — Deployment Architecture

## Services

| Service | Image | Purpose |
|---------|-------|---------|
| nginx | nginx:1.25-alpine | Reverse proxy, static assets |
| api | node:20-alpine | NestJS backend |
| web | node:20-alpine | Next.js frontend |
| worker | node:20-alpine | Queue processor (BullMQ) |
| scheduler | node:20-alpine | Cron jobs |
| postgres | postgres:15-alpine | Database |
| redis | redis:7-alpine | Cache, queue, sessions |

## Docker Compose

### docker-compose.yml (Development)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
      - ./apps/web/.next/static:/var/www/web/.next/static
      - ./apps/web/public:/var/www/web/public
    depends_on:
      - api
      - web

  api:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://techshop:secret@postgres:5432/techshop
      - REDIS_URL=redis://:secret@redis:6379
      - JWT_SECRET=your-jwt-secret
      - JWT_REFRESH_SECRET=your-refresh-secret
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: .
      dockerfile: docker/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3001
    volumes:
      - ./apps/web:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - api

  worker:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    command: node dist/worker.js
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://techshop:secret@postgres:5432/techshop
      - REDIS_URL=redis://:secret@redis:6379
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis

  scheduler:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    command: node dist/scheduler.js
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://techshop:secret@postgres:5432/techshop
      - REDIS_URL=redis://:secret@redis:6379
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: techshop
      POSTGRES_USER: techshop
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass secret
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### docker-compose.production.yml

```yaml
version: '3.8'

services:
  nginx:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  api:
    restart: always
    env_file:
      - .env.production
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

  web:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

  worker:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

  scheduler:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  postgres:
    restart: always
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/backups:/backups
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G

  redis:
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
```

## Dockerfiles

### docker/api/Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci

COPY . .
RUN npx turbo build --filter=api

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### docker/web/Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
RUN npm ci

COPY . .
RUN npx turbo build --filter=web

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

## Environment Configuration

### .env.example

```env
# Application
NODE_ENV=production
APP_URL=https://your-domain.com
API_URL=https://api.your-domain.com

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/techshop

# Redis
REDIS_URL=redis://:password@redis:6379

# JWT
JWT_SECRET=generate-with-openssl-rand-base64-32
JWT_REFRESH_SECRET=generate-with-openssl-rand-base64-32
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# AI Provider
AI_PROVIDER=mimo
AI_API_KEY=
AI_API_URL=https://api.mimo.ai/v1
AI_MODEL=mimo-default
AI_TIMEOUT=30000
AI_FALLBACK_PROVIDER=ollama
AI_OLLAMA_URL=http://localhost:11434

# Backup
BACKUP_DISK=local
BACKUP_PATH=/var/backups/techshop
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_KEY=

# Sentry (Optional)
SENTRY_DSN=

# Email
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@your-domain.com

# Self-Healing
SELF_HEALING_ENABLED=true
SELF_HEALING_MAX_RISK=controlled

# File Upload
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=./uploads
```

## Nginx Configuration

### docker/nginx/default.conf

```nginx
upstream api_backend {
    server api:3001;
}

upstream web_frontend {
    server web:3000;
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Login rate limiting
    location /api/v1/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health endpoints (no rate limit)
    location /health {
        proxy_pass http://api_backend;
    }

    # Next.js frontend
    location / {
        proxy_pass http://web_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2|woff|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Block hidden files
    location ~ /\. {
        deny all;
    }

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
}
```

## Deployment Commands

### Initial Setup

```bash
# Clone
git clone https://github.com/your-org/techshop-saas.git
cd techshop-saas

# Install dependencies
npm ci

# Copy environment
cp .env.example .env

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Update .env with generated secrets

# Start services
docker compose up -d

# Run migrations
docker compose exec api npx prisma migrate deploy

# Seed database
docker compose exec api npx prisma db seed

# Build frontend
docker compose exec web npm run build

# Verify
curl https://your-domain.com/health
```

### Update

```bash
# Pull latest
git pull origin main

# Install dependencies
npm ci

# Build
npx turbo build

# Run migrations
docker compose exec api npx prisma migrate deploy

# Restart services
docker compose restart api web worker scheduler

# Verify
curl https://your-domain.com/health
```

### Rollback

```bash
# Rollback database
docker compose exec api npx prisma migrate resolve --rolled-back <migration_name>

# Checkout previous code
git checkout HEAD~1

# Rebuild
npx turbo build

# Restart
docker compose up -d --force-recreate
```

## Health Checks

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  web:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U techshop"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Resource Requirements

### Minimum

| Resource | Value |
|----------|-------|
| CPU | 2 cores |
| RAM | 4 GB |
| Storage | 50 GB SSD |
| Cost | ~$20-40/month |

### Recommended

| Resource | Value |
|----------|-------|
| CPU | 4 cores |
| RAM | 8 GB |
| Storage | 200 GB SSD |
| Cost | ~$80-120/month |

## SSL/TLS

```bash
# Let's Encrypt
certbot certonly --webroot -w /var/www/html/public -d your-domain.com

# Auto-renewal cron
0 0 1 * * certbot renew --quiet
```
