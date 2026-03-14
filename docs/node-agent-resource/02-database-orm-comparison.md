# 数据库与 ORM 框架全方位对比

## 对比范围

### 数据库

- PostgreSQL vs MySQL vs SQLite

### ORM 框架

- Prisma vs TypeORM vs Sequelize vs MikroORM vs Drizzle ORM

### 评估约束

- 服务器：2 核 2.5G 内存，40G 硬盘
- 必须支持向量检索（RAG 知识库）
- 与 Fastify + LangChain.js 深度集成
- 单人可维护

---

## 一、数据库对比

### 1.1 核心能力对比

| 维度 | PostgreSQL | MySQL | SQLite |
|------|-----------|-------|--------|
| 类型 | 关系型 + 扩展 | 关系型 | 嵌入式关系型 |
| 向量检索 | pgvector 扩展（原生） | 无原生支持 | 无原生支持 |
| JSON 支持 | JSONB（二进制，可索引） | JSON（文本存储） | JSON（基础） |
| 全文搜索 | 内置 tsvector | 内置 FULLTEXT | FTS5 扩展 |
| 数组类型 | 原生支持 | 不支持 | 不支持 |
| 并发模型 | MVCC（读写不阻塞） | InnoDB MVCC | 文件锁（写锁全库） |
| 复杂查询 | CTE、窗口函数、递归查询 | 8.0 后支持 CTE/窗口 | 基础支持 |
| 扩展能力 | 丰富（pgvector/PostGIS/pg_trgm） | 有限 | 极有限 |

### 1.2 资源占用对比（2 核 2.5G 约束）

| 指标 | PostgreSQL | MySQL | SQLite |
|------|-----------|-------|--------|
| 最低内存 | ~30MB（极限调优） | ~150MB | ~0（进程内） |
| 推荐内存 | 256-512MB | 512MB-1GB | 无独立进程 |
| 空载内存 | ~25-40MB | ~200-300MB | 0（嵌入） |
| 磁盘占用（程序） | ~50MB | ~500MB | ~1MB |
| 连接开销 | ~10MB/连接 | ~1MB/连接 | 无 |

**关键调优（PostgreSQL 在 2.5G 服务器）：**

```conf
# postgresql.conf - 低内存优化
shared_buffers = 128MB          # 默认 128MB，不超过总内存 25%
effective_cache_size = 384MB    # OS 缓存估算
work_mem = 4MB                  # 每个排序操作
maintenance_work_mem = 64MB     # VACUUM 等维护操作
max_connections = 30            # 控制连接数（每连接 ~10MB）
wal_buffers = 4MB
```

**关键调优（MySQL 在 2.5G 服务器）：**

```conf
# my.cnf - 低内存优化
innodb_buffer_pool_size = 256MB  # 通常需要总内存的 50-70%
innodb_log_file_size = 48MB
max_connections = 30
key_buffer_size = 16MB
table_open_cache = 200
```

### 1.3 向量检索能力（RAG 核心需求）

| 维度 | PostgreSQL + pgvector | MySQL | SQLite |
|------|----------------------|-------|--------|
| 向量存储 | 原生 vector 类型 | 需 BLOB + 应用层 | 需外部方案 |
| 相似度搜索 | `<=>` 余弦 / `<->` L2 / `<#>` 内积 | 不支持 | 不支持 |
| 索引类型 | IVFFlat / HNSW | N/A | N/A |
| 向量维度 | 最高 2000 维 | N/A | N/A |
| 与业务数据联合查询 | 同一数据库，SQL JOIN | 需跨库 | 需跨库 |

```sql
-- pgvector RAG 检索示例
SELECT content, 1 - (embedding <=> $1::vector) AS similarity
FROM document_chunks
WHERE knowledge_base_id = ANY($2)
  AND 1 - (embedding <=> $1::vector) > 0.75
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

> **如果选 MySQL，则必须引入独立向量数据库（Pinecone/Milvus/Qdrant），增加运维复杂度和内存开销，在 2.5G 服务器上不现实。**

### 1.4 LangChain.js 生态支持

| 数据库 | LangGraph Checkpointer | 向量存储 | 社区支持 |
|--------|----------------------|---------|---------|
| PostgreSQL | `@langchain/langgraph-checkpoint-postgres` 官方 | `@langchain/community` pgvector | 一等公民 |
| MySQL | 无官方 Checkpointer | 无官方向量存储 | 不支持 |
| SQLite | `@langchain/langgraph-checkpoint-sqlite` 官方 | 无向量存储 | 开发环境用 |

### 1.5 数据库结论

> **PostgreSQL 是唯一选择。** 在 ThinkAgent 场景下：
> 1. pgvector 让 RAG 向量检索与业务数据同库，省去独立向量数据库的内存开销（节省 200-500MB）
> 2. LangGraph Checkpointer 官方支持 PostgreSQL
> 3. JSONB 类型天然适配 AI Agent 的工具调用参数和结果存储
> 4. 低内存调优后可在 128-256MB 内稳定运行
> 5. MySQL 在本场景无任何优势，且缺乏向量检索和 LangChain 官方支持

---

## 二、ORM 框架对比

### 2.1 候选框架概览

| 维度 | Prisma | TypeORM | Sequelize | MikroORM | Drizzle |
|------|--------|---------|-----------|----------|---------|
| 首发 | 2019 | 2016 | 2014 | 2018 | 2022 |
| Stars | ~42,000 | ~35,000 | ~29,500 | ~8,000 | ~28,000 |
| 周下载 | ~2,800,000 | ~2,000,000 | ~1,800,000 | ~200,000 | ~1,200,000 |
| 设计理念 | Schema-first | Entity-first (装饰器) | Model-first | Data Mapper | SQL-first |
| TypeScript | 自动生成类型 | 装饰器 + 手动类型 | 手动类型（v7 改善） | 强 TS 支持 | 原生 TS |
| 查询风格 | 链式 API（DSL） | QueryBuilder + Active Record | 链式 API | QueryBuilder + Unit of Work | SQL-like API |

### 2.2 开发体验对比

**Prisma - Schema 驱动：**

```prisma
// schema.prisma
model Thread {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  title     String
  messages  Message[]
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt(sort: Desc)])
  @@map("threads")
}
```

```typescript
// 查询 - 类型完全自动推导
const thread = await prisma.thread.findUnique({
  where: { id: threadId },
  include: { messages: { orderBy: { createdAt: 'asc' } } },
});
// thread.messages 类型自动推导为 Message[]
```

**TypeORM - 装饰器驱动：**

```typescript
@Entity('threads')
export class Thread {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @OneToMany(() => Message, msg => msg.thread)
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// 查询
const thread = await threadRepo.findOne({
  where: { id: threadId },
  relations: ['messages'],
  order: { messages: { createdAt: 'ASC' } },
});
```

**Drizzle - SQL-first：**

```typescript
// schema.ts
export const threads = pgTable('threads', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 查询 - 接近原生 SQL
const result = await db.select()
  .from(threads)
  .where(eq(threads.id, threadId))
  .leftJoin(messages, eq(messages.threadId, threads.id));
```

### 2.3 性能与资源对比

| 指标 | Prisma | TypeORM | Sequelize | MikroORM | Drizzle |
|------|--------|---------|-----------|----------|---------|
| 查询性能 | 中（Query Engine 开销） | 中 | 中 | 中高 | 高（接近原生） |
| 内存占用 | ~40-60MB（Rust Query Engine） | ~20-30MB | ~15-25MB | ~15-25MB | ~5-10MB |
| 冷启动 | ~500ms（引擎初始化） | ~200ms | ~150ms | ~200ms | ~50ms |
| 连接池 | 内置（Rust 层） | 外部（如 pg-pool） | 内置 | 内置 | 外部 |

> **关键：** Prisma 的 Rust Query Engine 是独立二进制，额外占用 ~40MB 内存。在 2.5G 服务器上这不是致命问题，但需要知晓。Drizzle 最轻量。

### 2.4 迁移（Migration）能力

| 维度 | Prisma | TypeORM | Sequelize | MikroORM | Drizzle |
|------|--------|---------|-----------|----------|---------|
| 自动生成迁移 | `prisma migrate dev` 自动 | 手动 + 自动同步 | 手动 | 自动 | `drizzle-kit` 自动 |
| 迁移文件 | SQL 文件，可读性好 | TS 文件 | JS 文件 | TS/SQL 文件 | SQL 文件 |
| 回滚 | 需手动 | 内置 | 内置 | 内置 | 需手动 |
| 生产部署 | `prisma migrate deploy` | `migration:run` | `db:migrate` | `migration:up` | `drizzle-kit push` |
| 种子数据 | `prisma db seed` | 手动 | 手动 | `seeders` | 手动 |

### 2.5 pgvector 支持

| ORM | pgvector 支持方式 | 成熟度 |
|-----|------------------|--------|
| Prisma | `Unsupported("vector(1536)")` + Raw SQL 查询 | 可用，向量查询需 `$queryRaw` |
| TypeORM | 自定义列类型 + Raw SQL | 可用，需手动实现 |
| Drizzle | `@vercel/postgres` + 自定义类型 | 可用，社区方案 |
| MikroORM | 自定义类型 + Raw SQL | 可用，需手动实现 |
| Sequelize | 自定义类型 + Raw SQL | 可用，需手动实现 |

> **所有 ORM 对 pgvector 的支持都需要 Raw SQL 做向量检索。** 差别在于日常业务 CRUD 的体验。

### 2.6 Fastify 集成

| ORM | Fastify 集成方式 | 复杂度 |
|-----|-----------------|--------|
| Prisma | `fastify-prisma-client` 或手动注册 | 低（5 行代码） |
| TypeORM | 手动初始化 DataSource | 中（20 行代码） |
| Drizzle | 手动创建 drizzle 实例 | 低（5 行代码） |
| MikroORM | `@mikro-orm/fastify` 官方插件 | 低 |
| Sequelize | 手动初始化 | 中 |

### 2.7 MidwayJS 集成（对照）

| ORM | MidwayJS 集成方式 | 复杂度 |
|-----|------------------|--------|
| Prisma | `@midwayjs/prisma` 官方组件 | 低 |
| TypeORM | `@midwayjs/typeorm` 官方深度集成 | 极低（最佳搭档） |
| Sequelize | `@midwayjs/sequelize` 官方组件 | 低 |
| Drizzle | 无官方组件，手动集成 | 中 |
| MikroORM | 无官方组件 | 中 |

> 如果选 MidwayJS，TypeORM 是最佳搭档（深度集成）。如果选 Fastify，Prisma 或 Drizzle 是最佳搭档。

---

## 三、ORM 综合评分

| 维度 | 权重 | Prisma | TypeORM | Drizzle | MikroORM | Sequelize |
|------|------|--------|---------|---------|----------|-----------|
| 类型安全 | 20% | 10 | 7 | 9 | 8 | 5 |
| 开发效率 | 20% | 9 | 7 | 7 | 7 | 7 |
| 迁移管理 | 15% | 9 | 7 | 8 | 8 | 7 |
| 性能/内存 | 15% | 7 | 7 | 10 | 8 | 7 |
| Fastify 集成 | 10% | 9 | 7 | 9 | 8 | 6 |
| 社区生态 | 10% | 9 | 8 | 8 | 6 | 8 |
| 文档质量 | 10% | 10 | 7 | 8 | 7 | 7 |
| **加权总分** | **100%** | **9.05** | **7.15** | **8.40** | **7.45** | **6.60** |

---

## 四、推荐方案

### 首选：Fastify + Prisma + PostgreSQL

| 优势 | 说明 |
|------|------|
| 类型安全 | Prisma 自动生成的类型是所有 ORM 中最强的 |
| Schema 即文档 | `schema.prisma` 文件即是数据模型文档 |
| 迁移管理 | `prisma migrate` 生产可靠 |
| 学习曲线 | 最平缓，单人全栈工程师 1 天上手 |
| 社区 | 问题必有解答 |

| 劣势 | 缓解方案 |
|------|---------|
| Rust Query Engine ~40MB | 2.5G 内存下可接受 |
| pgvector 需 Raw SQL | 封装 RAG 检索为独立 service，业务 CRUD 用 Prisma API |
| 复杂查询能力弱 | 报表/分析场景少，MVP 够用 |

### 备选：Fastify + Drizzle + PostgreSQL

| 优势 | 说明 |
|------|------|
| 极致轻量 | ~5MB 内存占用，对 2.5G 服务器最友好 |
| SQL-first | 复杂查询能力强，pgvector 更自然 |
| 性能最高 | 接近原生 SQL 性能 |

| 劣势 | 说明 |
|------|------|
| 学习曲线 | 需要 SQL 基础，关联查询不如 Prisma 直观 |
| 成熟度 | 2022 年项目，生态不如 Prisma 丰富 |

### 如果选 MidwayJS 的搭配

> MidwayJS + TypeORM + PostgreSQL（TypeORM 是 MidwayJS 的最佳搭档）

---

## 五、技术栈组合最终对比

| 组合 | 性能 | 开发效率 | 内存占用 | AI 生态 | 推荐指数 |
|------|------|---------|---------|---------|---------|
| **Fastify + Prisma + PG** | 高 | 最高 | 中 | 最佳 | ★★★★★ |
| Fastify + Drizzle + PG | 最高 | 中高 | 最低 | 好 | ★★★★☆ |
| MidwayJS + TypeORM + PG | 中 | 高 | 高 | 差 | ★★★☆☆ |
| MidwayJS + Prisma + PG | 中 | 高 | 高 | 中 | ★★★☆☆ |
| Fastify + TypeORM + PG | 高 | 中 | 中 | 好 | ★★★☆☆ |
| 任何 + MySQL | - | - | - | 不支持 | ✗ |
