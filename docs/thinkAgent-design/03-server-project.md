# ThinkAgent 后端服务项目方案 (packages/server)

## 一、项目概述

ThinkAgent 后端服务基于以下技术栈构建，面向生产级 AI Agent 平台：

| 技术 | 版本 | 用途 |
|------|------|------|
| **Fastify** | 5.x | 高性能 Web 框架 |
| **Node.js** | >= 20 LTS | 运行时 |
| **TypeScript** | 5.x | 类型安全 |
| **LangChain.js + LangGraph** | 最新 | AI Agent 引擎 |
| **Prisma** | 5.x | ORM |
| **PostgreSQL** | 16 | 主数据库 |
| **pgvector** | - | 向量存储与检索 |
| **Redis** | 7 | 缓存、会话、队列 |
| **BullMQ** | 最新 | 异步任务队列 |
| **Pino** | 最新 | 结构化日志 |

**环境划分**：`test`（测试）、`staging`（预发）、`prod`（生产）

---

## 二、项目目录结构

```
packages/server/
├── src/
│   ├── app.ts                    # 应用入口
│   ├── config/                   # 环境配置加载
│   │   ├── index.ts              # 配置导出
│   │   └── loader.ts             # 配置加载器
│   ├── routes/                   # 用户端 API
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── chat.routes.ts
│   │   ├── agent.routes.ts
│   │   └── knowledge.routes.ts
│   ├── admin-routes/             # 管理端 API
│   │   ├── index.ts
│   │   ├── admin-auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── system-config.routes.ts
│   │   └── audit.routes.ts
│   ├── services/                 # 用户端业务服务
│   │   ├── auth.service.ts
│   │   ├── chat.service.ts
│   │   ├── agent.service.ts
│   │   └── knowledge.service.ts
│   ├── admin-services/           # 管理端业务服务
│   │   ├── user.service.ts
│   │   ├── system-config.service.ts
│   │   └── audit.service.ts
│   ├── agent-engine/             # AI Agent 引擎
│   │   ├── index.ts
│   │   ├── factory.ts            # Agent 工厂
│   │   ├── tools/
│   │   │   ├── index.ts
│   │   │   └── registry.ts
│   │   ├── middleware/
│   │   │   ├── rate-limit.ts
│   │   │   ├── content-filter.ts
│   │   │   ├── summarization.ts
│   │   │   └── user-profile.ts
│   │   └── graph.ts              # LangGraph 定义
│   ├── knowledge-base/           # 知识库模块
│   │   ├── upload.service.ts
│   │   ├── rag.service.ts
│   │   └── embedding.service.ts
│   ├── middleware/               # 用户端中间件
│   │   ├── auth.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── admin-middleware/         # 管理端中间件
│   │   ├── admin-auth.middleware.ts
│   │   ├── rbac-guard.middleware.ts
│   │   └── audit-logger.middleware.ts
│   ├── workers/                  # BullMQ Workers
│   │   ├── index.ts
│   │   ├── knowledge-process.worker.ts
│   │   └── notification.worker.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── validators.ts
│   └── types/
│       ├── index.ts
│       └── config.types.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── config/                       # 多环境配置
│   ├── default.ts
│   ├── test.ts
│   ├── staging.ts
│   └── prod.ts
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml        # 本地开发
│   ├── docker-compose.staging.yml
│   └── docker-compose.prod.yml
├── scripts/
│   ├── backup-db.sh
│   └── health-check.sh
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 三、配置管理方案

### 3.1 配置加载策略

采用 **node-config** 或自定义加载器，优先级从高到低：

1. 环境变量（最高优先级）
2. `config/{NODE_ENV}.ts`（如 `config/prod.ts`）
3. `config/default.ts`（基础配置）

### 3.2 TypeScript 配置接口定义

```typescript
// src/types/config.types.ts

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  connectionTimeout: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;        // 如 "7d"
  refreshExpiresIn: string;  // 如 "30d"
}

export interface AdminJwtConfig {
  secret: string;
  expiresIn: string;
}

export interface AiModelConfig {
  provider: 'openai' | 'anthropic' | 'azure';
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  embeddingModel: string;
  maxTokens: number;
}

export interface OssConfig {
  provider: 'aliyun' | 'aws' | 'minio';
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  region?: string;
}

export interface SmsConfig {
  provider: 'aliyun' | 'tencent';
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export interface CorsConfig {
  origins?: string[] | true;
}

export interface AppConfig {
  env: 'test' | 'staging' | 'production';
  port: number;
  host: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  adminJwt: AdminJwtConfig;
  ai: AiModelConfig;
  oss: OssConfig;
  sms: SmsConfig;
  rateLimit: RateLimitConfig;
  cors?: CorsConfig;
  langsmith?: {
    tracing: boolean;
    apiKey?: string;
  };
}
```

### 3.3 配置文件示例

```typescript
// config/default.ts

import type { AppConfig } from '../src/types/config.types';

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
};

export default config;
```

```typescript
// config/test.ts

import type { AppConfig } from '../src/types/config.types';
import base from './default';

const config: Partial<AppConfig> = {
  ...base,
  database: {
    ...base.database,
    url: process.env.DATABASE_URL || 'file:./test.db', // SQLite for test
  },
  redis: {
    ...base.redis,
    db: 15, // 使用独立 DB 避免污染
  },
  ai: {
    ...base.ai,
    apiKey: 'mock-key',
    // 可配置 mock 服务
  },
};

export default config as AppConfig;
```

```typescript
// config/staging.ts

import type { AppConfig } from '../src/types/config.types';
import base from './default';

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
};

export default config as AppConfig;
```

```typescript
// config/prod.ts

import type { AppConfig } from '../src/types/config.types';
import base from './default';

const config: Partial<AppConfig> = {
  ...base,
  env: 'production',
  database: {
    ...base.database,
    poolSize: 50,
    connectionTimeout: 5000,
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
  langsmith: {
    tracing: true,
    apiKey: process.env.LANGSMITH_API_KEY,
  },
};

export default config as AppConfig;
```

### 3.4 配置加载器

```typescript
// src/config/loader.ts

import type { AppConfig } from '../types/config.types';

const env = process.env.NODE_ENV || 'test';

function loadConfig(): AppConfig {
  let config: AppConfig;
  try {
    const defaultConfig = require(`../../config/default`).default;
    const envConfig = require(`../../config/${env}`).default;
    config = { ...defaultConfig, ...envConfig };
  } catch (e) {
    config = require('../../config/default').default;
  }
  return config;
}

export const config = loadConfig();
```

```typescript
// src/config/index.ts

export { config } from './loader';
export type { AppConfig } from '../types/config.types';
```

---

## 四、多环境启动方案

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch src/app.ts",
    "start:test": "NODE_ENV=test node dist/app.js",
    "start:staging": "NODE_ENV=staging node dist/app.js",
    "start:prod": "NODE_ENV=production node --max-old-space-size=300 dist/app.js",
    "build": "tsc",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:staging": "dotenv -e .env.staging -- prisma migrate deploy",
    "db:migrate:prod": "dotenv -e .env.prod -- prisma migrate deploy",
    "db:seed": "prisma db seed",
    "worker:dev": "NODE_ENV=development tsx watch src/workers/index.ts",
    "worker:prod": "NODE_ENV=production node --max-old-space-size=150 dist/workers/index.js"
  }
}
```

---

## 五、Fastify 应用入口设计

```typescript
// src/app.ts

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { registerRoutes } from './routes';
import { registerAdminRoutes } from './admin-routes';
import { prisma } from './utils/prisma';
import { redis } from './utils/redis';

async function buildApp() {
  const app = Fastify({
    logger: logger,
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  // 1. 安全与 CORS
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.cors?.origins || true,
    credentials: true,
  });

  // 2. 健康检查（无需认证）
  app.get('/health', async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`.catch(() => null);
    const redisOk = await redis.ping().catch(() => null);
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: !!dbOk,
        redis: !!redisOk,
      },
    };
  });

  // 3. 用户端路由
  await app.register(registerRoutes, { prefix: '/api/v1' });

  // 4. 管理端路由
  await app.register(registerAdminRoutes, { prefix: '/api/admin/v1' });

  return app;
}

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    try {
      await app.close();
      await prisma.$disconnect();
      await redis.quit();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled rejection');
    shutdown('unhandledRejection');
  });

  await app.listen({ port: config.port, host: config.host });
  logger.info({ port: config.port, env: config.env }, 'Server started');
}

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
```

---

## 六、核心模块设计

### 6.1 Agent 引擎模块

#### Agent 工厂与配置

```typescript
// src/agent-engine/factory.ts

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AppConfig } from '../types/config.types';

export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export function createAgent(config: AppConfig['ai'], overrides?: AgentConfig) {
  const llm = new ChatOpenAI({
    modelName: overrides?.model ?? config.defaultModel,
    temperature: overrides?.temperature ?? 0.7,
    maxTokens: overrides?.maxTokens ?? config.maxTokens,
    openAIApiKey: config.apiKey,
    configuration: { baseURL: config.baseUrl },
  });

  return {
    llm,
    async invoke(messages: (HumanMessage | SystemMessage)[], systemPrompt?: string) {
      const system = systemPrompt ?? overrides?.systemPrompt ?? config.systemPrompt;
      const fullMessages = system
        ? [new SystemMessage(system), ...messages]
        : messages;
      return llm.invoke(fullMessages);
    },
  };
}
```

#### Tool 注册

```typescript
// src/agent-engine/tools/registry.ts

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const toolRegistry = new Map<string, DynamicStructuredTool>();

export function registerTool(name: string, tool: DynamicStructuredTool) {
  toolRegistry.set(name, tool);
}

export function getTools(names?: string[]): DynamicStructuredTool[] {
  if (!names) return Array.from(toolRegistry.values());
  return names.map((n) => toolRegistry.get(n)).filter(Boolean) as DynamicStructuredTool[];
}

// 示例：搜索工具
registerTool(
  'web_search',
  new DynamicStructuredTool({
    name: 'web_search',
    description: 'Search the web for information',
    schema: z.object({ query: z.string() }),
    func: async ({ query }) => {
      // 实际调用搜索 API
      return JSON.stringify({ results: [] });
    },
  })
);
```

#### Middleware Pipeline

```typescript
// src/agent-engine/middleware/pipeline.ts

import type { BaseMessage } from '@langchain/core/messages';

export type AgentMiddleware = (
  ctx: AgentContext,
  next: () => Promise<AgentContext>
) => Promise<AgentContext>;

export interface AgentContext {
  messages: BaseMessage[];
  userId: string;
  metadata: Record<string, unknown>;
}

const pipeline: AgentMiddleware[] = [
  rateLimitMiddleware,    // 1. 限流
  contentFilterMiddleware, // 2. 内容过滤
  summarizationMiddleware, // 3. 长对话摘要
  userProfileMiddleware,   // 4. 注入用户画像
];

export async function runPipeline(ctx: AgentContext): Promise<AgentContext> {
  let current = ctx;
  for (const mw of pipeline) {
    current = await mw(current, async () => current);
  }
  return current;
}
```

```typescript
// src/agent-engine/middleware/rate-limit.ts

import type { AgentMiddleware } from './pipeline';

export const rateLimitMiddleware: AgentMiddleware = async (ctx, next) => {
  // 基于 userId 的限流，可接入 Redis
  // await rateLimit.check(ctx.userId);
  return next();
};
```

```typescript
// src/agent-engine/middleware/content-filter.ts

import type { AgentMiddleware } from './pipeline';

export const contentFilterMiddleware: AgentMiddleware = async (ctx, next) => {
  // 敏感词/合规检测
  // for (const msg of ctx.messages) { await filter(msg.content); }
  return next();
};
```

---

### 6.2 认证模块

```typescript
// src/middleware/auth.middleware.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verify } from 'jsonwebtoken';
import { config } from '../config';

export async function userAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Missing token' });
  }
  try {
    const payload = verify(token, config.jwt.secret) as { userId: string; iat: number };
    (request as any).userId = payload.userId;
  } catch {
    return reply.status(401).send({ code: 'INVALID_TOKEN', message: 'Invalid or expired token' });
  }
}
```

```typescript
// src/admin-middleware/admin-auth.middleware.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verify } from 'jsonwebtoken';
import { config } from '../config';

export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = request.headers['x-admin-token'] as string;
  if (!token) {
    return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Missing admin token' });
  }
  try {
    const payload = verify(token, config.adminJwt.secret) as { adminId: string; role: string };
    (request as any).adminId = payload.adminId;
    (request as any).adminRole = payload.role;
  } catch {
    return reply.status(401).send({ code: 'INVALID_ADMIN_TOKEN', message: 'Invalid or expired admin token' });
  }
}
```

---

### 6.3 RBAC 权限模块

```typescript
// src/admin-services/rbac.service.ts

import { redis } from '../utils/redis';
import { prisma } from '../utils/prisma';
import { config } from '../config';

const CACHE_TTL = 300; // 5 分钟
const CACHE_KEY = (adminId: string) => `${config.redis.keyPrefix}rbac:${adminId}`;

export async function getPermissions(adminId: string): Promise<string[]> {
  const cached = await redis.get(CACHE_KEY(adminId));
  if (cached) return JSON.parse(cached);

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { role: { include: { permissions: true } } },
  });
  const perms = admin?.role?.permissions?.map((p) => p.code) ?? [];
  await redis.setex(CACHE_KEY(adminId), CACHE_TTL, JSON.stringify(perms));
  return perms;
}

export async function hasPermission(adminId: string, permission: string): Promise<boolean> {
  const perms = await getPermissions(adminId);
  return perms.includes('*') || perms.includes(permission);
}
```

```typescript
// src/admin-middleware/rbac-guard.middleware.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { hasPermission } from '../admin-services/rbac.service';

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const adminId = (request as any).adminId;
    if (!adminId) return reply.status(401).send({ code: 'UNAUTHORIZED' });
    const ok = await hasPermission(adminId, permission);
    if (!ok) return reply.status(403).send({ code: 'FORBIDDEN', message: 'Insufficient permission' });
  };
}
```

```typescript
// src/admin-middleware/audit-logger.middleware.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../utils/prisma';

export async function auditLoggerMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const start = Date.now();
  reply.addHook('onSend', async () => {
    await prisma.auditLog.create({
      data: {
        adminId: (request as any).adminId,
        action: `${request.method} ${request.url}`,
        statusCode: reply.statusCode,
        durationMs: Date.now() - start,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? undefined,
      },
    });
  });
}
```

---

### 6.4 知识库模块

#### 上传 → OSS → BullMQ 流程

```typescript
// src/knowledge-base/upload.service.ts

import { putObject } from './oss';
import { knowledgeProcessQueue } from '../workers/queues';

export async function uploadAndQueue(
  userId: string,
  kbId: string,
  file: { buffer: Buffer; filename: string; mimeType: string }
) {
  const key = `knowledge/${kbId}/${Date.now()}-${file.filename}`;
  await putObject(key, file.buffer, { contentType: file.mimeType });

  await knowledgeProcessQueue.add(
    'process',
    { userId, kbId, ossKey: key, filename: file.filename },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );

  return { key };
}
```

```typescript
// src/workers/knowledge-process.worker.ts

import { Worker } from 'bullmq';
import { config } from '../config';
import { processDocument } from '../knowledge-base/embedding.service';

export const knowledgeProcessWorker = new Worker(
  'knowledge:process',
  async (job) => {
    const { userId, kbId, ossKey, filename } = job.data;
    await processDocument(userId, kbId, ossKey, filename);
  },
  { connection: { host: config.redis.host, port: config.redis.port } }
);
```

#### RAG 检索服务

```typescript
// src/knowledge-base/rag.service.ts

import { prisma } from '../utils/prisma';
import { getEmbedding } from './embedding.service';

export async function retrieve(
  kbId: string,
  query: string,
  topK: number = 5
) {
  const embedding = await getEmbedding(query);
  const results = await prisma.$queryRaw`
    SELECT id, content, metadata, 1 - (embedding <=> ${embedding}::vector) AS similarity
    FROM knowledge_chunks
    WHERE kb_id = ${kbId}
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${topK}
  `;
  return results;
}
```

---

### 6.5 配置服务（Redis 缓存 + Pub/Sub 热更新）

```typescript
// src/admin-services/system-config.service.ts

import { redis } from '../utils/redis';
import { prisma } from '../utils/prisma';
import { config } from '../config';

const CACHE_KEY = `${config.redis.keyPrefix}system_config`;
const CHANNEL = 'system_config:reload';

export async function getSystemConfig(): Promise<Record<string, unknown>> {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const rows = await prisma.systemConfig.findMany();
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  await redis.setex(CACHE_KEY, 3600, JSON.stringify(obj));
  return obj;
}

export async function updateConfig(key: string, value: unknown) {
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  await redis.del(CACHE_KEY);
  await redis.publish(CHANNEL, JSON.stringify({ key, value }));
}

// 订阅热更新
redis.subscribe(CHANNEL);
redis.on('message', (ch, msg) => {
  if (ch === CHANNEL) {
    // 通知各进程刷新本地缓存
    // eventEmitter.emit('config:reload', JSON.parse(msg));
  }
});
```

---

## 七、数据库管理

### 7.1 Prisma Migrate 流程

| 环境 | 命令 | 说明 |
|------|------|------|
| 开发 | `npm run db:migrate:dev` | 交互式创建迁移并应用 |
| Staging | `npm run db:migrate:staging` | 使用 `.env.staging` 部署迁移 |
| Prod | `npm run db:migrate:prod` | 使用 `.env.prod` 部署迁移 |

### 7.2 Seed 数据（RBAC）

```typescript
// prisma/seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.permission.createMany({
    data: [
      { code: 'user:read', name: '查看用户' },
      { code: 'user:write', name: '编辑用户' },
      { code: 'system_config:read', name: '查看系统配置' },
      { code: 'system_config:write', name: '编辑系统配置' },
      { code: '*', name: '超级权限' },
    ],
  });

  const adminRole = await prisma.role.create({
    data: {
      name: '超级管理员',
      permissions: { connect: [{ code: '*' }] },
    },
  });

  await prisma.admin.create({
    data: {
      username: 'admin',
      passwordHash: '...', // bcrypt
      roleId: adminRole.id,
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 7.3 备份策略

- **全量备份**：每日凌晨通过 `pg_dump` 备份
- **WAL 归档**：生产环境开启 WAL 归档以支持 PITR
- **脚本示例**：`scripts/backup-db.sh`

```bash
#!/bin/bash
# scripts/backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > "backups/thinkagent_${DATE}.sql.gz"
```

---

## 八、Docker 部署

### 8.1 Multi-stage Dockerfile

```dockerfile
# docker/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "--max-old-space-size=300", "dist/app.js"]
```

### 8.2 docker-compose.yml（本地开发）

```yaml
# docker/docker-compose.yml

version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: thinkagent
      POSTGRES_PASSWORD: thinkagent
      POSTGRES_DB: thinkagent
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://thinkagent:thinkagent@postgres:5432/thinkagent
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
  redisdata:
```

### 8.3 docker-compose.staging.yml / docker-compose.prod.yml

结构与 `docker-compose.yml` 类似，差异包括：

- 使用外部 PostgreSQL/Redis 或托管服务
- 环境变量从 `.env.staging` / `.env.prod` 注入
- 增加 `worker` 服务运行 BullMQ workers
- 配置 `restart: always`、资源限制等

---

## 九、健康检查与监控

### 9.1 GET /health

```typescript
// 见第五节 app.ts 中的 /health 实现
// 返回：{ status, timestamp, services: { database, redis } }
```

### 9.2 LangSmith Tracing

```typescript
// 在 Agent 调用前设置
if (config.langsmith?.tracing && config.langsmith.apiKey) {
  process.env.LANGCHAIN_TRACING_V2 = 'true';
  process.env.LANGCHAIN_API_KEY = config.langsmith.apiKey;
}
```

### 9.3 Pino 结构化日志

```typescript
// src/utils/logger.ts

import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', '*.password'],
});
```

---

## 十、稳定性保障

| 措施 | 实现 |
|------|------|
| **Graceful Shutdown** | 监听 SIGTERM/SIGINT，依次关闭 Fastify、Prisma、Redis |
| **Uncaught Exception** | `process.on('uncaughtException')` 记录并退出 |
| **Unhandled Rejection** | `process.on('unhandledRejection')` 记录并退出 |
| **内存限制** | `--max-old-space-size=300`（主进程）、150（Worker） |
| **连接池** | Prisma 配置 `connection_limit`，Redis 使用连接池 |
| **限流** | 用户端 `rate-limit` 中间件，Agent 管道内限流 |

---

## 附录：依赖清单

```json
{
  "dependencies": {
    "fastify": "^5.x",
    "@fastify/cors": "^10.x",
    "@fastify/helmet": "^12.x",
    "@langchain/openai": "^0.3.x",
    "@langchain/core": "^0.3.x",
    "@prisma/client": "^5.x",
    "bullmq": "^5.x",
    "ioredis": "^5.x",
    "jsonwebtoken": "^9.x",
    "pino": "^9.x",
    "pino-pretty": "^11.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "prisma": "^5.x",
    "tsx": "^4.x",
    "typescript": "^5.x",
    "dotenv-cli": "^7.x"
  }
}
```

---

*文档版本：1.0 | 更新日期：2025-03*
