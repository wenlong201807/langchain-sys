# ThinkAgent 时序图

## 一、用户手机号登录时序图

```mermaid
sequenceDiagram
    actor User as 用户
    participant Client as 客户端(Web/小程序)
    participant API as Fastify API
    participant SMS as 短信服务(阿里云)
    participant Redis as Redis
    participant DB as PostgreSQL

    User->>Client: 输入手机号,点击发送验证码
    Client->>API: POST /v1/auth/sms/send {phone}
    API->>Redis: 检查rate:sms:{phone}:{date}
    alt 超过每日限制(10次)
        API-->>Client: 429 今日验证码次数已用完
    else 60s内已发送
        API-->>Client: 429 请60秒后重试
    else 可发送
        API->>SMS: 发送短信验证码
        SMS-->>API: 发送成功
        API->>Redis: SET sms:verify:{phone} {code} EX 300
        API->>Redis: INCR rate:sms:{phone}:{date}
        API-->>Client: 200 {expireIn: 300}
    end

    User->>Client: 输入验证码,点击登录
    Client->>API: POST /v1/auth/login/phone {phone, code}
    API->>Redis: GET sms:verify:{phone}
    alt 验证码不匹配
        API-->>Client: 400 验证码错误
    else 验证码匹配
        API->>Redis: DEL sms:verify:{phone}
        API->>DB: SELECT * FROM users WHERE phone = ?
        alt 用户不存在
            API->>DB: INSERT INTO users (phone, nickname...) VALUES (...)
            API-->>API: isNewUser = true
        else 用户已存在
            API-->>API: isNewUser = false
        end
        API->>API: 签发JWT(accessToken + refreshToken)
        API-->>Client: 200 {accessToken, refreshToken, user, isNewUser}
        alt isNewUser = true
            Client->>User: 显示首次引导页面
        else isNewUser = false
            Client->>User: 进入主应用
        end
    end
```

---

## 二、智能对话流式输出时序图

```mermaid
sequenceDiagram
    actor User as 用户
    participant Client as 客户端
    participant API as Fastify API
    participant Auth as Auth中间件
    participant RateLimit as 速率限制中间件
    participant Filter as 内容过滤中间件
    participant Agent as LangChain Agent
    participant Tool as 工具(搜索/KB)
    participant Memory as 记忆系统
    participant DB as PostgreSQL
    participant Redis as Redis

    User->>Client: 输入消息"帮我搜索AI Agent最新趋势"
    Client->>API: POST /v1/chat/threads/{threadId}/messages/stream<br/>Accept: text/event-stream

    API->>Auth: JWT Token校验
    Auth->>Redis: 检查token:blacklist:{jti}
    Auth-->>API: 认证通过,注入userId

    API->>RateLimit: 检查用量
    RateLimit->>Redis: 读取用户配额覆盖
    RateLimit->>Redis: 读取当日用量计数
    RateLimit-->>API: 未超限,放行

    API->>Filter: 输入内容安全检查(beforeModel)
    Filter-->>API: 内容安全,放行

    API->>DB: 保存用户消息到messages表
    API-->>Client: SSE: event:message_start {messageId, role:assistant}

    API->>Memory: 加载会话上下文(Checkpointer)
    Memory->>DB: 读取最近20轮消息
    API->>Memory: 加载用户长期记忆(Store)
    Memory->>DB: 读取用户偏好画像
    API->>Agent: 注入上下文+记忆+用户消息

    API-->>Client: SSE: event:status {thinking, "正在分析问题..."}

    Agent->>Agent: ReAct推理:判断需要联网搜索
    API-->>Client: SSE: event:tool_start {web_search, query:"AI Agent 2026趋势"}

    Agent->>Tool: 调用web_search工具
    Tool-->>Agent: 返回搜索结果

    API-->>Client: SSE: event:tool_end {toolCallId, result摘要}

    Agent->>Agent: 基于搜索结果生成回复

    loop 逐Token流式输出
        Agent-->>API: yield token
        API->>Filter: 输出内容安全检查(afterModel)
        API-->>Client: SSE: event:token {content: "根据"}
        API-->>Client: SSE: event:token {content: "最新的"}
        API-->>Client: SSE: event:token {content: "搜索结果"}
    end

    API->>DB: 保存AI回复到messages表
    API->>DB: 保存工具调用到tool_calls表
    API->>Memory: 更新Checkpointer状态
    API->>Memory: 提取并更新用户长期记忆
    API->>Redis: INCR rate:chat:{userId}:{date}

    API-->>Client: SSE: event:message_end {messageId, usage, finishReason}
    API-->>Client: SSE: event:done [DONE]

    Client->>User: 展示完整AI回复(Markdown渲染)
```

---

## 三、知识库文档上传与处理时序图

```mermaid
sequenceDiagram
    actor User as 用户
    participant Client as 客户端
    participant API as Fastify API
    participant OSS as 阿里云OSS
    participant Queue as BullMQ队列
    participant Worker as BullMQ Worker
    participant Embed as OpenAI Embedding
    participant DB as PostgreSQL(pgvector)

    User->>Client: 拖拽上传PDF文件
    Client->>API: POST /v1/files/upload-token {fileName, fileSize, fileType}
    API-->>Client: {uploadUrl(presigned), fileKey, accessUrl}

    Client->>OSS: PUT 直传文件到OSS(presigned URL)
    OSS-->>Client: 上传成功

    Client->>API: POST /v1/knowledge-bases/{kbId}/documents {name, fileKey}
    API->>DB: INSERT INTO documents (status=PROCESSING)
    API->>Queue: 添加任务 {docId, fileKey, kbId}
    API-->>Client: 200 {id, status:"processing"}

    Client->>User: 显示"文档解析中..."

    Queue->>Worker: 消费任务
    Worker->>OSS: 下载文件
    OSS-->>Worker: 文件内容

    Worker->>Worker: pdf-parse解析PDF提取文本
    Worker->>Worker: RecursiveCharacterTextSplitter分块<br/>(chunkSize=800, overlap=100)

    loop 批量向量化(batch=100)
        Worker->>Embed: POST /v1/embeddings {input: chunks[], model: text-embedding-3-small}
        Embed-->>Worker: {embeddings: vector[1536][]}
    end

    Worker->>DB: 批量INSERT INTO document_chunks (content, embedding, metadata)
    Worker->>DB: UPDATE documents SET status='READY', chunk_count=N

    Note over Client,DB: 客户端轮询文档状态
    Client->>API: GET /v1/knowledge-bases/{kbId}/documents
    API->>DB: SELECT * FROM documents
    API-->>Client: {status: "ready", chunkCount: 42}
    Client->>User: 显示"文档已就绪 ✓"
```

---

## 四、管理员登录与RBAC权限加载时序图

```mermaid
sequenceDiagram
    actor Admin as 管理员
    participant SPA as Admin SPA(React)
    participant API as Admin API
    participant Redis as Redis
    participant DB as PostgreSQL

    Admin->>SPA: 输入用户名+密码,点击登录
    SPA->>API: POST /admin/v1/auth/login {username, password}

    API->>Redis: GET admin:login:fail:{username}
    alt 失败次数>=5
        API-->>SPA: 423 账户已锁定,请30分钟后重试
    else 未锁定
        API->>DB: SELECT * FROM admin_users WHERE username=?
        alt 用户不存在
            API-->>SPA: 401 用户名或密码错误
        else 用户存在
            API->>API: bcrypt.compare(password, hash)
            alt 密码错误
                API->>Redis: INCR admin:login:fail:{username} EX 1800
                API-->>SPA: 401 用户名或密码错误
            else 密码正确
                API->>Redis: DEL admin:login:fail:{username}
                API->>DB: UPDATE admin_users SET last_login_at, last_login_ip
                API->>DB: 查询管理员角色关联<br/>admin_role_assignments → roles → role_permissions → permissions
                API->>API: 聚合所有权限码 permissions[]
                API->>API: 根据权限生成可访问菜单树 menus[]
                API->>Redis: SET admin:permissions:{adminId} JSON(permissions) EX 600
                API->>Redis: SET admin:session:{adminId} {jti}
                API->>API: 签发Admin JWT {adminId, roles[], jti}
                API->>DB: INSERT INTO audit_logs (login事件)
                API-->>SPA: 200 {accessToken, admin:{permissions, menus, roles}}
            end
        end
    end

    SPA->>SPA: Zustand存储Token+权限+菜单
    SPA->>SPA: 根据permissions动态生成路由表
    SPA->>SPA: 根据menus渲染侧边栏菜单
    SPA->>Admin: 显示Dashboard首页
```

---

## 五、管理员操作用户管控时序图

```mermaid
sequenceDiagram
    actor Admin as 运营管理员
    participant SPA as Admin SPA
    participant API as Admin API
    participant RBAC as RBAC中间件
    participant Audit as 审计日志
    participant Redis as Redis
    participant DB as PostgreSQL

    Admin->>SPA: 点击"禁用用户"按钮
    Note over SPA: AuthButton检查permission="user:disable"
    SPA->>API: PATCH /admin/v1/users/{userId}/status {status:"disabled", reason:"违规"}

    API->>RBAC: adminAuthMiddleware: 校验JWT
    RBAC-->>API: adminId已注入

    API->>RBAC: requirePermission("user:disable")
    RBAC->>Redis: GET admin:permissions:{adminId}
    alt 缓存未命中
        RBAC->>DB: 查询角色-权限关联
        RBAC->>Redis: SET缓存
    end
    RBAC->>RBAC: 检查permissions.includes("user:disable")
    RBAC-->>API: 权限校验通过

    API->>DB: UPDATE users SET status='DISABLED',<br/>disable_reason='违规', disabled_at=NOW()
    API->>Redis: DEL token:blacklist相关(使用户Token全部失效)
    API->>Redis: DEL session:{userId}:*

    API->>Audit: 记录审计日志
    Audit->>DB: INSERT INTO audit_logs<br/>{adminId, action:'update', module:'user',<br/>resource:userId, changes:{before:{status:'ACTIVE'}, after:{status:'DISABLED'}}}

    API-->>SPA: 200 success
    SPA->>Admin: 显示"用户已禁用"

    Note over DB,Redis: 用户端影响
    Note right of Redis: 该用户下次请求时<br/>JWT校验发现Token已失效<br/>→ 重新登录 → 检查status=DISABLED<br/>→ 返回"账户已被禁用"
```

---

## 六、系统配置热更新时序图

```mermaid
sequenceDiagram
    actor Admin as 管理员
    participant SPA as Admin SPA
    participant API as Admin API
    participant DB as PostgreSQL
    participant Redis as Redis
    participant PubSub as Redis Pub/Sub
    participant App1 as 服务实例1
    participant App2 as 服务实例2

    Admin->>SPA: 修改免费用户每日对话次数: 30→50
    SPA->>API: PATCH /admin/v1/config<br/>{quota.free.dailyChatLimit: 50}

    API->>DB: UPDATE system_configs SET value=50<br/>WHERE key='quota.free.dailyChatLimit'
    API->>Redis: SET config:quota {更新后的完整配额对象}
    API->>PubSub: PUBLISH config:changed<br/>{group:'quota', key:'dailyChatLimit', value:50}
    API->>DB: INSERT INTO audit_logs (配置变更记录)
    API-->>SPA: 200 success

    PubSub-->>App1: 收到config:changed消息
    App1->>Redis: GET config:quota
    App1->>App1: 更新内存中的配额配置

    PubSub-->>App2: 收到config:changed消息
    App2->>Redis: GET config:quota
    App2->>App2: 更新内存中的配额配置

    Note over App1,App2: 所有实例配置已同步,无需重启
```

---

## 七、内容审核处理时序图

```mermaid
sequenceDiagram
    actor User as 用户
    participant Client as 客户端
    participant API as Fastify API
    participant Filter as contentFilterMiddleware
    participant Agent as LangChain Agent
    participant DB as PostgreSQL
    participant Queue as 审核队列

    User->>Client: 发送消息
    Client->>API: POST /v1/chat/threads/{id}/messages/stream

    API->>Filter: beforeModel内容检测
    Filter->>Filter: 关键词匹配 + LLM安全分类

    alt 置信度>=0.9 明确违规
        Filter->>DB: INSERT INTO content_flags<br/>(autoCategory, autoConfidence, status='REJECTED')
        Filter-->>API: 拦截
        API-->>Client: SSE: event:error {message: "内容违规"}
    else 0.6<=置信度<0.9 疑似违规
        Filter-->>API: 放行(标记待审核)
        API->>Agent: 正常处理对话
        Agent-->>API: 生成回复
        API-->>Client: SSE: 正常流式输出
        API->>DB: INSERT INTO content_flags<br/>(autoCategory, autoConfidence, status='PENDING')
    else 置信度<0.6 正常
        Filter-->>API: 放行
        API->>Agent: 正常处理对话
        Agent-->>API: 生成回复
        API-->>Client: SSE: 正常流式输出
    end

    Note over DB,Queue: 管理后台处理审核队列

    actor Moderator as 审核员
    participant AdminSPA as Admin SPA
    participant AdminAPI as Admin API

    Moderator->>AdminSPA: 查看审核队列
    AdminSPA->>AdminAPI: GET /admin/v1/content/moderation?status=pending
    AdminAPI->>DB: SELECT * FROM content_flags WHERE status='PENDING'
    AdminAPI-->>AdminSPA: 待审核列表

    Moderator->>AdminSPA: 确认违规,选择"删除+警告"
    AdminSPA->>AdminAPI: PATCH /admin/v1/content/moderation/{id}<br/>{status:'rejected', action:'delete_and_warn'}
    AdminAPI->>DB: UPDATE content_flags SET status='REJECTED'
    AdminAPI->>DB: DELETE FROM messages WHERE id=flaggedMessageId
    AdminAPI->>DB: 记录审计日志
    AdminAPI-->>AdminSPA: 处理完成
```

---

## 八、Token刷新与单设备在线时序图

```mermaid
sequenceDiagram
    participant ClientA as 客户端A(旧设备)
    participant ClientB as 客户端B(新设备)
    participant API as Fastify API
    participant Redis as Redis

    Note over ClientA: 用户在设备A已登录, jti=token_001

    ClientB->>API: POST /v1/auth/login/phone {phone, code}
    API->>API: 签发新Token, jti=token_002
    API->>Redis: SET user:session:{userId} token_002
    API-->>ClientB: {accessToken(jti=token_002)}

    Note over ClientA: 设备A继续使用
    ClientA->>API: GET /v1/users/me (Authorization: Bearer old_token)
    API->>API: 解析JWT得jti=token_001
    API->>Redis: GET user:session:{userId}
    Redis-->>API: token_002 (不等于token_001)
    API-->>ClientA: 401 Token已失效(其他设备已登录)
    ClientA->>ClientA: 跳转到登录页

    Note over API: 管理员Token同理(admin:session:{adminId})
    Note over API: 强制单设备在线保证安全性
```

---

## 九、文件上传(OSS直传)时序图

```mermaid
sequenceDiagram
    actor User as 用户
    participant Client as 客户端
    participant API as Fastify API
    participant OSS as 阿里云OSS
    participant CDN as CDN

    User->>Client: 选择文件(拖拽/点击)
    Client->>Client: 客户端校验(格式/大小)
    Client->>API: POST /v1/files/upload-token<br/>{fileName, fileSize, fileType, purpose}

    API->>API: 校验文件类型和大小是否允许
    API->>OSS: 生成PreSigned Upload URL<br/>(有效期3600s)
    OSS-->>API: presignedUrl
    API-->>Client: {uploadUrl, fileKey, accessUrl, expiresIn}

    Client->>OSS: PUT文件到presignedUrl<br/>(直传,不经过服务器)
    OSS-->>Client: 200 上传成功

    Client->>User: 显示上传成功
    Note over Client: accessUrl可直接通过CDN访问
    Client->>CDN: 使用accessUrl展示/引用文件
```

---

## 十、对话摘要自动压缩时序图

```mermaid
sequenceDiagram
    participant API as Fastify API
    participant Agent as LangChain Agent
    participant Middleware as summarizationMiddleware
    participant Memory as Checkpointer(PostgresSaver)
    participant LLM as LLM模型

    API->>Memory: 加载会话历史消息
    Memory-->>API: messages[](共25轮,50条消息)

    API->>Middleware: beforeModel阶段
    Middleware->>Middleware: 计算总Token数

    alt Token数 > 6000
        Middleware->>Middleware: 分离: 最近5轮保持原文
        Middleware->>Middleware: 收集: 前20轮需要摘要
        Middleware->>LLM: 请求摘要: "将以下对话摘要为要点..."
        LLM-->>Middleware: 对话摘要(约200 tokens)
        Middleware->>Middleware: 构建新上下文:<br/>[系统消息:摘要] + [最近5轮原文]
        Middleware-->>API: 压缩后的消息列表(约2000 tokens)
    else Token数 <= 6000
        Middleware-->>API: 原始消息列表(不压缩)
    end

    API->>Agent: 使用压缩后的上下文进行推理
    Agent-->>API: 生成回复
```
