# MVP 功能需求规格

## 功能架构总览

```
ThinkAgent MVP
├── 🔐 用户系统
│   ├── 注册/登录（手机号 + 微信）
│   ├── 个人信息管理
│   └── 订阅与付费
│
├── 💬 智能对话（核心）
│   ├── 多轮对话引擎
│   ├── 流式输出
│   ├── Agent 工具调用
│   ├── 多模态输入（文本 + 图片）
│   └── Markdown 富文本渲染
│
├── 🧠 记忆系统
│   ├── 短期记忆（会话内上下文）
│   ├── 长期记忆（用户偏好画像）
│   └── 对话历史管理
│
├── 📚 知识库
│   ├── 文档上传与解析
│   ├── 向量化存储
│   ├── RAG 检索问答
│   └── 知识库管理
│
├── 🛠 工具集
│   ├── 联网搜索
│   ├── 内容生成
│   ├── 数据分析
│   └── 可扩展工具框架
│
├── 📱 多端适配
│   ├── Web 端（React）
│   ├── 微信小程序（UniApp）
│   └── H5 移动端（UniApp）
│
└── 🛡 后台管理系统（Admin）
    ├── RBAC 权限模型（角色 + 权限 + 菜单）
    ├── 管理员账户管理
    ├── 用户管理与使用控制
    ├── 对话内容审计与监控
    ├── 知识库全局管理
    ├── 订阅与付费管理
    ├── 系统配置（模型/工具/限额）
    ├── 数据统计 Dashboard
    └── 操作审计日志
```

---

## 模块 1：用户系统

### 1.1 注册与登录

**功能描述：** 支持手机号验证码登录和微信授权登录，首次登录自动注册。

| 字段 | 规格 |
|------|------|
| 手机号登录 | 手机号 + 6 位短信验证码，60s 重发冷却 |
| 微信登录 | OAuth 2.0 授权，获取 openid + 头像昵称 |
| Token | JWT，access_token 有效期 7 天，refresh_token 30 天 |
| 安全 | 同一手机号每日最多 10 条验证码；接口限流 |

### 1.2 个人信息

| 字段 | 类型 | 必填 |
|------|------|------|
| 昵称 | string, max 20 字 | 是 |
| 头像 | URL | 否（默认头像） |
| 职业 | enum（开发者/产品经理/设计师/内容创作者/学生/其他） | 否 |
| 使用场景 | multi-select | 否 |
| AI 风格偏好 | enum（专业严谨/轻松活泼/简洁高效） | 否 |

### 1.3 订阅与付费

| 功能 | 免费版 | Pro (¥39/月) |
|------|--------|-------------|
| 每日对话次数 | 30 次 | 无限 |
| 知识库数量 | 1 个 | 10 个 |
| 单知识库文档数 | 10 个 | 100 个 |
| 长期记忆 | 不支持 | 支持 |
| 图片识别 | 5 次/天 | 无限 |
| 联网搜索 | 10 次/天 | 无限 |
| 导出功能 | 不支持 | 支持 |

---

## 模块 2：智能对话引擎（核心模块）

### 2.1 对话交互

**功能描述：** 基于 LangChain.js Agent 的多轮对话系统，支持 ReAct 推理模式。

**交互流程：**

```
用户输入
  │
  ▼
消息预处理（敏感词过滤、长度校验）
  │
  ▼
Agent 推理引擎
  ├─ 分析用户意图
  ├─ 决定是否需要工具调用
  │    ├─ 需要 → 调用工具 → 获取结果 → 继续推理
  │    └─ 不需要 → 直接生成回复
  ├─ 检索相关记忆
  ├─ 检索知识库（如果相关）
  └─ 生成最终回复
  │
  ▼
流式输出到客户端
  │
  ▼
保存对话记录 + 更新记忆
```

**Agent 配置：**

```javascript
// 核心 Agent 创建配置参考（基于 langchain-base 文档）
{
  model: "openai:gpt-4o",           // 主模型
  tools: [webSearch, docQA, contentGen, dataAnalysis],
  checkpointer: postgresSaver,       // 会话级记忆持久化
  middleware: [
    rateLimitMiddleware,             // 速率限制
    contentFilterMiddleware,         // 内容安全
    summarizationMiddleware,         // 长对话自动摘要
    userProfileMiddleware,           // 用户画像注入
  ],
  responseFormat: "markdown",        // 结构化输出
}
```

**规格要求：**

| 指标 | 要求 |
|------|------|
| 首 token 延迟 | < 1.5s (P95) |
| 流式输出速率 | > 30 tokens/s |
| 单次回复最大长度 | 4096 tokens |
| 上下文窗口 | 最近 20 轮对话 |
| 并发支持 | > 100 concurrent sessions |
| 工具调用超时 | 单工具 < 10s，总计 < 30s |

### 2.2 流式输出

**功能描述：** 实时流式返回 AI 生成内容，提供打字机效果。

- 基于 SSE (Server-Sent Events) 实现
- 支持三种流式模式（参考 langchain-base/08-streaming）：
  - `messages`：逐 token 输出文本
  - `updates`：Agent 状态更新（如"正在搜索..."）
  - `custom`：自定义进度信息

**流式事件格式：**

```typescript
interface StreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'status' | 'done' | 'error';
  data: {
    content?: string;      // token 内容
    toolName?: string;     // 工具名称
    toolResult?: string;   // 工具执行结果
    status?: string;       // 状态描述
    messageId?: string;    // 消息 ID
  };
  timestamp: number;
}
```

### 2.3 多模态输入

**功能描述：** 支持文本和图片混合输入。

| 输入类型 | 规格 |
|---------|------|
| 文本 | 最大 2000 字 |
| 图片 | JPG/PNG/WebP，最大 5MB，最多 3 张/次 |
| 文件（对话中） | PDF/Word/TXT，最大 10MB，解析后加入当次对话上下文 |

### 2.4 Markdown 渲染

**功能描述：** AI 回复支持丰富的 Markdown 格式渲染。

支持元素：
- 标题（h1-h4）
- 加粗、斜体、删除线
- 有序/无序列表
- 表格
- 代码块（语法高亮）
- 引用块
- 链接和图片
- LaTeX 数学公式
- Mermaid 图表（P1）

---

## 模块 3：记忆系统

### 3.1 短期记忆（会话级）

**功能描述：** 基于 LangChain Checkpointer 的会话级上下文记忆。

- 每个对话会话（thread）保持独立的上下文
- 自动摘要：当对话超过 20 轮时，自动生成摘要替代早期消息（summarizationMiddleware）
- 参考 `langchain-base/09-memory` 中的 Trim + Summarize 策略

```
会话消息管理策略：
- 最新 10 条消息：保持原文
- 更早的消息：自动摘要为 1 条系统消息
- 总上下文 token 预算：约 8000 tokens
```

### 3.2 长期记忆（用户级）

**功能描述：** 基于 LangChain Store 的跨会话用户画像记忆。

存储维度：

| 维度 | 示例 | 更新方式 |
|------|------|---------|
| 写作风格 | "用户偏好专业严谨的表达" | Agent 自动从对话中提取 |
| 工作领域 | "互联网产品经理，关注 AI 方向" | 用户设置 + Agent 推断 |
| 常用格式 | "PRD 喜欢用表格和流程图" | Agent 自动学习 |
| 偏好模型 | "复杂问题用 GPT-4o" | 用户设置 |
| 常问话题 | "经常询问竞品分析相关" | 自动统计 |

存储结构：

```typescript
// 基于 langchain-base Store 模式
namespace: ["users", userId, "preferences"]
key: "profile"
value: {
  writingStyle: string,
  domain: string,
  formatPreferences: string[],
  frequentTopics: string[],
  lastUpdated: Date,
}
```

### 3.3 对话历史管理

| 功能 | 描述 |
|------|------|
| 对话列表 | 按时间倒序展示，自动生成标题（取首轮对话摘要） |
| 搜索 | 全文搜索历史对话内容 |
| 收藏 | 收藏单条 AI 回复，支持标签分类 |
| 删除 | 删除单条消息或整个对话 |
| 导出 | 导出为 Markdown 文件（Pro） |

---

## 模块 4：知识库

### 4.1 文档上传与解析

**功能描述：** 用户上传文档，系统自动解析、分块、向量化。

| 文件格式 | 解析方式 | 限制 |
|---------|---------|------|
| PDF | pdf-parse 库 | 最大 20MB，200 页 |
| Word (.docx) | mammoth 库 | 最大 10MB |
| Markdown | 直接解析 | 最大 5MB |
| TXT | 直接读取 | 最大 5MB |
| URL 网页 | Cheerio 爬取 | 单页 < 100KB 文本 |

**处理流程：**

```
文件上传
  │
  ▼
格式解析 → 提取纯文本
  │
  ▼
智能分块（Chunking）
  ├─ 按段落/标题分块
  ├─ 块大小：500-1000 tokens
  └─ 块间重叠：100 tokens
  │
  ▼
向量化（Embedding）
  ├─ 模型：text-embedding-3-small
  └─ 维度：1536
  │
  ▼
存储到向量数据库
  │
  ▼
知识库状态更新为"可用"
```

### 4.2 RAG 检索问答

**功能描述：** 对话中自动判断是否需要检索知识库，检索相关段落辅助回答。

```
用户提问
  │
  ▼
Agent 判断是否需要知识库检索
  ├─ 需要 → 调用 docQA 工具
  │         ├─ 将问题向量化
  │         ├─ 在用户知识库中检索 Top-K (K=5) 相关块
  │         ├─ 相似度阈值过滤 (> 0.75)
  │         └─ 将检索结果注入 Agent 上下文
  └─ 不需要 → 直接回答
  │
  ▼
Agent 结合检索结果生成回答
  ├─ 回答中标注引用来源
  └─ 如果检索无结果，告知用户知识库中无相关内容
```

### 4.3 知识库管理界面

| 功能 | 描述 |
|------|------|
| 创建知识库 | 名称 + 描述，可选图标 |
| 文档列表 | 展示已上传文档，状态（解析中/可用/失败） |
| 删除文档 | 删除文档及其向量数据 |
| 知识库设置 | 绑定到特定对话 / 全局启用 |
| 使用统计 | 文档数、总大小、检索次数 |

---

## 模块 5：内置工具集

### 5.1 联网搜索

```typescript
// 工具定义（参考 langchain-base/06-tools）
{
  name: "web_search",
  description: "搜索互联网获取最新信息、新闻、数据。当用户询问实时信息、最新动态、需要事实验证时使用。",
  schema: z.object({
    query: z.string().describe("搜索关键词"),
    timeRange: z.enum(["day", "week", "month", "year"]).optional(),
    maxResults: z.number().default(5),
  }),
}
```

- 搜索引擎：Tavily API / SerpAPI
- 返回格式：标题 + 摘要 + 链接 + 发布时间
- 限制：免费版 10 次/天，Pro 无限

### 5.2 文档问答

```typescript
{
  name: "knowledge_base_search",
  description: "在用户的知识库中搜索相关信息。当用户询问与其上传文档相关的问题时使用。",
  schema: z.object({
    query: z.string().describe("搜索问题"),
    knowledgeBaseId: z.string().optional().describe("指定知识库 ID"),
    topK: z.number().default(5),
  }),
}
```

### 5.3 内容生成

```typescript
{
  name: "generate_content",
  description: "生成特定格式的内容，如文章、邮件、报告。当用户需要创作特定类型内容时使用。",
  schema: z.object({
    contentType: z.enum(["article", "email", "report", "social_post", "summary"]),
    topic: z.string(),
    style: z.string().optional(),
    length: z.enum(["short", "medium", "long"]).default("medium"),
    platform: z.string().optional().describe("目标平台，如小红书、公众号"),
  }),
}
```

### 5.4 数据分析

```typescript
{
  name: "analyze_data",
  description: "分析文本或表格数据，提取关键信息和趋势。",
  schema: z.object({
    data: z.string().describe("待分析的数据或文本"),
    analysisType: z.enum(["trend", "comparison", "summary", "extraction"]),
    outputFormat: z.enum(["text", "table", "chart_description"]).default("text"),
  }),
}
```

### 5.5 工具扩展框架

所有工具遵循统一接口，支持后续扩展：

```typescript
interface ThinkAgentTool {
  name: string;
  description: string;
  schema: ZodSchema;
  execute: (input: z.infer<typeof schema>, config: ToolConfig) => Promise<ToolResult>;
}

interface ToolConfig {
  context: {
    userId: string;
    sessionId: string;
    userTier: 'free' | 'pro' | 'team';
  };
  writer?: (status: string) => void;  // 流式状态推送
  store?: Store;                        // 长期记忆访问
}
```

---

## 模块 6：中间件系统

基于 `langchain-base/11-middleware` 设计，以下中间件在 MVP 中实现：

### 6.1 速率限制

```
- 免费用户：30 次/天，5 次/分钟
- Pro 用户：无日限制，20 次/分钟
- 超限返回友好提示 + 升级引导
```

### 6.2 内容安全

```
- beforeModel：过滤用户输入中的违规内容
- afterModel：校验 AI 输出，过滤敏感信息
- 使用关键词 + LLM 双重过滤策略
```

### 6.3 对话摘要

```
- 基于 summarizationMiddleware
- 触发条件：对话 token 数 > 6000
- 保留最近 5 条消息原文，其余摘要压缩
```

### 6.4 用户画像注入

```
- beforeModel 阶段读取用户长期记忆
- 将用户偏好注入系统提示词
- 实现个性化回复
```

---

## 非功能性需求

### 性能

| 指标 | 目标 |
|------|------|
| 页面加载 | < 2s (FCP) |
| API 响应（非 AI） | < 200ms (P95) |
| AI 首 token | < 1.5s (P95) |
| 文件上传处理 | < 60s (10MB PDF) |
| 并发用户 | > 500 |

### 安全

| 项目 | 措施 |
|------|------|
| 传输加密 | HTTPS + WSS |
| 数据存储 | AES-256 加密敏感数据 |
| API 认证 | JWT + Refresh Token |
| 注入防护 | 参数校验 + SQL 预编译 + Prompt 注入检测 |
| 隐私合规 | 用户数据不用于模型训练；支持数据导出和删除 |

### 可用性

| 指标 | 目标 |
|------|------|
| 系统可用性 | > 99.5% |
| 数据备份 | 每日全量 + 实时增量 |
| 错误恢复 | 对话断线重连，消息不丢失 |

---

## 模块 7：后台管理系统（Admin）

### 概述

后台管理系统是 ThinkAgent 平台的运营管控中枢，采用 **React 18 SPA**（单页面应用）独立部署，通过 RBAC（基于角色的访问控制）授权模型确保管理操作的安全性和可控性。管理员可通过后台对用户、内容、权限、系统配置进行全面管控。

**技术栈：** React 18 + React Router v6 + Ant Design 5 + Zustand + TanStack Query

**访问地址：** `https://admin.thinkagent.ai`（独立域名，仅限内部网络或 VPN 访问）

---

### 7.1 RBAC 权限模型

**功能描述：** 基于角色的访问控制（Role-Based Access Control），将权限分配给角色，再将角色分配给管理员账户，实现灵活的权限管理。

#### 权限模型结构

```
Admin（管理员）
  │
  │  N:N
  ▼
Role（角色）
  │
  │  N:N
  ▼
Permission（权限）
  │
  │  1:N
  ▼
Menu（菜单/页面）
```

#### 预置角色

| 角色 | 标识 | 描述 | 典型权限 |
|------|------|------|---------|
| 超级管理员 | super_admin | 拥有全部权限，不可删除 | 所有权限，含角色与权限管理 |
| 运营管理员 | ops_admin | 日常运营管理 | 用户管理、内容审核、数据统计 |
| 内容审核员 | content_moderator | 负责内容安全审核 | 对话审核、知识库审核 |
| 客服专员 | customer_service | 处理用户问题 | 查看用户信息、对话记录（只读） |
| 数据分析员 | data_analyst | 数据查看与分析 | Dashboard、数据统计（只读） |

#### 权限粒度设计

权限采用 **资源:操作** 的命名规范，支持细粒度控制：

```
权限树结构：

system                          # 系统管理
├── system:admin:list           # 查看管理员列表
├── system:admin:create         # 创建管理员
├── system:admin:update         # 编辑管理员
├── system:admin:delete         # 删除管理员
├── system:role:list            # 查看角色列表
├── system:role:create          # 创建角色
├── system:role:update          # 编辑角色（含权限分配）
├── system:role:delete          # 删除角色
├── system:config:view          # 查看系统配置
├── system:config:update        # 修改系统配置
└── system:audit:view           # 查看审计日志

user                            # 用户管理
├── user:list                   # 查看用户列表
├── user:detail                 # 查看用户详情
├── user:update                 # 修改用户信息
├── user:disable                # 禁用/启用用户
├── user:delete                 # 删除用户
├── user:tier:update            # 修改用户订阅等级
├── user:usage:view             # 查看用户用量
└── user:usage:reset            # 重置用户用量

content                         # 内容管理
├── content:thread:list         # 查看对话列表
├── content:thread:detail       # 查看对话详情
├── content:thread:delete       # 删除对话
├── content:message:view        # 查看消息内容
├── content:message:delete      # 删除消息
└── content:message:flag        # 标记违规消息

knowledge                       # 知识库管理
├── knowledge:kb:list           # 查看知识库列表
├── knowledge:kb:detail         # 查看知识库详情
├── knowledge:kb:delete         # 删除知识库
├── knowledge:doc:list          # 查看文档列表
└── knowledge:doc:delete        # 删除文档

subscription                    # 订阅管理
├── subscription:plan:list      # 查看套餐列表
├── subscription:plan:update    # 修改套餐配置
├── subscription:order:list     # 查看订单列表
└── subscription:order:refund   # 处理退款

stats                           # 数据统计
├── stats:dashboard:view        # 查看 Dashboard
├── stats:user:view             # 查看用户统计
├── stats:usage:view            # 查看使用量统计
└── stats:revenue:view          # 查看收入统计
```

#### 权限校验流程

```
管理员请求 Admin API
  │
  ▼
JWT Token 认证（从 Authorization Header 提取）
  │
  ▼
解析 Token 获取 adminId + roles[]
  │
  ▼
从 Redis 缓存读取该管理员的完整权限列表
  ├─ 缓存命中 → 使用缓存权限
  └─ 缓存未命中 → 查询数据库角色-权限关联 → 写入缓存（TTL: 10min）
  │
  ▼
路由级权限守卫：检查当前接口所需权限 ⊆ 管理员权限集合
  ├─ 通过 → 执行业务逻辑
  └─ 拒绝 → 返回 403 权限不足
  │
  ▼
记录操作审计日志（管理员ID、操作类型、目标资源、IP、时间）
```

**前端权限控制：**

```
前端权限控制策略（React 18 SPA）：

1. 路由级：登录后从 API 获取管理员的菜单权限列表，动态生成可访问路由
2. 菜单级：侧边栏菜单根据权限动态渲染，无权限菜单不展示
3. 按钮级：使用 <AuthButton permission="user:disable"> 组件包裹操作按钮
4. API 级：即使前端越权调用，后端仍会拦截（双重保障）
```

---

### 7.2 管理员账户管理

**功能描述：** 管理后台管理员的账户生命周期，仅超级管理员可操作。

| 功能 | 描述 |
|------|------|
| 创建管理员 | 用户名 + 密码 + 姓名 + 邮箱 + 角色分配 |
| 管理员列表 | 展示所有管理员，支持按角色筛选、状态筛选 |
| 编辑管理员 | 修改基本信息、重新分配角色 |
| 禁用/启用 | 禁用后管理员无法登录，已有 Token 立即失效 |
| 重置密码 | 超级管理员可重置其他管理员密码 |
| 删除管理员 | 软删除，保留操作日志溯源 |

**管理员登录方式：**

```
- 登录方式：用户名 + 密码（管理后台独立认证，不与前台用户系统混用）
- 密码要求：至少 8 位，包含大小写字母和数字
- 安全策略：
  ├─ 登录失败 5 次后锁定账户 30 分钟
  ├─ JWT access_token 有效期 2 小时（比用户端短）
  ├─ refresh_token 有效期 7 天
  ├─ 强制单设备在线（新登录会踢掉旧 session）
  └─ 操作敏感功能需二次确认密码
```

---

### 7.3 用户管理与使用控制

**功能描述：** 管理前台用户的全生命周期，控制用户的使用权限和行为。

#### 用户列表与查询

| 功能 | 描述 |
|------|------|
| 用户列表 | 分页展示，支持搜索（手机号/昵称/ID） |
| 高级筛选 | 按订阅等级、注册时间、活跃状态、职业筛选 |
| 用户详情 | 基本信息 + 订阅状态 + 使用统计 + 对话记录 + 知识库列表 |
| 用户画像 | 展示 Agent 推断的用户偏好、常用话题 |

#### 使用控制

| 控制项 | 描述 | 权限要求 |
|--------|------|---------|
| 禁用账户 | 暂停用户所有功能，登录时提示"账户已被禁用" | user:disable |
| 启用账户 | 恢复被禁用的用户 | user:disable |
| 修改订阅等级 | 手动升级/降级用户套餐（免费/Pro/Team） | user:tier:update |
| 延长订阅 | 手动延长用户订阅有效期 | user:tier:update |
| 重置每日用量 | 将用户当日已使用次数清零 | user:usage:reset |
| 调整用量配额 | 为特定用户设置自定义使用配额（覆盖默认值） | user:usage:reset |
| 注销账户 | 永久删除用户及所有关联数据 | user:delete |

#### 用户使用控制规则引擎

```
使用控制规则引擎：

管理员可通过后台配置全局或用户级别的使用规则：

1. 全局默认规则（system_config 表）
   ├─ free_daily_chat_limit: 30          # 免费用户每日对话次数
   ├─ free_daily_search_limit: 10        # 免费用户每日搜索次数
   ├─ free_kb_limit: 1                   # 免费用户知识库数量
   ├─ free_doc_per_kb_limit: 10          # 免费用户每个知识库文档数
   ├─ pro_rate_limit_per_minute: 20      # Pro 用户每分钟请求限制
   └─ max_upload_file_size: 20971520     # 最大上传文件大小（字节）

2. 用户级别覆盖（user_quota_overrides 表）
   ├─ 针对特定用户设置自定义配额
   ├─ 优先级高于全局默认
   └─ 支持设置过期时间（如临时提升配额）

3. 使用限制生效链路
   用户请求 → rateLimitMiddleware
     ├─ 读取用户级配额覆盖（Redis 缓存）
     ├─ 无覆盖 → 读取全局默认规则（Redis 缓存）
     ├─ 检查当前用量是否超限
     │   ├─ 未超限 → 放行
     │   └─ 超限 → 返回 429 + 升级引导
     └─ 增加计数器
```

---

### 7.4 对话内容审计与监控

**功能描述：** 监控和审计用户对话内容，发现并处理违规内容。

| 功能 | 描述 |
|------|------|
| 对话监控 | 按时间、用户、关键词查看对话列表 |
| 消息详情 | 查看完整对话上下文，包括工具调用过程 |
| 违规标记 | 标记违规消息，分类（色情/暴力/欺诈/敏感/其他） |
| 批量处理 | 批量删除违规内容、批量禁用用户 |
| 自动告警 | 内容过滤中间件自动标记的疑似违规内容，推送到审核队列 |
| 审核队列 | 待审核内容列表，审核员逐条处理（通过/删除/封禁用户） |

**自动审核与人工审核配合：**

```
contentFilterMiddleware（自动）
  │
  ├─ 明确违规 → 自动拦截，不返回给用户 → 记录到审核日志
  ├─ 疑似违规 → 正常返回，同时推入人工审核队列
  └─ 正常内容 → 放行
  │
  ▼
人工审核队列（管理后台）
  ├─ 审核通过 → 无操作
  ├─ 确认违规 → 删除内容 + 警告/禁用用户
  └─ 误判 → 标记为正常，反馈给自动审核模型优化
```

---

### 7.5 知识库全局管理

**功能描述：** 以管理员视角管理平台上所有用户的知识库。

| 功能 | 描述 |
|------|------|
| 知识库总览 | 平台所有知识库列表，按用户、状态、大小筛选 |
| 文档管理 | 查看/删除用户上传的文档 |
| 存储统计 | 总存储用量、各用户存储占比 |
| 异常处理 | 处理解析失败的文档，查看错误详情 |
| 强制删除 | 删除含违规内容的知识库 |

---

### 7.6 订阅与付费管理

**功能描述：** 管理订阅套餐、查看订单和处理退款。

| 功能 | 描述 |
|------|------|
| 套餐配置 | 编辑各等级套餐的价格、权益、限额 |
| 订单列表 | 查看所有支付订单，支持按时间、状态、金额筛选 |
| 退款处理 | 审批退款申请，执行退款操作 |
| 收入统计 | 日/周/月收入报表，订阅转化漏斗 |
| 优惠码管理 | 创建/禁用优惠码，设置折扣规则和有效期 |

---

### 7.7 系统配置

**功能描述：** 管理平台级别的系统配置，动态调整无需重启服务。

| 配置项 | 描述 | 类型 |
|--------|------|------|
| 默认 AI 模型 | 设置系统默认使用的 LLM 模型 | select |
| 模型白名单 | 配置可用的 LLM 模型列表 | multi-select |
| 工具开关 | 启用/禁用特定工具（联网搜索等） | toggle |
| 各等级使用限额 | 配置免费/Pro/Team 各等级的使用限制 | number |
| 内容安全规则 | 配置自动审核关键词、敏感词库 | textarea |
| 公告管理 | 发布系统公告，前端展示 | richtext |
| 邮件模板 | 配置各类系统通知邮件模板 | richtext |

**配置生效策略：**

```
配置修改 → 写入 PostgreSQL system_configs 表
         → 同步更新 Redis 缓存
         → 各服务实例通过 Redis Pub/Sub 接收配置变更通知
         → 热加载生效（无需重启）
```

---

### 7.8 数据统计 Dashboard

**功能描述：** 运营数据可视化看板，实时掌握平台运营状况。

| 看板模块 | 指标 |
|---------|------|
| 核心概览 | 总用户数、DAU、今日新注册、活跃对话数、今日消息量 |
| 用户趋势 | 新增用户曲线、活跃用户曲线、留存率（次日/7日/30日） |
| 使用统计 | 对话量趋势、工具调用分布、Token 消耗量、平均响应时间 |
| 收入统计 | 付费用户数、MRR（月循环收入）、ARPU、转化率 |
| 知识库统计 | 知识库总数、文档总数、总存储量、检索次数 |
| 模型消耗 | 各模型 API 调用量、Token 消耗、费用统计 |
| 告警面板 | 系统异常、错误率飙升、容量预警 |

**数据刷新策略：**

```
- 核心概览：实时（每 30s 自动刷新）
- 趋势图表：每 5 分钟缓存更新
- 收入/留存：每小时计算
- 历史报表：每日凌晨批量计算（T+1）
```

---

### 7.9 操作审计日志

**功能描述：** 记录管理员在后台的所有操作，确保可追溯、可审计。

| 记录字段 | 描述 |
|---------|------|
| 操作人 | 管理员 ID + 姓名 |
| 操作时间 | 精确到毫秒 |
| 操作类型 | 创建/更新/删除/查看/登录/登出 |
| 操作模块 | 用户管理/内容管理/系统配置/角色权限 等 |
| 目标资源 | 被操作的资源 ID 和类型 |
| 操作详情 | 变更前后数据对比（JSON diff） |
| 来源 IP | 操作者的 IP 地址 |
| User-Agent | 操作者的浏览器信息 |

**审计日志规则：**

```
- 所有写操作（POST/PUT/PATCH/DELETE）自动记录
- 敏感读操作（查看用户详情、查看对话内容）记录
- 日志保留 180 天，到期自动归档到 OSS
- 超级管理员可查看和导出审计日志
- 审计日志本身不可修改和删除（append-only）
```

---

### 7.10 后台管理系统页面结构

```
Admin SPA 页面结构：

/admin
├── /login                          # 管理员登录
├── /dashboard                      # 数据统计看板
│
├── /users                          # 用户管理
│   ├── /users/list                 # 用户列表
│   └── /users/:id                  # 用户详情（信息+对话+知识库+用量）
│
├── /content                        # 内容管理
│   ├── /content/threads            # 对话列表
│   ├── /content/threads/:id        # 对话详情（消息列表）
│   └── /content/moderation         # 审核队列
│
├── /knowledge                      # 知识库管理
│   ├── /knowledge/list             # 知识库列表
│   └── /knowledge/:id              # 知识库详情（文档列表）
│
├── /subscription                   # 订阅管理
│   ├── /subscription/plans         # 套餐配置
│   ├── /subscription/orders        # 订单列表
│   └── /subscription/coupons       # 优惠码管理
│
├── /system                         # 系统管理
│   ├── /system/admins              # 管理员管理
│   ├── /system/roles               # 角色管理（RBAC）
│   ├── /system/config              # 系统配置
│   ├── /system/announcements       # 公告管理
│   └── /system/audit-logs          # 审计日志
│
└── /profile                        # 个人设置（修改密码等）
```
