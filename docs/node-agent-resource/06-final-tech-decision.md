# 最终技术决策与架构方案

## 决策摘要

| 维度 | 决策 | 备选 | 决策理由 |
|------|------|------|---------|
| 后端框架 | **Fastify 5.x** | MidwayJS 3.x | 内存占用仅 MidwayJS 的 1/2，LangChain.js 生态亲和力最佳 |
| ORM | **Prisma 5.x** | Drizzle ORM | 类型安全最强，迁移管理最成熟，单人维护效率最高 |
| 数据库 | **PostgreSQL 16 + pgvector** | 无替代 | 唯一同时满足业务数据 + 向量检索 + LangGraph Checkpointer 的方案 |
| 缓存 | **Redis 7 Alpine** | - | 速率限制、会话缓存、BullMQ 后端 |
| Web 框架 | **Next.js 14** | - | SSR + React 生态 |
| 移动端 | **UniApp (Vue 3)** | - | 一码多端：微信小程序 + H5 |
| CI/CD | **n8n + Shell 脚本**（MVP）→ Jenkins（扩展期） | 纯 Jenkins | 2.5G 服务器 Jenkins 常驻不现实，n8n 可复用 |
| 部署 | **Docker Compose** | K8s | 单机资源不足以运行 K8s |
| 反向代理 | **Nginx Alpine** | - | 轻量、SSE 支持成熟 |
| 工作流 | **n8n** | - | 运维自动化 + 业务自动化 + 部署触发 |

---

## 最终架构图

```
                        ┌──────────────────────────┐
                        │       用户访问入口          │
                        │                           │
                        │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
                        │  │Web│ │小程│ │飞书│ │Disc│ │
                        │  │   │ │ 序 │ │Bot│ │ord │ │
                        │  └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ │
                        └────┼─────┼─────┼─────┼───┘
                             │     │     │     │
                             └──┬──┘     └──┬──┘
                                │           │
                          HTTPS/SSE    Webhook/API
                                │           │
┌───────────────────────────────┼───────────┼───────────────────┐
│  2核 2.5G 40G 云服务器         │           │                   │
│                                │           │                   │
│  ┌─────────────────────────────┴───────────┴────────────────┐ │
│  │                     Nginx (Alpine, 20MB)                  │ │
│  │  :80 → :443 重定向                                        │ │
│  │  :443 → SSL 终止 → 反向代理                                │ │
│  │  ├─ thinkagent.ai        → 静态文件 (Next.js export)     │ │
│  │  ├─ api.thinkagent.ai    → Fastify :3000                 │ │
│  │  └─ n8n.thinkagent.ai    → n8n :5678                     │ │
│  └──────────────────────────────┬────────────────────────────┘ │
│                                  │                              │
│  ┌───────────────────────────────┴───────────────────────────┐ │
│  │              Fastify 5 + LangChain.js (300MB)              │ │
│  │                                                             │ │
│  │  路由层                                                     │ │
│  │  ├─ /v1/auth/*          认证（手机号/微信/飞书/Discord）      │ │
│  │  ├─ /v1/chat/*          对话（SSE 流式）                    │ │
│  │  ├─ /v1/knowledge-bases/* 知识库 CRUD                      │ │
│  │  ├─ /v1/users/*         用户管理                            │ │
│  │  ├─ /v1/files/*         文件上传（OSS 直传凭证）             │ │
│  │  ├─ /feishu/events      飞书事件回调                        │ │
│  │  ├─ /discord/interactions Discord 交互回调                  │ │
│  │  └─ /wechat/callback    微信消息回调                        │ │
│  │                                                             │ │
│  │  Agent 引擎 (LangChain.js + LangGraph)                     │ │
│  │  ├─ createAgent() → ReAct 推理循环                         │ │
│  │  ├─ Tools: web_search | kb_search | content_gen            │ │
│  │  ├─ Middleware: rate_limit | content_filter | summarize    │ │
│  │  ├─ Memory: PostgresSaver (短期) + Store (长期)             │ │
│  │  └─ Streaming: SSE → messages + updates + custom           │ │
│  │                                                             │ │
│  │  ORM: Prisma 5                                              │ │
│  │  ├─ 自动类型生成                                             │ │
│  │  ├─ prisma migrate deploy                                   │ │
│  │  └─ pgvector → $queryRaw 向量检索                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ BullMQ Worker│  │    Redis 7   │  │  PostgreSQL 16       │   │
│  │  (150MB)     │  │   (50MB)     │  │  + pgvector (256MB)  │   │
│  │              │  │              │  │                       │   │
│  │ 文档解析     │  │ 缓存/限流    │  │ 业务数据              │   │
│  │ 向量化       │  │ 验证码       │  │ Agent Checkpoints     │   │
│  │ 异步任务     │  │ BullMQ 队列  │  │ 向量索引 (HNSW)      │   │
│  └──────────────┘  └──────────────┘  │ n8n 数据              │   │
│                                       └──────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 n8n (250MB)                                │   │
│  │                                                            │   │
│  │  运维自动化                    业务自动化                    │   │
│  │  ├─ 部署触发 (Git Webhook)    ├─ 新用户欢迎                │   │
│  │  ├─ 健康检查告警               ├─ 反馈日报                  │   │
│  │  ├─ 数据库自动备份             ├─ 使用量监控                │   │
│  │  ├─ 磁盘清理                   └─ 多渠道通知                │   │
│  │  └─ 日志轮转                                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Jenkins (按需启动, ~600MB, 通过 Docker profile 控制)      │   │
│  │  构建时启动 → 构建完成 → 自动停止                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Swap: 2GB | OS + Docker Engine: ~250MB                          │
│  内存总计: 常驻 ~1,416MB / 可用 2,560MB / 缓冲 ~1,144MB         │
└──────────────────────────────────────────────────────────────────┘
                             │
                    外部服务 (API 调用)
                             │
          ┌──────────┬───────┴──────┬──────────┐
          │          │              │          │
     ┌────┴───┐ ┌───┴────┐  ┌─────┴────┐ ┌───┴──────┐
     │ OpenAI │ │ Tavily │  │阿里云 OSS │ │阿里云短信 │
     │ GPT-4o │ │ 搜索   │  │ 文件存储  │ │ 验证码   │
     └────────┘ └────────┘  └──────────┘ └──────────┘
```

---

## 核心技术栈版本锁定

```json
{
  "runtime": {
    "node": ">=20.11.0 LTS",
    "pnpm": ">=9.0.0",
    "docker": ">=25.0",
    "docker-compose": ">=2.24"
  },
  "backend": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^12.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/websocket": "^11.0.0",
    "prisma": "^5.20.0",
    "@prisma/client": "^5.20.0",
    "langchain": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "@langchain/anthropic": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/langgraph-checkpoint-postgres": "^0.0.6",
    "bullmq": "^5.0.0",
    "zod": "^3.23.0",
    "jose": "^5.0.0",
    "pino": "^8.0.0"
  },
  "web": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    "react-markdown": "^9.0.0",
    "shiki": "^1.0.0"
  },
  "mobile": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "@dcloudio/uni-app": "latest"
  },
  "infrastructure": {
    "postgresql": "16 + pgvector 0.7",
    "redis": "7-alpine",
    "nginx": "alpine",
    "n8n": "latest",
    "jenkins": "lts-alpine"
  }
}
```

---

## 安全基线

### 传输层

| 项目 | 配置 |
|------|------|
| HTTPS | 全站强制，TLS 1.2+ |
| HSTS | max-age=31536000 |
| 证书 | Let's Encrypt 自动续期 |

### 应用层

| 项目 | 配置 |
|------|------|
| 认证 | JWT (jose)，access 7天 + refresh 30天 |
| 密码 | 无密码设计（验证码 + OAuth） |
| CORS | 白名单域名 |
| Helmet | 安全头全开 |
| 限流 | IP + 用户双维度 |
| 输入校验 | Zod schema 校验所有请求参数 |
| SQL 注入 | Prisma ORM 参数化查询 |
| XSS | React 自动转义 + CSP 头 |
| Prompt 注入 | beforeModel 中间件检测 |

### 数据层

| 项目 | 配置 |
|------|------|
| 数据库访问 | 仅内部网络 (127.0.0.1) |
| 敏感数据 | 手机号 API 返回脱敏 |
| 备份 | 每日自动备份到 OSS |
| 密钥管理 | 环境变量，不入代码仓库 |

---

## 风险登记簿

| 风险 | 概率 | 影响 | 缓解策略 | 应急预案 |
|------|------|------|---------|---------|
| 2.5G 内存 OOM | 中 | 高 | Docker 内存限制 + Swap + 降级脚本 | 自动重启 + n8n 告警 |
| 40G 磁盘耗尽 | 中 | 高 | 自动清理 + OSS 外存 | 紧急清理脚本 |
| OpenAI API 故障 | 中 | 高 | 多模型降级（GPT-4o → Claude → Gemini） | 返回"服务繁忙"提示 |
| 微信审核被拒 | 高 | 中 | 内容安全检测全覆盖 | 修改后重新提交 |
| 小红书 API 权限不通过 | 高 | 低 | MVP 不强依赖，仅做内容格式适配 | 降级为纯内容生成 |
| 数据库数据丢失 | 低 | 极高 | 每日备份 + WAL 归档 | 从 OSS 恢复 < 30 分钟 |
| Docker 构建时 CPU 满载 | 高 | 低 | 非高峰构建 + nice 优先级调低 | 用户无感（I/O 等待型） |
| 并发 SSE 超载 | 中 | 中 | 连接数硬限制 30 | 排队提示 + 非流式降级 |

---

## 成本估算（月度）

### 基础设施

| 项目 | 规格 | 月费 |
|------|------|------|
| 云服务器 | 2 核 2.5G 40G | ~¥70-150（各云厂商学生/活动价） |
| 域名 | .ai 域名 | ~¥50/月（年付） |
| SSL 证书 | Let's Encrypt | ¥0 |
| OSS 存储 | 10GB | ~¥3 |
| OSS 流量 | 10GB/月 | ~¥5 |
| 短信 | 1000 条/月 | ~¥45 |
| **小计** | | **~¥173-253/月** |

### AI API

| 项目 | 预估用量 | 月费 |
|------|---------|------|
| OpenAI GPT-4o | 50 万 input + 25 万 output tokens/天 | ~¥600-1200 |
| OpenAI Embedding | 100 万 tokens/月 | ~¥15 |
| Tavily 搜索 | 5000 次/月 | ¥0（免费额度内） |
| **小计** | | **~¥615-1215/月** |

### 总计

| 阶段 | 月成本 |
|------|--------|
| 开发期（少量 AI 调用） | ~¥300-400 |
| 内测期（100 用户） | ~¥600-900 |
| 公测期（1000 DAU） | ~¥1,200-2,000 |

---

## 给工程师的执行指南

### 开发环境搭建顺序

```
1. Clone 仓库 + pnpm install
2. docker compose up -d postgres redis    # 启动数据库
3. cp .env.example .env                   # 配置环境变量
4. npx prisma migrate dev                 # 初始化数据库
5. pnpm dev                               # 启动开发服务器
```

### 关键开发原则

1. **内存敏感：** 任何新功能都要考虑内存影响，避免大对象缓存
2. **流式优先：** AI 回复必须用 SSE 流式，不在服务端缓存完整响应
3. **文件不过 Node：** 所有文件上传走 OSS 直传（presigned URL）
4. **查询带分页：** 所有列表查询必须分页，防止大查询打爆内存
5. **日志精简：** 生产环境 Pino 仅输出 warn 以上级别
6. **镜像瘦身：** 多阶段构建，生产镜像不含 devDependencies
7. **连接池控制：** Prisma 连接池 max 10，PG max_connections 30

### 第一天要做的事

```
□ 阅读本文档 + 01-05 技术文档
□ 搭建本地开发环境（Docker Compose）
□ 跑通 Hello World：Fastify + Prisma + LangChain Agent
□ 验证 SSE 流式输出（curl 测试）
□ 验证 pgvector 向量检索（SQL 测试）
```
