# 本地启动指南

## 环境要求

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose
- PostgreSQL 客户端（可选，用于调试）

## 依赖服务

本地启动需要以下服务运行：

| 服务 | 默认地址 | 端口 | 说明 |
|------|----------|------|------|
| thinkagent-db | 127.0.0.1 | 5433 | PostgreSQL (pgvector) |
| Redis | 127.0.0.1 | 6379 | 消息队列缓存 |

## 启动步骤

### 1. 启动依赖服务（Docker）

```bash
cd docker
docker-compose up -d
```

验证服务启动：

```bash
docker ps
# 应该看到 thinkagent-db 容器正在运行
```

### 2. 安装项目依赖

```bash
# 安装 pnpm (如果未安装)
npm install -g pnpm

# 安装根目录依赖
pnpm install

# 安装子项目依赖
cd packages/server
pnpm install
```

### 3. 配置数据库

```bash
cd packages/server

# 生成 Prisma Client
pnpm db:generate

# 执行数据库迁移
pnpm db:migrate:dev

# 可选：填充种子数据
pnpm db:seed
```

### 4. 配置 Redis

确保本地 Redis 服务运行在 127.0.0.1:6379。

```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis

# 验证 Redis 连接
redis-cli ping
# 应返回 PONG
```

### 5. 启动服务

```bash
cd packages/server
pnpm dev
```

服务将在 http://0.0.0.0:8080 启动。

## 验证服务

### 健康检查

```bash
curl http://localhost:8080/health
# 或检查 API 路由
curl http://localhost:8080/api/v1
```

### 数据库连接验证

```bash
# 连接到 thinkagent-db
psql -h 127.0.0.1 -p 5433 -U thinkagent -d thinkagent

# 列出表
\dt
```

## 常见问题

### 端口冲突

如果 5433 端口被占用，修改 `docker/docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "5434:5432"  # 改为 5434
```

然后更新 `packages/server/.env`：

```
DATABASE_URL=postgresql://thinkagent:thinkagent123@127.0.0.1:5434/thinkagent
```

### Prisma 迁移失败

如果数据库迁移失败，尝试重置数据库：

```bash
# 删除数据库容器并重新创建
docker-compose down -v
docker-compose up -d

# 重新运行迁移
cd packages/server
pnpm db:migrate:dev
```

### Redis 连接失败

检查 Redis 是否运行：

```bash
redis-cli ping
# 如果返回 PONG，说明 Redis 正常
```

如果 Redis 未配置密码，确保 `.env` 中 `REDIS_PASSWORD` 为空。
