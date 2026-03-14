# CI/CD 部署方案：Jenkins + Nginx + Docker + n8n

## 核心约束

| 约束 | 值 | 影响 |
|------|-----|------|
| CPU | 2 核 | Jenkins 构建时会吃满 CPU，需错峰 |
| 内存 | 2.5GB | Jenkins + 应用 + DB 同时运行极其紧张 |
| 磁盘 | 40GB | Docker 镜像 + 数据库 + 日志需精打细算 |
| 人力 | 1 名全栈 | 运维复杂度必须最低 |

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    2核 2.5G 40G 服务器                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Docker Engine                         │    │
│  │                                                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │  Nginx   │  │ App      │  │ PG + vec │              │    │
│  │  │  :80/443 │→ │ Node.js  │  │ :5432    │              │    │
│  │  │  ~20MB   │  │ :3000    │  │ ~200MB   │              │    │
│  │  └──────────┘  │ ~300MB   │  └──────────┘              │    │
│  │                 └──────────┘                             │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │ Redis    │  │ Worker   │  │ n8n      │              │    │
│  │  │ :6379    │  │ BullMQ   │  │ :5678    │              │    │
│  │  │ ~30MB    │  │ ~150MB   │  │ ~200MB   │              │    │
│  │  └──────────┘  └──────────┘  └──────────┘              │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │ Jenkins (按需启动，构建完自动停止)                   │   │    │
│  │  │ 运行时 ~600MB，停止时 0MB                           │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  操作系统 + Docker Engine: ~250MB                                │
│  Swap 分区: 2GB (应急)                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 内存分配规划（常驻服务）

| 服务 | 分配 | 限制方式 |
|------|------|---------|
| PostgreSQL (pgvector) | 256MB | `deploy.resources.limits` |
| Node.js App (Fastify) | 350MB | `--max-old-space-size=300` |
| Node.js Worker (BullMQ) | 180MB | `--max-old-space-size=150` |
| Redis | 50MB | `maxmemory 50mb` |
| Nginx | 30MB | worker 进程数限制 |
| n8n | 250MB | Docker memory limit |
| 操作系统 + Docker | 300MB | - |
| **常驻总计** | **1,416MB** | - |
| **剩余缓冲** | **~1,084MB** | 用于 Jenkins 构建 / 突发流量 |

> **关键设计：Jenkins 不常驻运行，仅在构建时启动，构建完自动停止。** 这样节省 ~600MB 内存给业务服务。

---

## 二、Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ==================== 反向代理 ====================
  nginx:
    image: nginx:alpine
    container_name: ta-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
      - ./web-dist:/usr/share/nginx/html:ro
    deploy:
      resources:
        limits:
          memory: 30M
    depends_on:
      - app
    restart: always

  # ==================== 主应用 ====================
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: ta-app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://thinkagent:${DB_PASSWORD}@postgres:5432/thinkagent
      - REDIS_URL=redis://redis:6379
      - PORT=3000
    env_file:
      - .env.production
    deploy:
      resources:
        limits:
          memory: 350M
    command: ["node", "--max-old-space-size=300", "dist/app.js"]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ==================== BullMQ Worker ====================
  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: ta-worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://thinkagent:${DB_PASSWORD}@postgres:5432/thinkagent
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env.production
    deploy:
      resources:
        limits:
          memory: 180M
    command: ["node", "--max-old-space-size=150", "dist/worker.js"]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  # ==================== PostgreSQL + pgvector ====================
  postgres:
    image: pgvector/pgvector:pg16
    container_name: ta-postgres
    environment:
      POSTGRES_DB: thinkagent
      POSTGRES_USER: thinkagent
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    deploy:
      resources:
        limits:
          memory: 256M
    command:
      - "postgres"
      - "-c" 
      - "shared_buffers=128MB"
      - "-c"
      - "effective_cache_size=256MB"
      - "-c"
      - "work_mem=4MB"
      - "-c"
      - "maintenance_work_mem=64MB"
      - "-c"
      - "max_connections=30"
      - "-c"
      - "wal_buffers=4MB"
      - "-c"
      - "random_page_cost=1.1"
    ports:
      - "127.0.0.1:5432:5432"
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U thinkagent"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ==================== Redis ====================
  redis:
    image: redis:7-alpine
    container_name: ta-redis
    command: >
      redis-server
      --maxmemory 50mb
      --maxmemory-policy allkeys-lru
      --save 60 1000
      --appendonly yes
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits:
          memory: 60M
    ports:
      - "127.0.0.1:6379:6379"
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ==================== n8n (工作流自动化) ====================
  n8n:
    image: n8nio/n8n:latest
    container_name: ta-n8n
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=n8n.thinkagent.ai
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.thinkagent.ai/
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=thinkagent
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - N8N_DIAGNOSTICS_ENABLED=false
      - N8N_HIRING_BANNER_ENABLED=false
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
    volumes:
      - n8n-data:/home/node/.n8n
    deploy:
      resources:
        limits:
          memory: 250M
    depends_on:
      postgres:
        condition: service_healthy
    restart: always

  # ==================== Jenkins (按需启动) ====================
  jenkins:
    image: jenkins/jenkins:lts-alpine
    container_name: ta-jenkins
    environment:
      JAVA_OPTS: >
        -Xmx384m
        -Xms256m
        -XX:MaxMetaspaceSize=128m
        -Dhudson.footerURL=
    volumes:
      - jenkins-data:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    deploy:
      resources:
        limits:
          memory: 600M
    ports:
      - "127.0.0.1:8080:8080"
    profiles:
      - ci
    # 通过 profiles 控制：不随 docker compose up 启动
    # 构建时：docker compose --profile ci up jenkins
    # 构建后：docker compose --profile ci stop jenkins

volumes:
  postgres-data:
  redis-data:
  n8n-data:
  jenkins-data:
```

---

## 三、Nginx 配置

```nginx
# nginx/conf.d/thinkagent.conf

upstream app_backend {
    server app:3000;
    keepalive 16;
}

upstream n8n_backend {
    server n8n:5678;
}

# 限流配置
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_conn_zone $binary_remote_addr zone=conn:10m;

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name thinkagent.ai api.thinkagent.ai n8n.thinkagent.ai;
    return 301 https://$host$request_uri;
}

# 主站（Web 前端静态文件）
server {
    listen 443 ssl http2;
    server_name thinkagent.ai;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /usr/share/nginx/html;
    index index.html;

    # 静态资源缓存
    location /_next/static/ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }

    # gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;
}

# API 服务
server {
    listen 443 ssl http2;
    server_name api.thinkagent.ai;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 认证接口限流
    location /v1/auth/ {
        limit_req zone=auth burst=3 nodelay;
        proxy_pass http://app_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE 流式对话（关键配置）
    location ~ ^/v1/chat/threads/.*/messages/stream {
        proxy_pass http://app_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 必需配置
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;               # 禁止缓冲
        proxy_cache off;                   # 禁止缓存
        proxy_read_timeout 300s;           # Agent 推理可能较久
        chunked_transfer_encoding on;

        # 限制并发连接
        limit_conn conn 5;
    }

    # 文件上传
    location /v1/files/ {
        client_max_body_size 20m;
        proxy_pass http://app_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 通用 API
    location /v1/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://app_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}

# n8n 工作流面板
server {
    listen 443 ssl http2;
    server_name n8n.thinkagent.ai;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    location / {
        proxy_pass http://n8n_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（n8n 需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 四、Jenkins Pipeline 配置

### 4.1 按需启动策略

```bash
# Jenkins 不常驻运行，通过脚本按需启停：

# 启动 Jenkins（构建时）
deploy-start-jenkins() {
  docker compose --profile ci up -d jenkins
  echo "等待 Jenkins 启动..."
  sleep 30
}

# 停止 Jenkins（构建完成后）
deploy-stop-jenkins() {
  docker compose --profile ci stop jenkins
  echo "Jenkins 已停止，释放 ~600MB 内存"
}
```

### 4.2 Jenkinsfile

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'registry.cn-hangzhou.aliyuncs.com'
        IMAGE_NAME = 'thinkagent/app'
        IMAGE_TAG = "${BUILD_NUMBER}-${GIT_COMMIT.take(7)}"
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Test') {
            steps {
                sh '''
                    export NODE_OPTIONS="--max-old-space-size=384"
                    npm ci --production=false
                    npm run lint
                    npm run test -- --reporter=verbose
                '''
            }
        }

        stage('Build') {
            steps {
                sh '''
                    export NODE_OPTIONS="--max-old-space-size=384"
                    npm run build
                '''
            }
        }

        stage('Docker Build') {
            steps {
                sh """
                    docker build \
                        --target production \
                        --build-arg NODE_ENV=production \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} \
                        -t ${IMAGE_NAME}:latest \
                        .
                """
            }
        }

        stage('Database Migration') {
            steps {
                sh '''
                    npx prisma migrate deploy
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    # 零停机部署：先启动新容器，健康检查通过后切换
                    docker compose up -d --no-deps --build app worker

                    # 等待健康检查
                    echo "等待应用启动..."
                    for i in $(seq 1 30); do
                        if curl -sf http://localhost:3000/health > /dev/null; then
                            echo "应用已就绪"
                            break
                        fi
                        sleep 2
                    done

                    # 重载 Nginx
                    docker exec ta-nginx nginx -s reload
                '''
            }
        }

        stage('Cleanup') {
            steps {
                sh '''
                    # 清理旧镜像，节省磁盘空间（40G 限制）
                    docker image prune -f --filter "until=72h"
                    docker system prune -f --volumes=false
                '''
            }
        }
    }

    post {
        success {
            sh 'echo "部署成功: ${IMAGE_TAG}"'
            // n8n webhook 通知
            sh '''
                curl -X POST https://n8n.thinkagent.ai/webhook/deploy-notify \
                    -H "Content-Type: application/json" \
                    -d '{"status":"success","version":"'"${IMAGE_TAG}"'","timestamp":"'"$(date -Iseconds)"'"}'
            '''
        }
        failure {
            sh '''
                curl -X POST https://n8n.thinkagent.ai/webhook/deploy-notify \
                    -H "Content-Type: application/json" \
                    -d '{"status":"failed","version":"'"${IMAGE_TAG}"'","timestamp":"'"$(date -Iseconds)"'"}'
            '''
        }
        always {
            cleanWs()
        }
    }
}
```

### 4.3 Dockerfile（多阶段构建，控制镜像大小）

```dockerfile
# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ============ 生产阶段 ============
FROM node:20-alpine AS production

RUN apk add --no-cache curl tini

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

RUN npx prisma generate

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=300", "dist/app.js"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

---

## 五、n8n 工作流用途

n8n 在本架构中承担**运维自动化和业务自动化**角色：

### 5.1 运维自动化工作流

```
工作流 1：部署通知
触发：Jenkins Webhook
动作：发送部署结果到企业微信/飞书/Discord

工作流 2：异常告警
触发：定时检查（每 5 分钟）
动作：
  ├─ 检查 API 健康状态
  ├─ 检查数据库连接
  ├─ 检查 Redis 连接
  ├─ 检查磁盘使用率
  └─ 异常时发送告警到多渠道

工作流 3：数据库备份
触发：每日凌晨 3:00
动作：
  ├─ 执行 pg_dump
  ├─ 压缩备份文件
  ├─ 上传到 OSS
  └─ 清理 7 天前的本地备份

工作流 4：日志清理
触发：每周一凌晨
动作：
  ├─ 清理 Docker 日志（> 7 天）
  ├─ 清理应用日志（> 30 天）
  ├─ 清理 Nginx 日志（> 30 天）
  └─ 报告磁盘使用情况
```

### 5.2 业务自动化工作流

```
工作流 5：新用户欢迎
触发：注册 Webhook
动作：发送欢迎消息 + 引导教程

工作流 6：用户反馈汇总
触发：每日 9:00
动作：
  ├─ 汇总昨日用户反馈（点赞/点踩）
  └─ 发送日报到运营群

工作流 7：使用量告警
触发：每小时检查
动作：
  ├─ 检查 API 调用量
  ├─ 预估 Token 消耗和成本
  └─ 超阈值告警
```

---

## 六、磁盘空间规划（40G 限制）

```
磁盘分配：

/（系统 + Docker）
├── 操作系统                    ~3GB
├── Docker Engine + 镜像缓存     ~5GB
│   ├── nginx:alpine            ~40MB
│   ├── pgvector/pgvector:pg16  ~400MB
│   ├── redis:7-alpine          ~30MB
│   ├── node:20-alpine (app)    ~200MB
│   ├── n8nio/n8n               ~500MB
│   ├── jenkins:lts-alpine      ~600MB
│   └── 构建缓存                 ~3GB
├── Docker Volumes               ~20GB
│   ├── postgres-data            ~10GB（数据库 + 向量数据）
│   ├── redis-data               ~500MB
│   ├── n8n-data                 ~1GB
│   ├── jenkins-data             ~3GB
│   └── 应用日志                  ~5GB
├── Swap 文件                     ~2GB
├── SSL 证书 + Nginx 配置         ~10MB
├── 备份临时存储                   ~5GB
└── 剩余缓冲                      ~5GB
──────────────────────────────────
总计                              ~40GB

关键措施：
1. Docker 日志限制：每个容器最大 50MB，保留 3 个文件
2. PG WAL 限制：max_wal_size = 512MB
3. Jenkins 构建产物定期清理
4. 数据库备份上传 OSS 后删除本地副本
5. 每周自动 docker system prune
```

**Docker 日志限制配置：**

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
```

---

## 七、Swap 配置（关键！）

2.5GB 内存必须配置 Swap 作为安全网：

```bash
# 创建 2GB Swap 文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 持久化
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 调优：尽量少用 swap（仅应急）
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

---

## 八、部署脚本

```bash
#!/bin/bash
# scripts/deploy.sh - 一键部署脚本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========== ThinkAgent 部署 =========="
echo "时间: $(date)"
echo "目录: $PROJECT_DIR"

cd "$PROJECT_DIR"

# 1. 拉取最新代码
echo "[1/6] 拉取代码..."
git pull origin main

# 2. 构建应用镜像
echo "[2/6] 构建 Docker 镜像..."
docker compose build app worker

# 3. 数据库迁移
echo "[3/6] 数据库迁移..."
docker compose run --rm app npx prisma migrate deploy

# 4. 滚动更新应用
echo "[4/6] 更新应用容器..."
docker compose up -d --no-deps app worker

# 5. 等待健康检查
echo "[5/6] 等待应用就绪..."
for i in $(seq 1 30); do
    if docker exec ta-app curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo "应用已就绪！"
        break
    fi
    echo "等待中... ($i/30)"
    sleep 2
done

# 6. 重载 Nginx
echo "[6/6] 重载 Nginx..."
docker exec ta-nginx nginx -s reload

# 清理
docker image prune -f --filter "until=72h"

echo "========== 部署完成 =========="
docker compose ps
echo ""
echo "内存使用："
free -h
echo ""
echo "磁盘使用："
df -h /
```

---

## 九、Git Webhook 触发 Jenkins（替代常驻方案）

由于 Jenkins 不常驻，推荐以下触发方案：

### 方案 A：n8n 监听 Git Webhook（推荐）

```
Git Push → n8n Webhook 接收
  │
  ├─ 启动 Jenkins 容器
  ├─ 触发 Jenkins 构建任务
  ├─ 等待构建完成
  ├─ 停止 Jenkins 容器
  └─ 发送部署通知
```

### 方案 B：轻量 Shell 脚本替代 Jenkins

对于单人项目，考虑用 Shell 脚本直接替代 Jenkins，进一步节省资源：

```bash
# Git Hook → SSH → 服务器执行 deploy.sh
# 省去 Jenkins 的 600MB 内存开销
# 通过 n8n 接收 webhook，执行部署脚本
```

> **架构师建议：** MVP 阶段推荐方案 B（n8n + Shell 脚本），不启动 Jenkins。当团队扩展到 2+ 人，或需要多分支并行构建时，再引入 Jenkins。
