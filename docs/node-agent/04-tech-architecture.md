# 技术架构设计

## 架构总览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              客户端层                                          │
│                                                                              │
│  ┌─ 用户端 ─────────────────────────────────────────────────────────────┐    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │  Web (React)  │  │  小程序 (Uni) │  │  H5 (UniApp) │               │    │
│  │  │  Next.js 14   │  │  微信小程序    │  │  移动端 H5   │               │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │    │
│  │         └──────────────────┼──────────────────┘                      │    │
│  └────────────────────────────┼─────────────────────────────────────────┘    │
│                               │                                              │
│  ┌─ 管理端 ──────────────────────────────────────────────────────────┐      │
│  │  ┌───────────────────────────────────────┐                        │      │
│  │  │  Admin SPA (React 18)                  │                        │      │
│  │  │  React Router v6 + Ant Design 5        │                        │      │
│  │  │  ├─ RBAC 动态路由/菜单                  │                        │      │
│  │  │  ├─ Dashboard 数据看板                   │                        │      │
│  │  │  ├─ 用户/内容/知识库管理                  │                        │      │
│  │  │  └─ 系统配置/审计日志                    │                        │      │
│  │  └───────────────────┬───────────────────┘                        │      │
│  └──────────────────────┼────────────────────────────────────────────┘      │
│                         │                                                    │
│                  HTTPS / SSE / WebSocket                                      │
└─────────────────────────┼────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────────────────┐
│                       网关层                                                  │
│            ┌────────────┴────────────┐                                       │
│            │      Nginx / CDN         │                                       │
│            │   (SSL 终止 / 负载均衡)   │                                       │
│            │                          │                                       │
│            │  路由规则：                │                                       │
│            │  api.thinkagent.ai/*     → 用户 API                              │
│            │  admin-api.thinkagent.ai/* → 管理 API                            │
│            │  admin.thinkagent.ai/*   → Admin SPA 静态资源                     │
│            └────────────┬────────────┘                                       │
└─────────────────────────┼────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────────────────┐
│                       应用层                                                  │
│  ┌──────────────────────┴───────────────────────────────────────────────┐    │
│  │                  Node.js 服务 (Fastify)                                │    │
│  │                                                                       │    │
│  │  ┌─ 用户 API (/v1) ──────────────────────────────────────────────┐   │    │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │    │
│  │  │ │ Auth API │ │ Chat API │ │  KB API  │ │ User API │         │   │    │
│  │  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │   │    │
│  │  └────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                       │    │
│  │  ┌─ 管理 API (/admin/v1) ────────────────────────────────────────┐   │    │
│  │  │ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │   │    │
│  │  │ │ AdminAuth │ │ UserMgmt  │ │ ContentMgmt│ │  RoleMgmt │     │   │    │
│  │  │ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │   │    │
│  │  │ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │   │    │
│  │  │ │ ConfigMgmt│ │ StatsMgmt │ │ AuditLog  │ │  KBMgmt   │     │   │    │
│  │  │ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │   │    │
│  │  │                                                               │   │    │
│  │  │  RBAC 中间件管道：                                              │   │    │
│  │  │  JWT认证 → 角色解析 → 权限校验 → 审计日志记录                     │   │    │
│  │  └────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                       │    │
│  │  ┌─ AI Agent 引擎层 ─────────────────────────────────────────────┐   │    │
│  │  │  ┌────────────────────────────────────────────────────────┐    │   │    │
│  │  │  │         LangChain.js + LangGraph                        │    │   │    │
│  │  │  │                                                          │    │   │    │
│  │  │  │  Agent Runtime                                           │    │   │    │
│  │  │  │  ├─ ReAct 推理循环                                        │    │   │    │
│  │  │  │  ├─ Tool Execution (ToolNode)                            │    │   │    │
│  │  │  │  ├─ Streaming (SSE)                                      │    │   │    │
│  │  │  │  └─ Structured Output                                    │    │   │    │
│  │  │  │                                                          │    │   │    │
│  │  │  │  Middleware Pipeline                                      │    │   │    │
│  │  │  │  ├─ rateLimitMiddleware  ◄── 管理后台可动态配置限额          │    │   │    │
│  │  │  │  ├─ contentFilterMiddleware ◄── 管理后台可配置敏感词         │    │   │    │
│  │  │  │  ├─ summarizationMiddleware                              │    │   │    │
│  │  │  │  └─ userProfileMiddleware                                │    │   │    │
│  │  │  │                                                          │    │   │    │
│  │  │  │  Memory                                                  │    │   │    │
│  │  │  │  ├─ Checkpointer (PostgresSaver)                         │    │   │    │
│  │  │  │  └─ Store (用户画像/长期记忆)                              │    │   │    │
│  │  │  └────────────────────────────────────────────────────────┘    │   │    │
│  │  └────────────────────────────────────────────────────────────────┘   │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────────────────┐
│                       数据层                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────┐                  │
│  │PostgreSQL│ │  Redis   │ │ Pinecone /   │ │ 阿里云 OSS │                  │
│  │          │ │          │ │ pgvector     │ │           │                  │
│  │ 业务数据  │ │ 缓存/限流 │ │ 向量检索      │ │ 文件存储   │                  │
│  │ RBAC数据 │ │ 权限缓存  │ │              │ │ 审计归档   │                  │
│  │ 审计日志  │ │ 配置缓存  │ │              │ │           │                  │
│  └──────────┘ └──────────┘ └──────────────┘ └───────────┘                  │
└──────────────────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────────────────────┐
│                      外部服务层                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐                   │
│  │ OpenAI   │ │ Claude   │ │ Tavily   │ │ 短信服务      │                   │
│  │ GPT-4o   │ │ Sonnet   │ │ 搜索 API │ │ (阿里云)      │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 技术选型详细说明

### 后端技术栈

| 组件 | 技术选型 | 版本 | 理由 |
|------|---------|------|------|
| 运行时 | Node.js | >= 20 LTS | LangChain.js 原生支持，团队精通 |
| Web 框架 | Fastify | 5.x | 高性能，原生 TS 支持，插件生态丰富 |
| AI 框架 | LangChain.js + LangGraph | latest | Agent 核心运行时，文档齐全 |
| ORM | Prisma | 5.x | 类型安全，迁移管理，直观 API |
| 验证 | Zod | 3.x | 与 LangChain 工具 schema 统一 |
| 认证 | JWT (jose) | latest | 轻量级，标准化 |
| 任务队列 | BullMQ | 5.x | 文档解析异步任务 |
| 日志 | Pino | 8.x | Fastify 默认，高性能 |
| 测试 | Vitest | latest | 快速，原生 TS |

### 前端技术栈 (Web)

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| 框架 | Next.js 14 (App Router) | SSR/SSG、SEO、React Server Components |
| UI 库 | shadcn/ui + Tailwind CSS | 高质量组件，定制性强 |
| 状态管理 | Zustand | 轻量级，TypeScript 友好 |
| 请求 | TanStack Query + fetch | 缓存管理，SSE 流式支持 |
| Markdown | react-markdown + remark | 富文本渲染，代码高亮 |
| 代码高亮 | Shiki | 高质量语法高亮 |
| 数学公式 | KaTeX | LaTeX 公式渲染 |
| 文件上传 | react-dropzone | 拖拽上传体验 |

### 管理端技术栈 (Admin SPA)

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| 框架 | React 18 (SPA) | 成熟稳定，团队精通，适合中后台场景 |
| 路由 | React Router v6 | SPA 路由管理，支持动态路由（RBAC 权限路由） |
| UI 库 | Ant Design 5 | 企业级中后台组件库，开箱即用 |
| 状态管理 | Zustand | 轻量级，与用户端 Web 保持一致 |
| 请求 | TanStack Query + Axios | 缓存管理 + 请求拦截器（Token 刷新、权限拦截） |
| 图表 | ECharts / @ant-design/charts | 数据可视化 Dashboard |
| 权限控制 | 自研 RBAC Hook + 组件 | usePermission Hook + AuthButton/AuthRoute 组件 |
| 构建工具 | Vite 5 | 快速 HMR，高效构建 |
| 代码规范 | ESLint + Prettier | 代码质量保障 |

### 移动端技术栈

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| 框架 | UniApp (Vue 3) | 一套代码编译到微信小程序 + H5 + App |
| UI 库 | uv-ui / uView Plus | UniApp 生态 UI 组件库 |
| 状态管理 | Pinia | Vue 3 官方推荐 |
| 请求 | uni.request + SSE polyfill | 适配小程序网络限制 |
| Markdown | mp-html | 小程序富文本渲染 |

### 数据层

| 组件 | 技术选型 | 用途 |
|------|---------|------|
| 主数据库 | PostgreSQL 16 | 用户、对话、知识库等业务数据 |
| 缓存 | Redis 7 | 会话缓存、速率限制、验证码 |
| 向量数据库 | pgvector (MVP) | RAG 向量检索，与 PG 同库简化运维 |
| 对象存储 | 阿里云 OSS | 用户上传的文件存储 |
| 消息队列 | Redis (BullMQ) | 异步任务（文档解析、向量化） |

---

## 核心模块设计

### 1. Agent 引擎模块

```
agent-engine/
├── agents/
│   ├── default-agent.ts       # 默认通用 Agent
│   ├── agent-factory.ts       # Agent 工厂，根据配置创建 Agent
│   └── agent-config.ts        # Agent 配置类型定义
├── tools/
│   ├── web-search.tool.ts     # 联网搜索
│   ├── kb-search.tool.ts      # 知识库检索
│   ├── content-gen.tool.ts    # 内容生成
│   ├── data-analysis.tool.ts  # 数据分析
│   └── tool-registry.ts       # 工具注册中心
├── middleware/
│   ├── rate-limit.ts          # 速率限制
│   ├── content-filter.ts      # 内容安全过滤
│   ├── summarization.ts       # 对话摘要
│   ├── user-profile.ts        # 用户画像注入
│   └── middleware-pipeline.ts # 中间件管道
├── memory/
│   ├── checkpointer.ts        # 会话级记忆 (PostgresSaver)
│   ├── user-store.ts          # 用户长期记忆 (Store)
│   └── memory-manager.ts      # 记忆管理器
└── streaming/
    ├── sse-handler.ts         # SSE 流式处理
    └── stream-transformer.ts  # 流事件转换
```

**Agent 创建流程：**

```typescript
// agent-factory.ts 核心逻辑
import { createAgent } from "@langchain/langgraph";
import { initChatModel } from "langchain/chat_models/universal";

async function createThinkAgent(userId: string, config: AgentUserConfig) {
  const model = await initChatModel(config.model || "openai:gpt-4o");

  const tools = buildToolset(userId, config);
  const middleware = buildMiddlewarePipeline(userId, config);

  return createAgent({
    model,
    tools,
    checkpointer: postgresSaver,
    middleware,
    prompt: buildSystemPrompt(config.preferences),
  });
}
```

### 2. 知识库模块

```
knowledge-base/
├── upload/
│   ├── file-parser.ts         # 文件解析器（PDF/Word/MD/TXT）
│   ├── url-scraper.ts         # URL 网页抓取
│   └── upload-handler.ts      # 上传处理（OSS + 队列）
├── processing/
│   ├── chunker.ts             # 文本分块
│   ├── embedder.ts            # 向量化 (OpenAI Embedding)
│   └── indexer.ts             # 向量索引管理
├── retrieval/
│   ├── retriever.ts           # RAG 检索器
│   ├── reranker.ts            # 结果重排序
│   └── context-builder.ts    # 上下文构建
└── management/
    ├── kb-service.ts          # 知识库 CRUD
    └── doc-service.ts         # 文档管理
```

**文档处理流水线：**

```
上传文件 → OSS 存储 → BullMQ 任务队列
                            │
                     Worker 处理：
                     ├─ 1. 从 OSS 下载文件
                     ├─ 2. 解析提取文本 (file-parser)
                     ├─ 3. 智能分块 (chunker)
                     │     ├─ RecursiveCharacterTextSplitter
                     │     ├─ chunkSize: 800 tokens
                     │     └─ chunkOverlap: 100 tokens
                     ├─ 4. 批量向量化 (embedder)
                     │     ├─ text-embedding-3-small
                     │     └─ batch size: 100
                     ├─ 5. 存入 pgvector (indexer)
                     └─ 6. 更新文档状态为"可用"
```

### 3. 流式通信模块

**SSE (Server-Sent Events) 方案：**

```typescript
// SSE 路由示例
fastify.get('/api/chat/stream/:threadId', async (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const agent = await getOrCreateAgent(userId);
  const stream = agent.stream(
    { messages: [{ role: "user", content: userMessage }] },
    { configurable: { thread_id: threadId }, streamMode: ["messages", "updates", "custom"] }
  );

  for await (const event of stream) {
    reply.raw.write(`data: ${JSON.stringify(transformEvent(event))}\n\n`);
  }

  reply.raw.write('data: [DONE]\n\n');
  reply.raw.end();
});
```

**小程序兼容方案：**

微信小程序不支持原生 SSE，采用以下适配方案：

```
方案 A（推荐）：RequestTask + 分块读取
- 使用 uni.request 的 enableChunkedTransfer 选项
- 后端输出格式与 SSE 一致
- 客户端解析 chunked response

方案 B（降级）：轮询
- 如遇网络限制，降级为短轮询
- 100ms 间隔轮询 /api/chat/poll/:messageId
- 服务端维护消息缓冲区
```

---

## 项目目录结构

```
thinkagent/
├── packages/
│   ├── server/                    # 后端服务
│   │   ├── src/
│   │   │   ├── app.ts             # Fastify 应用入口
│   │   │   ├── config/            # 配置管理
│   │   │   ├── routes/            # 用户端 API 路由
│   │   │   │   ├── auth.ts
│   │   │   │   ├── chat.ts
│   │   │   │   ├── knowledge-base.ts
│   │   │   │   └── user.ts
│   │   │   ├── admin-routes/      # 管理端 API 路由
│   │   │   │   ├── admin-auth.ts        # 管理员认证
│   │   │   │   ├── admin-user-mgmt.ts   # 用户管理
│   │   │   │   ├── admin-content.ts     # 内容管理
│   │   │   │   ├── admin-knowledge.ts   # 知识库管理
│   │   │   │   ├── admin-role.ts        # 角色权限管理
│   │   │   │   ├── admin-config.ts      # 系统配置
│   │   │   │   ├── admin-stats.ts       # 数据统计
│   │   │   │   └── admin-audit.ts       # 审计日志
│   │   │   ├── services/          # 业务逻辑
│   │   │   ├── admin-services/    # 管理端业务逻辑
│   │   │   │   ├── rbac.service.ts      # RBAC 权限服务
│   │   │   │   ├── admin-auth.service.ts # 管理员认证服务
│   │   │   │   ├── user-mgmt.service.ts # 用户管控服务
│   │   │   │   ├── audit-log.service.ts # 审计日志服务
│   │   │   │   └── stats.service.ts     # 统计聚合服务
│   │   │   ├── agent-engine/      # AI Agent 引擎
│   │   │   ├── knowledge-base/    # 知识库模块
│   │   │   ├── middleware/        # Fastify 中间件（用户端）
│   │   │   ├── admin-middleware/  # 管理端中间件
│   │   │   │   ├── admin-auth.ts        # 管理员 JWT 认证
│   │   │   │   ├── rbac-guard.ts        # RBAC 权限守卫
│   │   │   │   └── audit-logger.ts      # 操作审计记录
│   │   │   ├── models/            # Prisma 数据模型
│   │   │   ├── utils/             # 工具函数
│   │   │   └── workers/           # BullMQ Worker
│   │   ├── prisma/
│   │   │   └── schema.prisma      # 数据库 Schema（含 RBAC 模型）
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                       # Web 用户端
│   │   ├── app/                   # Next.js App Router
│   │   │   ├── (auth)/            # 登录注册页
│   │   │   ├── (main)/            # 主应用
│   │   │   │   ├── chat/          # 对话页
│   │   │   │   ├── knowledge/     # 知识库页
│   │   │   │   └── settings/      # 设置页
│   │   │   ├── api/               # API Routes (BFF)
│   │   │   └── layout.tsx
│   │   ├── components/            # React 组件
│   │   │   ├── chat/              # 对话相关组件
│   │   │   ├── knowledge/         # 知识库组件
│   │   │   ├── layout/            # 布局组件
│   │   │   └── ui/                # shadcn/ui 组件
│   │   ├── lib/                   # 工具库
│   │   ├── hooks/                 # React Hooks
│   │   ├── stores/                # Zustand Stores
│   │   └── package.json
│   │
│   ├── admin/                     # 管理后台 (React 18 SPA)
│   │   ├── src/
│   │   │   ├── main.tsx           # 应用入口
│   │   │   ├── App.tsx            # 根组件（路由配置）
│   │   │   ├── router/            # 路由配置
│   │   │   │   ├── index.tsx            # 路由定义
│   │   │   │   ├── auth-route.tsx       # 权限路由守卫组件
│   │   │   │   └── route-config.ts      # 路由-权限映射配置
│   │   │   ├── pages/             # 页面组件
│   │   │   │   ├── login/               # 管理员登录页
│   │   │   │   ├── dashboard/           # 数据看板
│   │   │   │   ├── users/               # 用户管理
│   │   │   │   │   ├── UserList.tsx
│   │   │   │   │   └── UserDetail.tsx
│   │   │   │   ├── content/             # 内容管理
│   │   │   │   │   ├── ThreadList.tsx
│   │   │   │   │   ├── ThreadDetail.tsx
│   │   │   │   │   └── ModerationQueue.tsx
│   │   │   │   ├── knowledge/           # 知识库管理
│   │   │   │   ├── subscription/        # 订阅管理
│   │   │   │   │   ├── Plans.tsx
│   │   │   │   │   ├── Orders.tsx
│   │   │   │   │   └── Coupons.tsx
│   │   │   │   └── system/              # 系统管理
│   │   │   │       ├── Admins.tsx
│   │   │   │       ├── Roles.tsx
│   │   │   │       ├── Config.tsx
│   │   │   │       └── AuditLogs.tsx
│   │   │   ├── components/        # 公共组件
│   │   │   │   ├── layout/              # 管理端布局
│   │   │   │   │   ├── AdminLayout.tsx  # 整体布局（侧边栏+顶栏+内容区）
│   │   │   │   │   ├── Sidebar.tsx      # 动态权限菜单
│   │   │   │   │   └── Header.tsx
│   │   │   │   ├── auth/                # 权限控制组件
│   │   │   │   │   ├── AuthButton.tsx   # 按钮级权限控制
│   │   │   │   │   └── AuthWrapper.tsx  # 区域级权限控制
│   │   │   │   └── common/              # 通用业务组件
│   │   │   ├── hooks/             # 自定义 Hooks
│   │   │   │   ├── usePermission.ts     # 权限判断 Hook
│   │   │   │   ├── useAdmin.ts          # 管理员信息 Hook
│   │   │   │   └── useAuditAction.ts    # 审计操作 Hook
│   │   │   ├── stores/            # Zustand Stores
│   │   │   │   ├── auth.store.ts        # 管理员认证状态
│   │   │   │   └── permission.store.ts  # 权限与菜单状态
│   │   │   ├── api/               # API 请求封装
│   │   │   │   ├── request.ts           # Axios 实例（拦截器配置）
│   │   │   │   ├── admin-auth.api.ts
│   │   │   │   ├── user-mgmt.api.ts
│   │   │   │   ├── content.api.ts
│   │   │   │   ├── role.api.ts
│   │   │   │   └── stats.api.ts
│   │   │   ├── types/             # TypeScript 类型定义
│   │   │   └── utils/             # 工具函数
│   │   ├── index.html             # SPA 入口 HTML
│   │   ├── vite.config.ts         # Vite 构建配置
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── mobile/                    # 移动端
│       ├── src/
│       │   ├── pages/             # UniApp 页面
│       │   │   ├── index/         # 首页（对话列表）
│       │   │   ├── chat/          # 对话页
│       │   │   ├── knowledge/     # 知识库
│       │   │   └── mine/          # 个人中心
│       │   ├── components/        # 公共组件
│       │   ├── stores/            # Pinia Stores
│       │   ├── utils/             # 工具函数
│       │   ├── api/               # API 封装
│       │   ├── App.vue
│       │   └── main.ts
│       ├── pages.json             # 页面配置
│       ├── manifest.json          # UniApp 配置
│       └── package.json
│
├── docker-compose.yml             # 本地开发环境
├── package.json                   # Monorepo root
├── pnpm-workspace.yaml
└── turbo.json                     # Turborepo 配置
```

---

### 4. RBAC 权限引擎模块

```
admin-services/
├── rbac.service.ts              # RBAC 核心逻辑
├── admin-auth.service.ts        # 管理员认证（登录/Token/密码）
├── user-mgmt.service.ts         # 用户管控（禁用/配额/等级调整）
├── audit-log.service.ts         # 审计日志写入与查询
└── stats.service.ts             # 统计数据聚合（Dashboard 数据源）
```

**RBAC 权限校验核心逻辑：**

```typescript
// rbac.service.ts 核心逻辑
class RbacService {
  // 获取管理员完整权限列表（带 Redis 缓存）
  async getAdminPermissions(adminId: string): Promise<string[]> {
    const cacheKey = `admin:permissions:${adminId}`;
    let permissions = await redis.get(cacheKey);

    if (!permissions) {
      const roles = await prisma.adminRoleAssignment.findMany({
        where: { adminId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      permissions = [...new Set(roles.flatMap(r => r.role.permissions.map(p => p.permission.code)))];
      await redis.setex(cacheKey, 600, JSON.stringify(permissions)); // 10min 缓存
    }

    return Array.isArray(permissions) ? permissions : JSON.parse(permissions);
  }

  // 权限校验
  async checkPermission(adminId: string, requiredPermission: string): Promise<boolean> {
    const permissions = await this.getAdminPermissions(adminId);
    // super_admin 拥有所有权限
    if (permissions.includes('*')) return true;
    return permissions.includes(requiredPermission);
  }

  // 角色变更时清除权限缓存
  async invalidatePermissionCache(adminId: string): Promise<void> {
    await redis.del(`admin:permissions:${adminId}`);
  }
}
```

**RBAC Fastify 中间件：**

```typescript
// admin-middleware/rbac-guard.ts
function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const adminId = request.adminUser.id; // 由 admin-auth 中间件注入
    const hasPermission = await rbacService.checkPermission(adminId, permission);
    if (!hasPermission) {
      reply.status(403).send({ code: 1003, data: null, message: '权限不足' });
      return;
    }
    // 记录审计日志
    await auditLogService.log({
      adminId,
      action: request.method,
      resource: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  };
}

// 使用示例
fastify.get('/admin/v1/users',
  { preHandler: [adminAuthMiddleware, requirePermission('user:list')] },
  userMgmtController.listUsers
);
```

### 5. 管理端前端权限控制模块

```typescript
// hooks/usePermission.ts - 权限判断 Hook
function usePermission() {
  const permissions = usePermissionStore(state => state.permissions);

  const hasPermission = useCallback((code: string) => {
    if (permissions.includes('*')) return true;
    return permissions.includes(code);
  }, [permissions]);

  const hasAnyPermission = useCallback((codes: string[]) => {
    return codes.some(code => hasPermission(code));
  }, [hasPermission]);

  return { hasPermission, hasAnyPermission };
}

// components/auth/AuthButton.tsx - 按钮级权限组件
function AuthButton({ permission, children, ...props }: AuthButtonProps) {
  const { hasPermission } = usePermission();
  if (!hasPermission(permission)) return null;
  return <Button {...props}>{children}</Button>;
}

// router/auth-route.tsx - 路由级权限守卫
function AuthRoute({ permission, children }: AuthRouteProps) {
  const { hasPermission } = usePermission();
  if (!hasPermission(permission)) return <Navigate to="/403" />;
  return children;
}

// 动态路由生成：登录后根据权限过滤路由配置，生成实际可访问路由表
function generateRoutes(allRoutes: RouteConfig[], permissions: string[]): RouteConfig[] {
  return allRoutes.filter(route => {
    if (!route.permission) return true;
    return permissions.includes('*') || permissions.includes(route.permission);
  });
}
```

---

## 部署架构 (MVP)

```
MVP 部署方案（控制成本）：

┌───────────────────────────────────────────────────────┐
│                阿里云 / 腾讯云                           │
│                                                        │
│  ┌──────────────┐    ┌──────────────────────┐         │
│  │ CDN          │    │ ECS (2核4G)            │         │
│  │ ├─ Web 静态  │    │ ├─ Node.js Server     │         │
│  │ ├─ Admin SPA │    │ │   ├─ 用户 API        │         │
│  │ └─ 移动端资源 │    │ │   └─ 管理 API        │         │
│  └──────────────┘    │ ├─ BullMQ Worker      │         │
│                       │ └─ Nginx              │         │
│                       │    ├─ api.*    → :3000 │         │
│                       │    ├─ admin.*  → SPA   │         │
│                       │    └─ admin-api.* → :3000 │      │
│                       └────────────┬─────────┘         │
│                                    │                    │
│  ┌──────────────────┐  ┌──────────┴───────────┐       │
│  │ RDS PostgreSQL   │  │ Redis (云)            │       │
│  │ (1核2G, pgvector)│  │ (1G)                  │       │
│  │ + RBAC 数据      │  │ + 权限缓存/配置缓存    │       │
│  └──────────────────┘  └──────────────────────┘       │
│                                                        │
│  ┌──────────┐    ┌──────────────┐                     │
│  │ OSS      │    │ 域名 + SSL   │                     │
│  │ 文件存储  │    │ ├─ thinkagent.ai                   │
│  │ 审计归档  │    │ ├─ api.thinkagent.ai               │
│  └──────────┘    │ ├─ admin.thinkagent.ai             │
│                   │ └─ admin-api.thinkagent.ai         │
│                   └──────────────┘                     │
└───────────────────────────────────────────────────────┘

预估月成本：
- ECS 2核4G：约 ¥200/月
- RDS PostgreSQL：约 ¥150/月
- Redis：约 ¥50/月
- OSS：约 ¥20/月
- CDN + 域名：约 ¥50/月（新增 admin 子域名）
- OpenAI API：约 ¥500-2000/月（按量）
──────────────────────────────
总计：约 ¥1000-2500/月
```

---

## 安全架构

```
安全层级设计：

1. 网络层
   ├─ HTTPS 全站加密
   ├─ Nginx 限流（IP 级别）
   ├─ DDoS 防护（云服务商）
   └─ 管理后台 IP 白名单 / VPN 访问控制

2. 用户端应用层
   ├─ JWT 认证 + Token 刷新
   ├─ 请求参数校验（Zod）
   ├─ CORS 白名单
   └─ Helmet 安全头

3. 管理端应用层（Admin）
   ├─ 独立认证体系（用户名+密码，与前台隔离）
   ├─ RBAC 权限控制（角色-权限多级校验）
   ├─ JWT Token 短有效期（access_token: 2h）
   ├─ 登录失败锁定（5 次失败锁定 30 分钟）
   ├─ 强制单设备在线（防止 Token 共享）
   ├─ 敏感操作二次确认（删除用户、修改权限等）
   ├─ 所有操作审计日志（append-only，不可篡改）
   └─ 权限缓存 + Redis Pub/Sub 实时失效

4. AI 安全层
   ├─ Prompt 注入检测（beforeModel 中间件）
   ├─ 输出内容过滤（afterModel 中间件）
   ├─ 工具调用权限控制
   ├─ 敏感信息脱敏
   └─ 管理后台可动态配置审核规则

5. 数据层
   ├─ 数据库访问控制
   ├─ 敏感字段加密（AES-256）
   ├─ 管理员密码 bcrypt 哈希存储
   ├─ SQL 注入防护（Prisma ORM）
   ├─ 定期数据备份
   └─ 审计日志 180 天归档到 OSS
```

---

## 监控与可观测性

| 层面 | 工具 | 监控项 |
|------|------|--------|
| 应用监控 | Pino + ELK / 云日志服务 | 请求日志、错误日志、性能指标 |
| AI 追踪 | LangSmith | Agent 执行链路、工具调用、Token 消耗 |
| 基础设施 | 云监控 | CPU、内存、磁盘、网络 |
| 业务指标 | 自建 Dashboard | DAU、对话量、工具调用分布、留存率 |
| 告警 | 云告警 + 企微/钉钉 | 错误率 > 1%、响应时间 > 5s、CPU > 80% |
