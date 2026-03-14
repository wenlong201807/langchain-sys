# Docker 部署指南

本文档介绍如何在 Docker 环境中完整部署 thinkagent-server 系统，包括 PostgreSQL 数据库和应用程序服务。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Network                          │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   thinkagent-db  │         │  thinkagent-app  │          │
│  │  (PostgreSQL)    │         │    (Node.js)     │          │
│  │    :5432         │◄────────│    :8080         │          │
│  └──────────────────┘         └──────────────────┘          │
│           │                            │                      │
│           │                            │                      │
│           └────────────────────────────┘                      │
│                         Redis (:6379)                         │
└─────────────────────────────────────────────────────────────┘
```

## 部署步骤

### 1. 准备工作

创建部署目录：

```bash
mkdir -p thinkagent-deploy
cd thinkagent-deploy
```

### 2. 创建 Docker 配置文件

#### 2.1 数据库服务 (docker-compose.db.yml)

```yaml
version: '3.8'

services:
  thinkagent-db:
    image: pgvector/pgvector:pg16
    container_name: thinkagent-db
    environment:
      POSTGRES_USER: thinkagent
      POSTGRES_PASSWORD: thinkagent123
      POSTGRES_DB: thinkagent
    ports:
      - "5433:5432"
    volumes:
      - thinkagent_pgdata:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U thinkagent -d thinkagent"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - thinkagent-network

networks:
  thinkagent-network:
    driver: bridge

volumes:
  thinkagent_pgdata:
```

#### 2.2 应用服务 (docker-compose.app.yml)

首先，构建应用程序镜像。在项目根目录：

```bash
cd packages/server

# 构建应用程序
pnpm build

# 创建 Dockerfile
```

创建 `packages/server/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY prisma ./prisma/
RUN pnpm db:generate

COPY . .

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/app.js"]
```

#### 2.3 Redis 服务 (docker-compose.redis.yml)

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: thinkagent-redis
    ports:
      - "6379:6379"
    volumes:
      - thinkagent_redis:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - thinkagent-network

networks:
  thinkagent-network:
    driver: bridge

volumes:
  thinkagent_redis:
```

#### 2.4 主配置文件 (docker-compose.yml)

```yaml
version: '3.8'

services:
  thinkagent-db:
    image: pgvector/pgvector:pg16
    container_name: thinkagent-db
    environment:
      POSTGRES_USER: thinkagent
      POSTGRES_PASSWORD: thinkagent123
      POSTGRES_DB: thinkagent
    ports:
      - "5433:5432"
    volumes:
      - thinkagent_pgdata:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U thinkagent -d thinkagent"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - thinkagent-network

  thinkagent-redis:
    image: redis:7-alpine
    container_name: thinkagent-redis
    ports:
      - "6379:6379"
    volumes:
      - thinkagent_redis:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - thinkagent-network

  thinkagent-app:
    build:
      context: ../packages/server
      dockerfile: Dockerfile
    container_name: thinkagent-app
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://thinkagent:thinkagent123@thinkagent-db:5432/thinkagent
      - REDIS_HOST=thinkagent-redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=
      - JWT_SECRET=${JWT_SECRET:-thinkagent-prod-jwt-secret-2026}
      - ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET:-thinkagent-admin-jwt-secret-2026}
      - PORT=8080
      - HOST=0.0.0.0
      - NODE_ENV=production
    depends_on:
      thinkagent-db:
        condition: service_healthy
      thinkagent-redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - thinkagent-network

networks:
  thinkagent-network:
    driver: bridge

volumes:
  thinkagent_pgdata:
  thinkagent_redis:
```

### 3. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f thinkagent-app
```

### 4. 验证部署

```bash
# 检查应用健康状态
curl http://localhost:8080/health

# 检查数据库连接
docker-compose exec thinkagent-app sh -c 'nc -z thinkagent-db 5432 && echo "DB OK"'

# 检查 Redis 连接
docker-compose exec thinkagent-app sh -c 'nc -z thinkagent-redis 6379 && echo "Redis OK"'
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | postgresql://thinkagent:thinkagent123@thinkagent-db:5432/thinkagent | 数据库连接串 |
| `REDIS_HOST` | thinkagent-redis | Redis 主机名 |
| `REDIS_PORT` | 6379 | Redis 端口 |
| `JWT_SECRET` | thinkagent-prod-jwt-secret-2026 | JWT 密钥（生产环境必须修改） |
| `ADMIN_JWT_SECRET` | thinkagent-admin-jwt-secret-2026 | 管理员 JWT 密钥 |
| `NODE_ENV` | production | 运行环境 |

## 维护操作

### 备份数据库

```bash
# 备份
docker-compose exec thinkagent-db pg_dump -U thinkagent thinkagent > backup_$(date +%Y%m%d).sql

# 恢复
docker-compose exec -T thinkagent-db psql -U thinkagent thinkagent < backup_20240101.sql
```

### 更新应用

```bash
# 重新构建并重启
docker-compose up -d --build thinkagent-app
```

### 查看日志

```bash
# 应用日志
docker-compose logs -f thinkagent-app

# 数据库日志
docker-compose logs -f thinkagent-db

# 所有服务日志
docker-compose logs -f
```

### 停止服务

```bash
# 停止所有服务（保留数据）
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```
