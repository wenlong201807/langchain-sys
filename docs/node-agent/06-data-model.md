# 数据模型设计

## 概述

使用 PostgreSQL 作为主数据库，Prisma 作为 ORM。向量检索使用 pgvector 扩展。

---

## ER 关系图

```
=== 用户业务域 ===

┌──────────┐     1:N     ┌──────────────┐     1:N     ┌──────────────┐
│   User   │────────────→│    Thread     │────────────→│   Message    │
└──────────┘             └──────────────┘             └──────────────┘
     │                                                       │
     │ 1:N                                                   │ 1:N
     ▼                                                       ▼
┌──────────────┐                                    ┌──────────────┐
│KnowledgeBase │                                    │  ToolCall    │
└──────────────┘                                    └──────────────┘
     │
     │ 1:N                  ┌──────────────┐
     ▼                      │  Feedback    │
┌──────────────┐            └──────────────┘
│  Document    │                   ▲
└──────────────┘                   │ 1:1
     │                      ┌──────────────┐
     │ 1:N                  │   Message    │
     ▼                      └──────────────┘
┌──────────────┐
│DocumentChunk │     ┌──────────────┐     ┌──────────────┐
│ (pgvector)   │     │  Favorite    │     │ UserMemory   │
└──────────────┘     └──────────────┘     └──────────────┘

=== 管理端 RBAC 域 ===

┌──────────────┐     N:N      ┌──────────────┐     N:N      ┌──────────────┐
│  AdminUser   │─────────────→│     Role     │─────────────→│  Permission  │
└──────────────┘  (AdminRole  └──────────────┘ (RolePerm    └──────────────┘
     │             Assignment)      │            ission)
     │ 1:N                         │
     ▼                             │
┌──────────────┐                   │
│  AuditLog    │                   │
└──────────────┘                   │
                                   │
┌──────────────┐                   │
│ SystemConfig │                   │
└──────────────┘                   │
                                   │
┌──────────────┐                   │
│ UserQuota    │                   │
│ Override     │                   │
└──────────────┘                   │
                                   │
┌──────────────┐                   │
│ ContentFlag  │◄──────────────────┘ (审核员通过角色获得审核权限)
└──────────────┘
```

---

## Prisma Schema

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

// ================================
// 用户模型
// ================================

model User {
  id                String    @id @default(cuid())
  phone             String?   @unique
  wechatOpenId      String?   @unique @map("wechat_open_id")
  wechatUnionId     String?   @map("wechat_union_id")
  nickname          String    @default("用户")
  avatar            String?
  profession        Profession?
  aiStylePreference AiStyle   @default(PROFESSIONAL) @map("ai_style_preference")
  tier              UserTier  @default(FREE)

  // 账户状态（管理后台可控制）
  status        UserStatus @default(ACTIVE)
  disableReason String?    @map("disable_reason")
  disabledAt    DateTime?  @map("disabled_at")

  // 订阅信息
  subscriptionPlan     String?   @map("subscription_plan")
  subscriptionExpireAt DateTime? @map("subscription_expire_at")
  autoRenew            Boolean   @default(false) @map("auto_renew")

  // 使用量（当日）
  todayChatCount   Int      @default(0) @map("today_chat_count")
  todaySearchCount Int      @default(0) @map("today_search_count")
  usageResetAt     DateTime @default(now()) @map("usage_reset_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 关联
  threads        Thread[]
  knowledgeBases KnowledgeBase[]
  favorites      Favorite[]
  memories       UserMemory[]
  feedbacks      Feedback[]
  quotaOverride  UserQuotaOverride?

  @@map("users")
}

enum UserStatus {
  ACTIVE
  DISABLED
}

enum Profession {
  DEVELOPER
  PRODUCT_MANAGER
  DESIGNER
  CONTENT_CREATOR
  STUDENT
  RESEARCHER
  BUSINESS_OWNER
  OTHER
}

enum AiStyle {
  PROFESSIONAL
  CASUAL
  CONCISE
}

enum UserTier {
  FREE
  PRO
  TEAM
  ENTERPRISE
}

// ================================
// 对话模型
// ================================

model Thread {
  id     String @id @default(cuid())
  userId String @map("user_id")
  title  String @default("新对话")

  // 关联的知识库
  knowledgeBaseIds String[] @map("knowledge_base_ids")

  // Agent 配置快照（允许每个对话自定义）
  agentModel  String? @map("agent_model")
  systemPrompt String? @map("system_prompt")

  isArchived Boolean @default(false) @map("is_archived")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 关联
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Message[]

  @@index([userId, updatedAt(sort: Desc)])
  @@map("threads")
}

model Message {
  id       String      @id @default(cuid())
  threadId String      @map("thread_id")
  role     MessageRole

  // 消息内容
  content     String
  attachments Json?    @default("[]")

  // AI 回复相关
  inputTokens  Int? @map("input_tokens")
  outputTokens Int? @map("output_tokens")
  finishReason String? @map("finish_reason")
  modelUsed    String? @map("model_used")

  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  thread    Thread     @relation(fields: [threadId], references: [id], onDelete: Cascade)
  toolCalls ToolCall[]
  feedback  Feedback?

  @@index([threadId, createdAt])
  @@map("messages")
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
  TOOL
}

model ToolCall {
  id        String @id @default(cuid())
  messageId String @map("message_id")

  toolName  String @map("tool_name")
  input     Json
  result    String?
  status    ToolCallStatus @default(PENDING)
  duration  Int?           // 执行耗时（毫秒）

  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@map("tool_calls")
}

enum ToolCallStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
}

// ================================
// 知识库模型
// ================================

model KnowledgeBase {
  id          String @id @default(cuid())
  userId      String @map("user_id")
  name        String
  description String?
  icon        String @default("📚")

  documentCount Int @default(0) @map("document_count")
  totalSize     BigInt @default(0) @map("total_size")
  status        KbStatus @default(ACTIVE)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 关联
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  documents Document[]

  @@index([userId])
  @@map("knowledge_bases")
}

enum KbStatus {
  ACTIVE
  ARCHIVED
}

model Document {
  id              String @id @default(cuid())
  knowledgeBaseId String @map("knowledge_base_id")

  name     String
  type     DocType
  size     BigInt
  fileKey  String  @map("file_key")    // OSS 文件路径
  fileUrl  String  @map("file_url")    // 访问 URL

  status     DocStatus @default(PROCESSING)
  chunkCount Int       @default(0) @map("chunk_count")
  errorMsg   String?   @map("error_msg")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 关联
  knowledgeBase KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  chunks        DocumentChunk[]

  @@index([knowledgeBaseId])
  @@map("documents")
}

enum DocType {
  PDF
  DOCX
  MARKDOWN
  TXT
  URL
}

enum DocStatus {
  PROCESSING
  READY
  FAILED
}

model DocumentChunk {
  id         String @id @default(cuid())
  documentId String @map("document_id")

  content    String                                // 文本内容
  embedding  Unsupported("vector(1536)")?          // pgvector 向量
  metadata   Json?                                 // 元数据（页码、标题等）
  chunkIndex Int    @map("chunk_index")            // 块序号

  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@map("document_chunks")
}

// ================================
// 用户记忆模型
// ================================

model UserMemory {
  id     String @id @default(cuid())
  userId String @map("user_id")

  namespace String        // 记忆命名空间，如 "preferences", "writing_style"
  key       String        // 记忆键
  value     Json          // 记忆值
  source    MemorySource  // 记忆来源

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 关联
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, namespace, key])
  @@index([userId, namespace])
  @@map("user_memories")
}

enum MemorySource {
  USER_SET        // 用户主动设置
  AGENT_INFERRED  // Agent 自动推断
  SYSTEM          // 系统生成
}

// ================================
// 收藏模型
// ================================

model Favorite {
  id        String @id @default(cuid())
  userId    String @map("user_id")
  messageId String @unique @map("message_id")

  tags    String[] @default([])
  note    String?

  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@map("favorites")
}

// ================================
// 消息反馈模型
// ================================

model Feedback {
  id        String @id @default(cuid())
  userId    String @map("user_id")
  messageId String @unique @map("message_id")

  rating  FeedbackRating
  comment String?

  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@map("feedbacks")
}

enum FeedbackRating {
  UP
  DOWN
}

// ================================
// 管理端 RBAC 模型
// ================================

model AdminUser {
  id       String @id @default(cuid())
  username String @unique
  password String                          // bcrypt 哈希
  name     String
  email    String?

  status        AdminStatus @default(ACTIVE)
  isSystem      Boolean     @default(false) @map("is_system")
  lastLoginAt   DateTime?   @map("last_login_at")
  lastLoginIp   String?     @map("last_login_ip")
  loginFailCount Int        @default(0) @map("login_fail_count")
  lockedUntil   DateTime?   @map("locked_until")

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  // 关联
  roleAssignments AdminRoleAssignment[]
  auditLogs       AuditLog[]

  @@map("admin_users")
}

enum AdminStatus {
  ACTIVE
  DISABLED
}

model Role {
  id          String  @id @default(cuid())
  code        String  @unique
  name        String
  description String?
  isSystem    Boolean @default(false) @map("is_system")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 关联
  adminAssignments AdminRoleAssignment[]
  permissions      RolePermission[]

  @@map("roles")
}

model Permission {
  id     String @id @default(cuid())
  code   String @unique             // 如 "user:list", "system:config:update"
  name   String                     // 显示名称
  module String                     // 所属模块：system, user, content, knowledge, subscription, stats

  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  roles RolePermission[]

  @@index([module])
  @@map("permissions")
}

// 管理员-角色 多对多关联表
model AdminRoleAssignment {
  id      String @id @default(cuid())
  adminId String @map("admin_id")
  roleId  String @map("role_id")

  createdAt DateTime @default(now()) @map("created_at")

  admin AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)
  role  Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([adminId, roleId])
  @@map("admin_role_assignments")
}

// 角色-权限 多对多关联表
model RolePermission {
  id           String @id @default(cuid())
  roleId       String @map("role_id")
  permissionId String @map("permission_id")

  createdAt DateTime @default(now()) @map("created_at")

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

// ================================
// 操作审计日志
// ================================

model AuditLog {
  id       String @id @default(cuid())
  adminId  String @map("admin_id")

  action       String    // HTTP 方法：GET, POST, PATCH, DELETE
  module       String    // 操作模块：user, content, system, role...
  resource     String?   // 目标资源 ID
  resourceType String?   @map("resource_type")  // 资源类型
  description  String?   // 操作描述
  changes      Json?     // 变更前后对比 {before: {...}, after: {...}}

  ip        String?
  userAgent String? @map("user_agent")

  createdAt DateTime @default(now()) @map("created_at")

  admin AdminUser @relation(fields: [adminId], references: [id])

  @@index([adminId, createdAt(sort: Desc)])
  @@index([module, createdAt(sort: Desc)])
  @@index([resource])
  @@map("audit_logs")
}

// ================================
// 系统配置
// ================================

model SystemConfig {
  id    String @id @default(cuid())
  key   String @unique      // 配置键，如 "quota.free.dailyChatLimit"
  value Json                // 配置值
  label String?             // 配置显示名称
  group String              // 配置分组：ai, quota, content_safety, announcement

  updatedAt DateTime @updatedAt @map("updated_at")
  updatedBy String?  @map("updated_by")  // 最后修改的管理员 ID

  @@index([group])
  @@map("system_configs")
}

// ================================
// 用户配额覆盖
// ================================

model UserQuotaOverride {
  id     String @id @default(cuid())
  userId String @unique @map("user_id")

  dailyChatLimit   Int? @map("daily_chat_limit")
  dailySearchLimit Int? @map("daily_search_limit")
  kbLimit          Int? @map("kb_limit")
  docPerKbLimit    Int? @map("doc_per_kb_limit")
  ratePerMinute    Int? @map("rate_per_minute")

  reason    String?
  expiresAt DateTime? @map("expires_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String?  @map("created_by")  // 操作管理员 ID

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_quota_overrides")
}

// ================================
// 内容审核标记
// ================================

model ContentFlag {
  id        String @id @default(cuid())
  messageId String @map("message_id")
  threadId  String @map("thread_id")
  userId    String @map("user_id")

  // 自动审核信息
  autoCategory   FlagCategory? @map("auto_category")
  autoConfidence Float?        @map("auto_confidence")

  // 人工审核信息
  status     ModerationStatus @default(PENDING)
  reviewedBy String?          @map("reviewed_by")  // 审核管理员 ID
  reviewedAt DateTime?        @map("reviewed_at")
  action     ModerationAction? // 处理动作
  note       String?

  createdAt DateTime @default(now()) @map("created_at")

  @@index([status, createdAt(sort: Desc)])
  @@index([userId])
  @@index([messageId])
  @@map("content_flags")
}

enum FlagCategory {
  PORNOGRAPHY
  VIOLENCE
  FRAUD
  SENSITIVE
  SPAM
  OTHER
}

enum ModerationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ModerationAction {
  APPROVE
  DELETE_ONLY
  DELETE_AND_WARN
  DELETE_AND_DISABLE
}

// ================================
// Agent Checkpointer 表
// LangGraph PostgresSaver 会自动创建，这里标注说明
// ================================

// 由 PostgresSaver 自动管理的表：
// - checkpoints        (Agent 状态快照)
// - checkpoint_writes  (Agent 状态写入)
// - checkpoint_blobs   (Agent 状态二进制数据)
// 无需在 Prisma 中定义，由 LangGraph 管理
```

---

## Redis 数据结构

```
Redis 用途及 Key 设计：

=== 用户端 ===

1. 短信验证码
   Key:   sms:verify:{phone}
   Value: {code}
   TTL:   300s (5分钟)

2. 用户 Token 黑名单（登出时加入）
   Key:   token:blacklist:{jti}
   Value: 1
   TTL:   与 token 剩余有效期一致

3. 速率限制
   Key:   rate:chat:{userId}:{date}
   Value: 计数器 (INCR)
   TTL:   86400s (1天)

   Key:   rate:chat:{userId}:minute
   Value: 计数器 (INCR)
   TTL:   60s

   Key:   rate:sms:{phone}:{date}
   Value: 计数器
   TTL:   86400s

4. 用户会话缓存
   Key:   session:{userId}:active_thread
   Value: {threadId}
   TTL:   3600s (1小时)

5. 文档处理任务状态
   Key:   doc:processing:{docId}
   Value: {status, progress, error}
   TTL:   86400s

6. 流式消息缓冲（用于小程序轮询降级）
   Key:   stream:buffer:{messageId}
   Value: List (RPUSH 追加 token)
   TTL:   300s (5分钟)

=== 管理端 (Admin) ===

7. 管理员权限缓存
   Key:   admin:permissions:{adminId}
   Value: JSON 权限码数组 ["user:list", "user:detail", ...]
   TTL:   600s (10分钟)
   失效：角色变更、权限变更时主动清除

8. 管理员 Token 黑名单
   Key:   admin:token:blacklist:{jti}
   Value: 1
   TTL:   与 token 剩余有效期一致

9. 管理员登录失败计数
   Key:   admin:login:fail:{username}
   Value: 计数器 (INCR)
   TTL:   1800s (30分钟，即锁定时间)

10. 管理员活跃 session（强制单设备在线）
    Key:   admin:session:{adminId}
    Value: {jti} (当前有效 Token 的 jti)
    TTL:   7200s (与 access_token 有效期一致)

11. 系统配置缓存
    Key:   config:{group}        # 如 config:quota, config:ai
    Value: JSON 配置对象
    TTL:   无过期（通过 Pub/Sub 更新）

12. 系统配置变更通知（Pub/Sub）
    Channel: config:changed
    Message: {group, key, value, updatedBy, timestamp}

13. 用户配额覆盖缓存
    Key:   user:quota:{userId}
    Value: JSON 配额覆盖对象
    TTL:   3600s (1小时)
    失效：管理员修改配额时主动清除
```

---

## 向量数据库索引

```sql
-- pgvector 扩展安装
CREATE EXTENSION IF NOT EXISTS vector;

-- 在 document_chunks 表上创建向量索引
-- 使用 HNSW 索引，适合中等规模数据，查询速度快
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RAG 检索 SQL 示例
SELECT
  dc.id,
  dc.content,
  dc.metadata,
  d.name as document_name,
  1 - (dc.embedding <=> $1::vector) as similarity
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.knowledge_base_id = ANY($2::text[])
  AND d.status = 'READY'
  AND 1 - (dc.embedding <=> $1::vector) > 0.75
ORDER BY dc.embedding <=> $1::vector
LIMIT 5;
```

---

## RBAC 初始种子数据

```
数据库初始化时自动插入的种子数据（prisma/seed.ts）：

1. 权限数据（Permission 表）
   ├─ system:admin:list / create / update / delete
   ├─ system:role:list / create / update / delete
   ├─ system:config:view / update
   ├─ system:audit:view
   ├─ user:list / detail / update / disable / delete
   ├─ user:tier:update / usage:view / usage:reset
   ├─ content:thread:list / detail / delete
   ├─ content:message:view / delete / flag
   ├─ knowledge:kb:list / detail / delete
   ├─ knowledge:doc:list / delete
   ├─ subscription:plan:list / update
   ├─ subscription:order:list / refund
   └─ stats:dashboard:view / user:view / usage:view / revenue:view
   共计 35 条权限记录

2. 预置角色（Role 表）
   ├─ super_admin    → 权限: * (全部)
   ├─ ops_admin      → 权限: user:*, content:*, stats:*, subscription:order:list
   ├─ content_moderator → 权限: content:*, user:list, user:detail, user:disable
   ├─ customer_service  → 权限: user:list, user:detail, user:usage:view, content:thread:list, content:message:view
   └─ data_analyst      → 权限: stats:*

3. 初始超级管理员（AdminUser 表）
   ├─ username: admin
   ├─ password: (bcrypt 哈希，初始密码需首次登录后修改)
   ├─ name: 系统管理员
   ├─ roles: [super_admin]
   └─ isSystem: true (不可删除)

4. 默认系统配置（SystemConfig 表）
   ├─ ai.defaultModel: "openai:gpt-4o"
   ├─ ai.availableModels: ["openai:gpt-4o", "openai:gpt-4o-mini", ...]
   ├─ quota.free.dailyChatLimit: 30
   ├─ quota.free.dailySearchLimit: 10
   ├─ quota.free.kbLimit: 1
   ├─ quota.pro.dailyChatLimit: -1
   ├─ quota.pro.kbLimit: 10
   ├─ content_safety.enableAutoFilter: true
   ├─ content_safety.autoBlockThreshold: 0.9
   └─ content_safety.reviewThreshold: 0.6
```

---

## 数据迁移策略

```
MVP 阶段数据迁移方案：

1. 使用 Prisma Migrate 管理 schema 变更
   - prisma migrate dev    (开发环境)
   - prisma migrate deploy (生产环境)
   - prisma db seed        (初始化 RBAC 种子数据)

2. 数据备份
   - 每日凌晨全量备份 (pg_dump)
   - WAL 实时归档到 OSS
   - 保留最近 30 天备份

3. 敏感数据处理
   - 用户手机号：数据库存完整号码，API 返回脱敏 (138****8000)
   - 微信 openId：加密存储
   - 管理员密码：bcrypt 哈希存储（saltRounds=12）
   - 对话内容：不加密（MVP），后续支持端到端加密

4. 数据生命周期
   - 免费用户对话：保留 90 天
   - Pro 用户对话：永久保留
   - 已删除数据：软删除，30 天后物理清除
   - 向量数据：随文档删除同步清除
   - 审计日志：保留 180 天，到期归档到 OSS（不删除）
   - 管理员软删除记录：永久保留（审计需要）
```
