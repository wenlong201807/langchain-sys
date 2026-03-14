# ThinkAgent 配置管理与多环境方案

## 一、环境定义

| 环境 | 标识 | 用途 | 域名 |
|------|------|------|------|
| 测试环境 | test | 单元测试/集成测试 | localhost |
| 预发布环境 | staging | 功能验证/UAT | staging.thinkagent.ai |
| 生产环境 | prod | 线上服务 | thinkagent.ai |

---

## 二、各项目配置文件汇总

### 2.1 后端服务 (packages/server)

#### config/default.ts

```typescript
// packages/server/config/default.ts

import type { AppConfig } from '../src/types/config.types'

const config: AppConfig = {
  env: (process.env.NODE_ENV as AppConfig['env']) || 'test',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/thinkagent',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    connectionTimeout: 10000,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'thinkagent:',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  adminJwt: {
    secret: process.env.ADMIN_JWT_SECRET || 'admin-dev-secret',
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '2h',
  },
  ai: {
    provider: (process.env.AI_PROVIDER as AppConfig['ai']['provider']) || 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL,
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-4o',
    embeddingModel: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096', 10),
  },
  oss: {
    provider: (process.env.OSS_PROVIDER as AppConfig['oss']['provider']) || 'aliyun',
    endpoint: process.env.OSS_ENDPOINT || '',
    bucket: process.env.OSS_BUCKET || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    region: process.env.OSS_REGION,
  },
  sms: {
    provider: (process.env.SMS_PROVIDER as AppConfig['sms']['provider']) || 'aliyun',
    accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '',
    templateCode: process.env.SMS_TEMPLATE_CODE || '',
  },
  rateLimit: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.',
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || true,
  },
  langsmith: {
    tracing: process.env.LANGSMITH_TRACING === 'true',
    apiKey: process.env.LANGSMITH_API_KEY,
  },
}

export default config
```

#### config/test.ts

```typescript
// packages/server/config/test.ts

import type { AppConfig } from '../src/types/config.types'
import base from './default'

const config: Partial<AppConfig> = {
  ...base,
  env: 'test',
  database: {
    ...base.database,
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/thinkagent_test',
    poolSize: 5,
  },
  redis: {
    ...base.redis,
    db: 15,
  },
  ai: {
    ...base.ai,
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
  },
  rateLimit: {
    ...base.rateLimit,
    max: 1000,
  },
}

export default config as AppConfig
```

#### config/staging.ts

```typescript
// packages/server/config/staging.ts

import type { AppConfig } from '../src/types/config.types'
import base from './default'

const config: Partial<AppConfig> = {
  ...base,
  env: 'staging',
  database: {
    ...base.database,
    url: process.env.DATABASE_URL,
    poolSize: 20,
  },
  redis: {
    ...base.redis,
    db: 1,
  },
  rateLimit: {
    windowMs: 60 * 1000,
    max: 200,
    message: base.rateLimit.message,
  },
}

export default config as AppConfig
```

#### config/prod.ts

```typescript
// packages/server/config/prod.ts

import type { AppConfig } from '../src/types/config.types'
import base from './default'

const config: Partial<AppConfig> = {
  ...base,
  env: 'production',
  database: {
    ...base.database,
    url: process.env.DATABASE_URL,
    poolSize: 50,
    connectionTimeout: 15000,
  },
  redis: {
    ...base.redis,
    db: 0,
  },
  rateLimit: {
    windowMs: 60 * 1000,
    max: 60,
    message: base.rateLimit.message,
  },
}

export default config as AppConfig
```

#### .env 文件（敏感配置，不提交 Git）

```bash
# .env.example（模板，提交到 Git）

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/thinkagent

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
ADMIN_JWT_SECRET=your-admin-jwt-secret

# AI
OPENAI_API_KEY=sk-xxx
AI_PROVIDER=openai
AI_DEFAULT_MODEL=gpt-4o
AI_EMBEDDING_MODEL=text-embedding-3-small

# OSS
OSS_PROVIDER=aliyun
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_BUCKET=thinkagent-uploads
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_REGION=oss-cn-hangzhou

# SMS
SMS_PROVIDER=aliyun
SMS_ACCESS_KEY_ID=
SMS_ACCESS_KEY_SECRET=
SMS_SIGN_NAME=
SMS_TEMPLATE_CODE=

# Optional
LANGSMITH_TRACING=false
LANGSMITH_API_KEY=
CORS_ORIGINS=https://thinkagent.ai,https://staging.thinkagent.ai
```

```bash
# .env.test / .env.staging / .env.prod 各环境分别维护
# 生产环境优先使用环境变量或 Secret Manager 注入
```

---

### 2.2 Web 前端 (packages/web)

```bash
# .env.local（本地开发，不提交）
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# .env.test
NEXT_PUBLIC_ENV=test
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# .env.staging
NEXT_PUBLIC_ENV=staging
NEXT_PUBLIC_API_URL=https://staging-api.thinkagent.ai/api
NEXT_PUBLIC_WS_URL=wss://staging-api.thinkagent.ai

# .env.production
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_API_URL=https://api.thinkagent.ai/api
NEXT_PUBLIC_WS_URL=wss://api.thinkagent.ai
```

```typescript
// packages/web/config/index.ts

const env = process.env.NEXT_PUBLIC_ENV || 'development'

export const config = {
  env: env as 'development' | 'test' | 'staging' | 'production',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
  isDev: env === 'development',
  isTest: env === 'test',
  isProd: env === 'production',
} as const
```

---

### 2.3 管理后台 (packages/admin)

```bash
# .env.development
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:3000/admin
VITE_APP_TITLE=ThinkAgent 管理后台

# .env.test
VITE_APP_ENV=test
VITE_API_BASE_URL=http://localhost:3000/admin
VITE_APP_TITLE=ThinkAgent 管理后台 (Test)

# .env.staging
VITE_APP_ENV=staging
VITE_API_BASE_URL=https://staging-api.thinkagent.ai/admin
VITE_APP_TITLE=ThinkAgent 管理后台 (Staging)

# .env.production
VITE_APP_ENV=production
VITE_API_BASE_URL=https://api.thinkagent.ai/admin
VITE_APP_TITLE=ThinkAgent 管理后台
```

```typescript
// packages/admin/src/config/index.ts

export const config = {
  env: import.meta.env.VITE_APP_ENV as string,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,
  appTitle: import.meta.env.VITE_APP_TITLE as string,
}
```

---

### 2.4 移动端 (packages/mobile)

```typescript
// packages/mobile/src/config/env.ts

export type EnvType = 'test' | 'staging' | 'production'

const rawEnv = (process.env.UNI_ENV || process.env.NODE_ENV || 'development') as string

export const env: EnvType =
  rawEnv === 'test' ? 'test' :
  rawEnv === 'staging' ? 'staging' :
  rawEnv === 'production' ? 'production' :
  'test'

export const API_BASE_URL: Record<EnvType, string> = {
  test: 'http://localhost:3000/api',
  staging: 'https://staging-api.thinkagent.ai/api',
  production: 'https://api.thinkagent.ai/api',
}

export const WX_APP_ID: Record<EnvType, string> = {
  test: 'wx_test_appid',
  staging: 'wx_staging_appid',
  production: 'wx_prod_appid',
}

export const apiBaseUrl = API_BASE_URL[env]
export const wxAppId = WX_APP_ID[env]
```

---

## 三、配置层级与优先级

```
环境变量 (Environment Variables)
    ↓ 覆盖
.env.{ENV} 文件
    ↓ 覆盖
config/{env}.ts (如 config/prod.ts)
    ↓ 覆盖
config/default.ts
```

**示例**：`DATABASE_URL` 的最终值

1. 若设置了 `DATABASE_URL` 环境变量 → 使用环境变量
2. 否则若 `.env.prod` 中有 `DATABASE_URL` → 使用 .env 中的值
3. 否则使用 `config/prod.ts` 中的 `database.url`
4. 否则使用 `config/default.ts` 中的默认值

---

## 四、敏感配置管理

| 类型 | 存储方式 | 说明 |
|------|----------|------|
| 数据库密码 | .env / 环境变量 / Secret Manager | 不提交 Git |
| JWT Secret | 同上 | 生产环境必须强随机 |
| API Keys (OpenAI 等) | 同上 | 按环境区分 |
| OSS 密钥 | 同上 | 最小权限 |
| SMS 密钥 | 同上 | 同上 |

### 4.1 .env.example 模板

```bash
# 复制为 .env.test / .env.staging / .env.prod 后填写真实值
# 生产环境建议使用 Kubernetes Secret / AWS Secrets Manager 等注入
```

### 4.2 生产环境 Secret 注入示例（Kubernetes）

```yaml
# k8s secret 示例
apiVersion: v1
kind: Secret
metadata:
  name: thinkagent-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  JWT_SECRET: "..."
  OPENAI_API_KEY: "sk-..."
```

---

## 五、Docker Compose 多环境

### 5.1 docker-compose.yml（本地开发）

```yaml
# packages/server/docker/docker-compose.yml

version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgresql://postgres:postgres@db:5432/thinkagent
      REDIS_HOST: redis
      REDIS_PORT: 6379
    env_file:
      - ../.env.local
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ..:/app
      - /app/node_modules
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: thinkagent
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata: {}
  redisdata: {}
```

### 5.2 docker-compose.staging.yml

```yaml
# packages/server/docker/docker-compose.staging.yml

version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: staging
      PORT: 3000
    env_file:
      - ../.env.staging
    env:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
      - JWT_SECRET=${JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # staging 可使用外部 RDS/Redis，此处示例为本地
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: thinkagent
    volumes:
      - pgdata_staging:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 512M

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata_staging:/data
    deploy:
      resources:
        limits:
          memory: 256M

volumes:
  pgdata_staging: {}
  redisdata_staging: {}
```

### 5.3 docker-compose.prod.yml

```yaml
# packages/server/docker/docker-compose.prod.yml

version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
    env_file:
      - ../.env.prod
    env:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OSS_ACCESS_KEY_ID=${OSS_ACCESS_KEY_ID}
      - OSS_ACCESS_KEY_SECRET=${OSS_ACCESS_KEY_SECRET}
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G
          cpus: '2'
        reservations:
          memory: 1G
          cpus: '0.5'
      restart_policy:
        condition: on-failure
        delay: 5s
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 60s

  # 生产通常使用外部 RDS/Redis，此处为单机示例
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: thinkagent
    volumes:
      - pgdata_prod:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 2G
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata_prod:/data
    deploy:
      resources:
        limits:
          memory: 512M
    restart: always

volumes:
  pgdata_prod: {}
  redisdata_prod: {}
```

---

## 六、Monorepo 全局启动脚本

```json
// 根目录 package.json

{
  "name": "thinkagent",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "dev:server": "turbo run dev --filter=@thinkagent/server",
    "dev:web": "turbo run dev --filter=@thinkagent/web",
    "dev:admin": "turbo run dev --filter=@thinkagent/admin",
    "build": "turbo run build",
    "build:test": "turbo run build:test",
    "build:staging": "turbo run build:staging",
    "build:prod": "turbo run build:prod",
    "start": "turbo run start",
    "start:test": "turbo run start:test",
    "start:staging": "turbo run start:staging",
    "start:prod": "turbo run start:prod",
    "lint": "turbo run lint",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

各子包需实现对应 script，例如：

```json
// packages/server/package.json
{
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "build:test": "NODE_ENV=test pnpm build",
    "build:staging": "NODE_ENV=staging pnpm build",
    "build:prod": "NODE_ENV=production pnpm build",
    "start": "node dist/app.js",
    "start:test": "NODE_ENV=test node dist/app.js",
    "start:staging": "NODE_ENV=staging node dist/app.js",
    "start:prod": "NODE_ENV=production node dist/app.js"
  }
}
```

---

## 七、CI/CD 环境配置

### 7.1 GitHub Actions 示例

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run build:test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_HOST: localhost
          JWT_SECRET: test-secret
          OPENAI_API_KEY: sk-test

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - run: pnpm install
      - run: pnpm run build:staging
        env:
          NEXT_PUBLIC_ENV: staging
          NEXT_PUBLIC_API_URL: ${{ secrets.STAGING_API_URL }}
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
          REDIS_HOST: ${{ secrets.STAGING_REDIS_HOST }}
          JWT_SECRET: ${{ secrets.STAGING_JWT_SECRET }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      # 部署到 staging 服务器...

  deploy-prod:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - run: pnpm install
      - run: pnpm run build:prod
        env:
          NEXT_PUBLIC_ENV: production
          NEXT_PUBLIC_API_URL: ${{ secrets.PROD_API_URL }}
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
          REDIS_HOST: ${{ secrets.PROD_REDIS_HOST }}
          JWT_SECRET: ${{ secrets.PROD_JWT_SECRET }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      # 部署到生产...
```

### 7.2 Jenkins 示例

```groovy
// Jenkinsfile

pipeline {
  agent any
  environment {
    ENV = "${params.DEPLOY_ENV ?: 'staging'}"
  }
  stages {
    stage('Build') {
      steps {
        sh 'pnpm install'
        sh "pnpm run build:${ENV}"
      }
    }
    stage('Deploy') {
      when {
        expression { ENV in ['staging', 'prod'] }
      }
      steps {
        script {
          def configFile = "packages/server/docker/docker-compose.${ENV}.yml"
          sh "docker-compose -f ${configFile} --env-file .env.${ENV} up -d"
        }
      }
    }
  }
}
```

---

## 八、配置变更安全规范

| 规范 | 说明 |
|------|------|
| 配置变更必须 Code Review | 所有 config/*、.env.example 变更需 PR 审核 |
| 生产配置变更需双人审批 | 生产环境相关配置需至少两人 approve |
| 配置变更记录在 Git 历史 | 禁止直接在生产服务器上改配置，需通过 Git 流程 |
| 敏感信息禁止提交 | .env、.env.*（除 .env.example）加入 .gitignore |
| 配置文档同步更新 | 修改配置时同步更新本文档 |

### .gitignore 示例

```gitignore
# 环境配置（敏感）
.env
.env.local
.env.test
.env.staging
.env.prod
.env.*.local
```

---

## 九、配置加载器示例（后端）

```typescript
// packages/server/src/config/loader.ts

import type { AppConfig } from '../types/config.types'

const env = process.env.NODE_ENV || 'test'

function loadConfig(): AppConfig {
  let config: AppConfig
  switch (env) {
    case 'production':
    case 'prod':
      config = require('../../config/prod').default
      break
    case 'staging':
      config = require('../../config/staging').default
      break
    case 'test':
    default:
      config = require('../../config/test').default
  }
  return config
}

export const appConfig = loadConfig()
```
