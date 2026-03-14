# API 接口设计

## 概述

- 用户端基础 URL：`https://api.thinkagent.ai/v1`
- 管理端基础 URL：`https://admin-api.thinkagent.ai/admin/v1`
- 认证方式：Bearer Token (JWT)，用户端和管理端使用独立的 JWT Secret
- 请求格式：`Content-Type: application/json`
- 响应格式：统一 JSON 结构
- 流式接口：SSE (Server-Sent Events)

## 统一响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  code: 0;
  data: T;
  message: "success";
}

// 错误响应
interface ApiError {
  code: number;       // 业务错误码
  data: null;
  message: string;    // 错误描述
  details?: any;      // 详细错误信息（开发环境）
}

// 分页响应
interface PaginatedResponse<T> {
  code: 0;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  message: "success";
}
```

## 错误码定义

| 错误码 | HTTP Status | 含义 |
|--------|-------------|------|
| 0 | 200 | 成功 |
| 1001 | 400 | 参数校验失败 |
| 1002 | 401 | 未认证 / Token 过期 |
| 1003 | 403 | 权限不足 |
| 1004 | 404 | 资源不存在 |
| 1005 | 429 | 请求频率超限 |
| 2001 | 500 | AI 服务异常 |
| 2002 | 500 | 工具调用失败 |
| 2003 | 500 | 知识库检索失败 |
| 3001 | 402 | 免费额度已用完 |
| 3002 | 402 | 订阅已过期 |

---

## 1. 认证模块 `/auth`

### 1.1 发送验证码

```
POST /auth/sms/send

Request:
{
  "phone": "13800138000",
  "scene": "login"            // login | register | reset
}

Response:
{
  "code": 0,
  "data": {
    "expireIn": 300           // 验证码有效期（秒）
  },
  "message": "success"
}

限流：同一手机号 60s 内仅一次，每日上限 10 次
```

### 1.2 手机号登录/注册

```
POST /auth/login/phone

Request:
{
  "phone": "13800138000",
  "code": "123456"            // 短信验证码
}

Response:
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 604800,      // 7 天
    "user": {
      "id": "usr_abc123",
      "phone": "138****8000",
      "nickname": "用户abc",
      "avatar": "https://...",
      "tier": "free",
      "isNewUser": true
    }
  },
  "message": "success"
}
```

### 1.3 微信登录

```
POST /auth/login/wechat

Request:
{
  "code": "wx_oauth_code",     // 微信授权 code
  "platform": "miniprogram"    // miniprogram | h5 | web
}

Response: 同 1.2
```

### 1.4 刷新 Token

```
POST /auth/token/refresh

Request:
{
  "refreshToken": "eyJhbG..."
}

Response:
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",   // 新的 refresh token
    "expiresIn": 604800
  },
  "message": "success"
}
```

---

## 2. 对话模块 `/chat`

### 2.1 创建对话

```
POST /chat/threads

Request:
{
  "title": "新对话",             // 可选，默认自动生成
  "knowledgeBaseIds": ["kb_1"]  // 可选，关联知识库
}

Response:
{
  "code": 0,
  "data": {
    "id": "thread_abc123",
    "title": "新对话",
    "knowledgeBaseIds": ["kb_1"],
    "createdAt": "2026-03-13T10:00:00Z",
    "updatedAt": "2026-03-13T10:00:00Z"
  },
  "message": "success"
}
```

### 2.2 发送消息（流式）

这是核心接口，使用 SSE 流式返回。

```
POST /chat/threads/:threadId/messages/stream

Headers:
  Accept: text/event-stream

Request:
{
  "content": "帮我搜索一下最近AI Agent的发展趋势",
  "attachments": [               // 可选，附件
    {
      "type": "image",
      "url": "https://oss.../image.jpg"
    }
  ]
}

Response (SSE Stream):

event: message_start
data: {"messageId":"msg_abc123","role":"assistant"}

event: status
data: {"status":"thinking","message":"正在分析您的问题..."}

event: tool_start
data: {"toolName":"web_search","toolCallId":"tc_1","input":{"query":"AI Agent 2026 发展趋势"}}

event: status
data: {"status":"tool_executing","message":"正在搜索互联网..."}

event: tool_end
data: {"toolCallId":"tc_1","result":"[搜索结果摘要]"}

event: token
data: {"content":"根据"}

event: token
data: {"content":"最新的"}

event: token
data: {"content":"搜索结果"}

... (逐 token 输出)

event: message_end
data: {"messageId":"msg_abc123","usage":{"inputTokens":1250,"outputTokens":680},"finishReason":"stop"}

event: done
data: [DONE]
```

### 2.3 发送消息（非流式，降级方案）

```
POST /chat/threads/:threadId/messages

Request:
{
  "content": "你好",
  "attachments": []
}

Response:
{
  "code": 0,
  "data": {
    "id": "msg_abc123",
    "threadId": "thread_abc123",
    "role": "assistant",
    "content": "你好！我是 ThinkAgent，有什么我可以帮你的吗？",
    "toolCalls": [],
    "usage": {
      "inputTokens": 150,
      "outputTokens": 30
    },
    "createdAt": "2026-03-13T10:01:00Z"
  },
  "message": "success"
}
```

### 2.4 获取对话列表

```
GET /chat/threads?page=1&pageSize=20

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "thread_abc123",
        "title": "AI Agent 发展趋势分析",
        "lastMessage": "根据最新的搜索结果...",
        "messageCount": 12,
        "knowledgeBaseIds": ["kb_1"],
        "createdAt": "2026-03-13T10:00:00Z",
        "updatedAt": "2026-03-13T10:30:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  },
  "message": "success"
}
```

### 2.5 获取对话消息历史

```
GET /chat/threads/:threadId/messages?page=1&pageSize=50

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "msg_001",
        "role": "user",
        "content": "帮我搜索一下最近AI Agent的发展趋势",
        "attachments": [],
        "createdAt": "2026-03-13T10:00:00Z"
      },
      {
        "id": "msg_002",
        "role": "assistant",
        "content": "根据最新的搜索结果，2026年AI Agent领域有以下关键趋势...",
        "toolCalls": [
          {
            "id": "tc_1",
            "name": "web_search",
            "input": {"query": "AI Agent 2026 发展趋势"},
            "result": "..."
          }
        ],
        "createdAt": "2026-03-13T10:00:05Z"
      }
    ],
    "total": 12,
    "page": 1,
    "pageSize": 50,
    "hasMore": false
  },
  "message": "success"
}
```

### 2.6 删除对话

```
DELETE /chat/threads/:threadId

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 2.7 更新对话标题

```
PATCH /chat/threads/:threadId

Request:
{
  "title": "新标题"
}

Response:
{
  "code": 0,
  "data": {
    "id": "thread_abc123",
    "title": "新标题",
    "updatedAt": "2026-03-13T11:00:00Z"
  },
  "message": "success"
}
```

### 2.8 消息反馈

```
POST /chat/messages/:messageId/feedback

Request:
{
  "rating": "up",              // up | down
  "comment": "回答很准确"       // 可选
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 2.9 停止生成

```
POST /chat/threads/:threadId/stop

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

---

## 3. 知识库模块 `/knowledge-bases`

### 3.1 创建知识库

```
POST /knowledge-bases

Request:
{
  "name": "产品文档库",
  "description": "存放公司产品相关文档",
  "icon": "📚"                  // 可选，emoji 图标
}

Response:
{
  "code": 0,
  "data": {
    "id": "kb_abc123",
    "name": "产品文档库",
    "description": "存放公司产品相关文档",
    "icon": "📚",
    "documentCount": 0,
    "totalSize": 0,
    "status": "active",
    "createdAt": "2026-03-13T10:00:00Z"
  },
  "message": "success"
}
```

### 3.2 获取知识库列表

```
GET /knowledge-bases

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "kb_abc123",
        "name": "产品文档库",
        "description": "存放公司产品相关文档",
        "icon": "📚",
        "documentCount": 15,
        "totalSize": 10485760,    // 字节
        "status": "active",
        "createdAt": "2026-03-13T10:00:00Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  },
  "message": "success"
}
```

### 3.3 上传文档

```
POST /knowledge-bases/:kbId/documents

Content-Type: multipart/form-data

Fields:
  file: <binary>               // 文件内容
  name: "产品手册v2.pdf"        // 可选，默认取文件名

Response:
{
  "code": 0,
  "data": {
    "id": "doc_abc123",
    "knowledgeBaseId": "kb_abc123",
    "name": "产品手册v2.pdf",
    "type": "pdf",
    "size": 2097152,
    "status": "processing",     // processing | ready | failed
    "chunkCount": 0,            // 处理完后更新
    "createdAt": "2026-03-13T10:00:00Z"
  },
  "message": "success"
}
```

### 3.4 导入网页 URL

```
POST /knowledge-bases/:kbId/documents/url

Request:
{
  "url": "https://example.com/article",
  "name": "参考文章"             // 可选
}

Response: 同 3.3
```

### 3.5 获取文档列表

```
GET /knowledge-bases/:kbId/documents?page=1&pageSize=20

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "doc_abc123",
        "name": "产品手册v2.pdf",
        "type": "pdf",
        "size": 2097152,
        "status": "ready",
        "chunkCount": 42,
        "createdAt": "2026-03-13T10:00:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  },
  "message": "success"
}
```

### 3.6 删除文档

```
DELETE /knowledge-bases/:kbId/documents/:docId

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 3.7 删除知识库

```
DELETE /knowledge-bases/:kbId

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

注：会同时删除该知识库下所有文档和向量数据
```

---

## 4. 用户模块 `/users`

### 4.1 获取当前用户信息

```
GET /users/me

Response:
{
  "code": 0,
  "data": {
    "id": "usr_abc123",
    "phone": "138****8000",
    "nickname": "小鱼",
    "avatar": "https://...",
    "tier": "pro",
    "profession": "content_creator",
    "aiStylePreference": "casual",
    "subscription": {
      "plan": "pro",
      "expireAt": "2026-04-13T00:00:00Z",
      "autoRenew": true
    },
    "usage": {
      "todayChats": 15,
      "todaySearches": 8,
      "knowledgeBases": 3,
      "totalDocuments": 25
    },
    "createdAt": "2026-01-15T10:00:00Z"
  },
  "message": "success"
}
```

### 4.2 更新用户信息

```
PATCH /users/me

Request:
{
  "nickname": "小鱼儿",
  "profession": "content_creator",
  "aiStylePreference": "casual"
}

Response:
{
  "code": 0,
  "data": { ... },             // 更新后的用户信息
  "message": "success"
}
```

### 4.3 获取使用量统计

```
GET /users/me/usage?period=week

Response:
{
  "code": 0,
  "data": {
    "period": "week",
    "chatCount": 85,
    "messageCount": 320,
    "toolCallCount": 45,
    "toolBreakdown": {
      "web_search": 20,
      "knowledge_base_search": 15,
      "content_gen": 8,
      "data_analysis": 2
    },
    "tokenUsage": {
      "input": 125000,
      "output": 68000
    },
    "dailyStats": [
      {"date": "2026-03-07", "chats": 12, "messages": 45},
      {"date": "2026-03-08", "chats": 15, "messages": 52},
      ...
    ]
  },
  "message": "success"
}
```

---

## 5. 文件上传 `/files`

### 5.1 获取上传凭证

```
POST /files/upload-token

Request:
{
  "fileName": "image.jpg",
  "fileSize": 1048576,
  "fileType": "image/jpeg",
  "purpose": "chat_attachment"   // chat_attachment | knowledge_base | avatar
}

Response:
{
  "code": 0,
  "data": {
    "uploadUrl": "https://oss.../presigned-url",
    "fileKey": "uploads/usr_abc123/2026/03/13/uuid.jpg",
    "accessUrl": "https://cdn.thinkagent.ai/uploads/...",
    "expiresIn": 3600
  },
  "message": "success"
}

流程：客户端拿到 presigned URL 后直传 OSS，上传完成后用 accessUrl 引用
```

---

## 6. 收藏模块 `/favorites`

### 6.1 收藏消息

```
POST /favorites

Request:
{
  "messageId": "msg_abc123",
  "tags": ["AI", "研究"]        // 可选标签
}

Response:
{
  "code": 0,
  "data": {
    "id": "fav_abc123",
    "messageId": "msg_abc123",
    "content": "根据最新的搜索结果...",
    "tags": ["AI", "研究"],
    "createdAt": "2026-03-13T10:00:00Z"
  },
  "message": "success"
}
```

### 6.2 获取收藏列表

```
GET /favorites?page=1&pageSize=20&tag=AI

Response: PaginatedResponse<Favorite>
```

### 6.3 取消收藏

```
DELETE /favorites/:favoriteId

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

---

## WebSocket 事件（备选方案）

如 SSE 遇到兼容性问题，可使用 WebSocket 作为补充：

```
连接：wss://api.thinkagent.ai/ws?token=<accessToken>

客户端 → 服务端：
{
  "type": "chat.send",
  "data": {
    "threadId": "thread_abc123",
    "content": "你好"
  }
}

服务端 → 客户端：
{ "type": "chat.token", "data": {"content": "你"} }
{ "type": "chat.token", "data": {"content": "好"} }
{ "type": "chat.tool_start", "data": {"toolName": "web_search"} }
{ "type": "chat.tool_end", "data": {"toolCallId": "tc_1"} }
{ "type": "chat.done", "data": {"messageId": "msg_abc123"} }

心跳：
{ "type": "ping" }  →  { "type": "pong" }
间隔：30s
```

---

## 管理端 API（Admin）

管理端 API 基础 URL：`https://admin-api.thinkagent.ai/admin/v1`

所有管理端接口（除登录外）均需通过以下中间件管道：

```
请求 → adminAuthMiddleware（JWT 认证）→ requirePermission（RBAC 权限校验）→ auditLogger（审计日志）→ 业务处理
```

### 管理端错误码补充

| 错误码 | HTTP Status | 含义 |
|--------|-------------|------|
| 4001 | 401 | 管理员未认证 / Token 过期 |
| 4002 | 403 | 管理员权限不足 |
| 4003 | 423 | 账户已被锁定（登录失败过多） |
| 4004 | 400 | 密码强度不足 |
| 4005 | 409 | 用户名已存在 |

---

## 7. 管理员认证 `/admin/v1/auth`

### 7.1 管理员登录

```
POST /admin/v1/auth/login

Request:
{
  "username": "admin",
  "password": "Admin@123456"
}

Response:
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 7200,
    "admin": {
      "id": "adm_abc123",
      "username": "admin",
      "name": "系统管理员",
      "email": "admin@thinkagent.ai",
      "roles": [
        {
          "id": "role_001",
          "code": "super_admin",
          "name": "超级管理员"
        }
      ],
      "permissions": ["*"],
      "menus": [
        {
          "key": "dashboard",
          "label": "数据看板",
          "icon": "DashboardOutlined",
          "path": "/dashboard"
        },
        {
          "key": "users",
          "label": "用户管理",
          "icon": "UserOutlined",
          "path": "/users",
          "children": [...]
        }
      ]
    }
  },
  "message": "success"
}

安全规则：
- 密码错误返回通用错误信息（不区分用户名错误还是密码错误）
- 同一账户连续失败 5 次，锁定 30 分钟
- 每次登录记录 IP、时间、User-Agent
```

### 7.2 管理员 Token 刷新

```
POST /admin/v1/auth/token/refresh

Request:
{
  "refreshToken": "eyJhbG..."
}

Response:
{
  "code": 0,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 7200
  },
  "message": "success"
}
```

### 7.3 管理员登出

```
POST /admin/v1/auth/logout

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：将当前 Token 加入黑名单，清除 Redis 中的权限缓存
```

### 7.4 修改密码

```
POST /admin/v1/auth/change-password

Request:
{
  "oldPassword": "OldPass@123",
  "newPassword": "NewPass@456"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：修改成功后所有已有 Token 失效，需重新登录
```

### 7.5 获取当前管理员信息

```
GET /admin/v1/auth/me

Response:
{
  "code": 0,
  "data": {
    "id": "adm_abc123",
    "username": "admin",
    "name": "系统管理员",
    "email": "admin@thinkagent.ai",
    "roles": [...],
    "permissions": [...],
    "menus": [...],
    "lastLoginAt": "2026-03-14T08:00:00Z",
    "lastLoginIp": "192.168.1.100"
  },
  "message": "success"
}
```

---

## 8. 管理员管理 `/admin/v1/admins`

**所需权限前缀：** `system:admin:*`

### 8.1 获取管理员列表

```
GET /admin/v1/admins?page=1&pageSize=20&roleId=role_001&status=active

权限：system:admin:list

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "adm_abc123",
        "username": "admin",
        "name": "系统管理员",
        "email": "admin@thinkagent.ai",
        "status": "active",
        "roles": [
          {"id": "role_001", "code": "super_admin", "name": "超级管理员"}
        ],
        "lastLoginAt": "2026-03-14T08:00:00Z",
        "createdAt": "2026-01-01T00:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  },
  "message": "success"
}
```

### 8.2 创建管理员

```
POST /admin/v1/admins

权限：system:admin:create

Request:
{
  "username": "ops_admin_zhang",
  "password": "InitPass@123",
  "name": "张运营",
  "email": "zhang@thinkagent.ai",
  "roleIds": ["role_002"]
}

Response:
{
  "code": 0,
  "data": {
    "id": "adm_def456",
    "username": "ops_admin_zhang",
    "name": "张运营",
    "email": "zhang@thinkagent.ai",
    "status": "active",
    "roles": [
      {"id": "role_002", "code": "ops_admin", "name": "运营管理员"}
    ],
    "createdAt": "2026-03-14T10:00:00Z"
  },
  "message": "success"
}
```

### 8.3 更新管理员

```
PATCH /admin/v1/admins/:adminId

权限：system:admin:update

Request:
{
  "name": "张运营（高级）",
  "email": "zhang-senior@thinkagent.ai",
  "roleIds": ["role_002", "role_005"]
}

Response:
{
  "code": 0,
  "data": { ... },
  "message": "success"
}

说明：角色变更后自动清除该管理员的权限缓存
```

### 8.4 禁用/启用管理员

```
PATCH /admin/v1/admins/:adminId/status

权限：system:admin:update

Request:
{
  "status": "disabled"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：禁用后立即失效其所有 Token
```

### 8.5 重置管理员密码

```
POST /admin/v1/admins/:adminId/reset-password

权限：system:admin:update

Request:
{
  "newPassword": "ResetPass@789"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 8.6 删除管理员

```
DELETE /admin/v1/admins/:adminId

权限：system:admin:delete

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：软删除，不可删除超级管理员，不可删除自己
```

---

## 9. 角色权限管理 `/admin/v1/roles`

**所需权限前缀：** `system:role:*`

### 9.1 获取角色列表

```
GET /admin/v1/roles

权限：system:role:list

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "role_001",
        "code": "super_admin",
        "name": "超级管理员",
        "description": "拥有全部权限，不可删除",
        "isSystem": true,
        "adminCount": 1,
        "permissions": ["*"],
        "createdAt": "2026-01-01T00:00:00Z"
      },
      {
        "id": "role_002",
        "code": "ops_admin",
        "name": "运营管理员",
        "description": "日常运营管理",
        "isSystem": true,
        "adminCount": 3,
        "permissions": ["user:list", "user:detail", "user:update", "user:disable", "content:thread:list", "content:message:view", "stats:dashboard:view"],
        "createdAt": "2026-01-01T00:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  },
  "message": "success"
}
```

### 9.2 获取所有权限树

```
GET /admin/v1/roles/permissions/tree

权限：system:role:list

Response:
{
  "code": 0,
  "data": [
    {
      "module": "system",
      "label": "系统管理",
      "permissions": [
        {"code": "system:admin:list", "label": "查看管理员列表"},
        {"code": "system:admin:create", "label": "创建管理员"},
        {"code": "system:admin:update", "label": "编辑管理员"},
        {"code": "system:admin:delete", "label": "删除管理员"},
        {"code": "system:role:list", "label": "查看角色列表"},
        {"code": "system:role:create", "label": "创建角色"},
        {"code": "system:role:update", "label": "编辑角色"},
        {"code": "system:role:delete", "label": "删除角色"},
        {"code": "system:config:view", "label": "查看系统配置"},
        {"code": "system:config:update", "label": "修改系统配置"},
        {"code": "system:audit:view", "label": "查看审计日志"}
      ]
    },
    {
      "module": "user",
      "label": "用户管理",
      "permissions": [
        {"code": "user:list", "label": "查看用户列表"},
        {"code": "user:detail", "label": "查看用户详情"},
        {"code": "user:update", "label": "修改用户信息"},
        {"code": "user:disable", "label": "禁用/启用用户"},
        {"code": "user:delete", "label": "删除用户"},
        {"code": "user:tier:update", "label": "修改订阅等级"},
        {"code": "user:usage:view", "label": "查看用户用量"},
        {"code": "user:usage:reset", "label": "重置用户用量"}
      ]
    }
  ],
  "message": "success"
}
```

### 9.3 创建角色

```
POST /admin/v1/roles

权限：system:role:create

Request:
{
  "code": "content_reviewer",
  "name": "内容审核组长",
  "description": "负责内容审核和用户管理",
  "permissionCodes": [
    "user:list", "user:detail",
    "content:thread:list", "content:thread:detail",
    "content:message:view", "content:message:delete", "content:message:flag"
  ]
}

Response:
{
  "code": 0,
  "data": {
    "id": "role_006",
    "code": "content_reviewer",
    "name": "内容审核组长",
    "description": "负责内容审核和用户管理",
    "isSystem": false,
    "permissions": [...],
    "createdAt": "2026-03-14T10:00:00Z"
  },
  "message": "success"
}
```

### 9.4 更新角色（含权限分配）

```
PUT /admin/v1/roles/:roleId

权限：system:role:update

Request:
{
  "name": "高级内容审核",
  "description": "负责内容审核、用户管理和知识库管理",
  "permissionCodes": [
    "user:list", "user:detail", "user:disable",
    "content:thread:list", "content:thread:detail", "content:thread:delete",
    "content:message:view", "content:message:delete", "content:message:flag",
    "knowledge:kb:list", "knowledge:doc:list", "knowledge:doc:delete"
  ]
}

Response:
{
  "code": 0,
  "data": { ... },
  "message": "success"
}

说明：更新角色权限后，自动清除所有拥有此角色管理员的权限缓存
```

### 9.5 删除角色

```
DELETE /admin/v1/roles/:roleId

权限：system:role:delete

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：系统预置角色（isSystem=true）不可删除；有管理员绑定的角色需先解绑
```

---

## 10. 用户管理 `/admin/v1/users`

**所需权限前缀：** `user:*`

### 10.1 获取用户列表

```
GET /admin/v1/users?page=1&pageSize=20&keyword=138&tier=pro&status=active&sortBy=createdAt&sortOrder=desc

权限：user:list

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "usr_abc123",
        "phone": "138****8000",
        "nickname": "小鱼",
        "avatar": "https://...",
        "tier": "pro",
        "profession": "content_creator",
        "status": "active",
        "todayChatCount": 15,
        "totalChatCount": 850,
        "knowledgeBaseCount": 3,
        "lastActiveAt": "2026-03-14T09:30:00Z",
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ],
    "total": 1250,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  },
  "message": "success"
}
```

### 10.2 获取用户详情

```
GET /admin/v1/users/:userId

权限：user:detail

Response:
{
  "code": 0,
  "data": {
    "basic": {
      "id": "usr_abc123",
      "phone": "13800138000",
      "nickname": "小鱼",
      "avatar": "https://...",
      "tier": "pro",
      "profession": "content_creator",
      "aiStylePreference": "casual",
      "status": "active",
      "createdAt": "2026-01-15T10:00:00Z"
    },
    "subscription": {
      "plan": "pro",
      "expireAt": "2026-04-15T00:00:00Z",
      "autoRenew": true,
      "totalPaid": 11700
    },
    "usage": {
      "todayChatCount": 15,
      "todaySearchCount": 8,
      "totalChatCount": 850,
      "totalMessageCount": 3200,
      "totalTokenUsage": { "input": 2500000, "output": 1200000 },
      "knowledgeBaseCount": 3,
      "totalDocuments": 25,
      "totalStorageBytes": 52428800
    },
    "quotaOverride": {
      "dailyChatLimit": null,
      "dailySearchLimit": null,
      "kbLimit": null,
      "expiresAt": null
    },
    "recentThreads": [
      {
        "id": "thread_001",
        "title": "AI Agent 发展趋势",
        "messageCount": 12,
        "updatedAt": "2026-03-14T09:30:00Z"
      }
    ],
    "memories": [
      {
        "namespace": "preferences",
        "key": "writing_style",
        "value": "轻松活泼，偏口语化",
        "source": "AGENT_INFERRED"
      }
    ]
  },
  "message": "success"
}
```

### 10.3 禁用/启用用户

```
PATCH /admin/v1/users/:userId/status

权限：user:disable

Request:
{
  "status": "disabled",
  "reason": "违规内容发布"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：禁用后用户端 Token 立即失效，登录时返回封禁提示和原因
```

### 10.4 修改用户订阅等级

```
PATCH /admin/v1/users/:userId/tier

权限：user:tier:update

Request:
{
  "tier": "pro",
  "expireAt": "2026-06-14T00:00:00Z",
  "reason": "活动赠送"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 10.5 设置用户配额覆盖

```
PUT /admin/v1/users/:userId/quota-override

权限：user:usage:reset

Request:
{
  "dailyChatLimit": 100,
  "dailySearchLimit": 50,
  "kbLimit": 5,
  "expiresAt": "2026-04-14T00:00:00Z"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：设置后立即生效（清除 Redis 中该用户的配额缓存）
      expiresAt 到期后自动恢复默认配额
      传 null 值可清除对应的覆盖项
```

### 10.6 重置用户每日用量

```
POST /admin/v1/users/:userId/usage/reset

权限：user:usage:reset

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：将用户当日对话次数、搜索次数等计数器清零
```

### 10.7 删除用户

```
DELETE /admin/v1/users/:userId

权限：user:delete

Request:
{
  "confirmPassword": "Admin@123456"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：永久删除用户及所有关联数据（对话、知识库、记忆等）
      需要管理员输入自己的密码二次确认
      此操作不可逆，审计日志会详细记录
```

---

## 11. 内容管理 `/admin/v1/content`

**所需权限前缀：** `content:*`

### 11.1 获取对话列表（全局）

```
GET /admin/v1/content/threads?page=1&pageSize=20&userId=usr_abc123&keyword=AI&startDate=2026-03-01&endDate=2026-03-14

权限：content:thread:list

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "thread_abc123",
        "userId": "usr_abc123",
        "userName": "小鱼",
        "title": "AI Agent 发展趋势",
        "messageCount": 12,
        "hasToolCalls": true,
        "hasFlaggedContent": false,
        "createdAt": "2026-03-13T10:00:00Z",
        "updatedAt": "2026-03-14T09:30:00Z"
      }
    ],
    "total": 8500,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  },
  "message": "success"
}
```

### 11.2 获取对话消息详情

```
GET /admin/v1/content/threads/:threadId/messages?page=1&pageSize=50

权限：content:message:view

Response:
{
  "code": 0,
  "data": {
    "thread": {
      "id": "thread_abc123",
      "userId": "usr_abc123",
      "userName": "小鱼",
      "title": "AI Agent 发展趋势"
    },
    "messages": {
      "items": [
        {
          "id": "msg_001",
          "role": "user",
          "content": "帮我搜索一下最近AI Agent的发展趋势",
          "isFlagged": false,
          "createdAt": "2026-03-13T10:00:00Z"
        },
        {
          "id": "msg_002",
          "role": "assistant",
          "content": "根据最新的搜索结果...",
          "toolCalls": [...],
          "tokenUsage": {"input": 1250, "output": 680},
          "isFlagged": false,
          "createdAt": "2026-03-13T10:00:05Z"
        }
      ],
      "total": 12,
      "page": 1,
      "pageSize": 50,
      "hasMore": false
    }
  },
  "message": "success"
}
```

### 11.3 标记违规消息

```
POST /admin/v1/content/messages/:messageId/flag

权限：content:message:flag

Request:
{
  "category": "sensitive",
  "note": "涉及敏感政治话题"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

category 枚举：pornography | violence | fraud | sensitive | spam | other
```

### 11.4 删除消息

```
DELETE /admin/v1/content/messages/:messageId

权限：content:message:delete

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 11.5 获取审核队列

```
GET /admin/v1/content/moderation?page=1&pageSize=20&status=pending

权限：content:message:flag

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "mod_abc123",
        "messageId": "msg_xyz",
        "threadId": "thread_abc",
        "userId": "usr_abc",
        "userName": "某用户",
        "content": "疑似违规内容...",
        "autoCategory": "sensitive",
        "autoConfidence": 0.72,
        "status": "pending",
        "createdAt": "2026-03-14T09:00:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  },
  "message": "success"
}

status 枚举：pending | approved | rejected
```

### 11.6 处理审核项

```
PATCH /admin/v1/content/moderation/:moderationId

权限：content:message:flag

Request:
{
  "status": "rejected",
  "action": "delete_and_warn",
  "note": "确认违规，已删除内容并警告用户"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

action 枚举：
- approve: 审核通过
- delete_only: 仅删除内容
- delete_and_warn: 删除内容 + 警告用户
- delete_and_disable: 删除内容 + 禁用用户
```

---

## 12. 知识库管理 `/admin/v1/knowledge`

**所需权限前缀：** `knowledge:*`

### 12.1 获取全局知识库列表

```
GET /admin/v1/knowledge/bases?page=1&pageSize=20&userId=usr_abc123&status=active

权限：knowledge:kb:list

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "kb_abc123",
        "userId": "usr_abc123",
        "userName": "小鱼",
        "name": "产品文档库",
        "documentCount": 15,
        "totalSize": 52428800,
        "status": "active",
        "createdAt": "2026-02-01T10:00:00Z"
      }
    ],
    "total": 320,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  },
  "message": "success"
}
```

### 12.2 删除知识库

```
DELETE /admin/v1/knowledge/bases/:kbId

权限：knowledge:kb:delete

Request:
{
  "reason": "包含违规内容"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### 12.3 获取存储统计

```
GET /admin/v1/knowledge/storage-stats

权限：knowledge:kb:list

Response:
{
  "code": 0,
  "data": {
    "totalKnowledgeBases": 320,
    "totalDocuments": 4500,
    "totalStorageBytes": 10737418240,
    "totalChunks": 125000,
    "failedDocuments": 12,
    "topUsers": [
      {"userId": "usr_abc", "userName": "小鱼", "storageBytes": 524288000, "documentCount": 45}
    ]
  },
  "message": "success"
}
```

---

## 13. 系统配置 `/admin/v1/config`

**所需权限前缀：** `system:config:*`

### 13.1 获取系统配置

```
GET /admin/v1/config

权限：system:config:view

Response:
{
  "code": 0,
  "data": {
    "ai": {
      "defaultModel": "openai:gpt-4o",
      "availableModels": ["openai:gpt-4o", "openai:gpt-4o-mini", "anthropic:claude-3.5-sonnet"],
      "enabledTools": ["web_search", "knowledge_base_search", "generate_content", "analyze_data"]
    },
    "quota": {
      "free": {
        "dailyChatLimit": 30,
        "dailySearchLimit": 10,
        "kbLimit": 1,
        "docPerKbLimit": 10,
        "ratePerMinute": 5,
        "maxUploadSizeMB": 10,
        "dailyImageLimit": 5
      },
      "pro": {
        "dailyChatLimit": -1,
        "dailySearchLimit": -1,
        "kbLimit": 10,
        "docPerKbLimit": 100,
        "ratePerMinute": 20,
        "maxUploadSizeMB": 20,
        "dailyImageLimit": -1
      }
    },
    "content_safety": {
      "enableAutoFilter": true,
      "sensitiveWords": ["..."],
      "autoBlockThreshold": 0.9,
      "reviewThreshold": 0.6
    },
    "announcement": {
      "enabled": false,
      "content": "",
      "type": "info"
    }
  },
  "message": "success"
}
```

### 13.2 更新系统配置

```
PATCH /admin/v1/config

权限：system:config:update

Request:
{
  "quota.free.dailyChatLimit": 50,
  "content_safety.sensitiveWords": ["新增敏感词1", "新增敏感词2"],
  "announcement.enabled": true,
  "announcement.content": "系统将于今晚 22:00 进行维护升级"
}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}

说明：
- 使用点号路径更新嵌套配置
- 变更自动写入 PostgreSQL 并同步 Redis 缓存
- 通过 Redis Pub/Sub 通知各服务实例热加载
```

---

## 14. 数据统计 `/admin/v1/stats`

**所需权限前缀：** `stats:*`

### 14.1 Dashboard 核心指标

```
GET /admin/v1/stats/dashboard

权限：stats:dashboard:view

Response:
{
  "code": 0,
  "data": {
    "overview": {
      "totalUsers": 12500,
      "dau": 1850,
      "todayNewUsers": 65,
      "activeThreads": 420,
      "todayMessages": 8500,
      "todayTokenUsage": {"input": 15000000, "output": 7200000}
    },
    "subscription": {
      "freeUsers": 11000,
      "proUsers": 1350,
      "teamUsers": 150,
      "mrr": 68550,
      "conversionRate": 0.12
    },
    "system": {
      "cpuUsage": 45,
      "memoryUsage": 62,
      "apiErrorRate": 0.003,
      "avgResponseTime": 1200,
      "activeAlerts": 0
    }
  },
  "message": "success"
}
```

### 14.2 用户趋势统计

```
GET /admin/v1/stats/users/trend?period=30d&metrics=new,active,retention

权限：stats:user:view

Response:
{
  "code": 0,
  "data": {
    "period": "30d",
    "dailyStats": [
      {
        "date": "2026-02-13",
        "newUsers": 42,
        "activeUsers": 1650,
        "retention": {
          "d1": 0.45,
          "d7": 0.22,
          "d30": 0.12
        }
      }
    ]
  },
  "message": "success"
}
```

### 14.3 使用量统计

```
GET /admin/v1/stats/usage?period=7d

权限：stats:usage:view

Response:
{
  "code": 0,
  "data": {
    "period": "7d",
    "totals": {
      "chatCount": 15600,
      "messageCount": 58000,
      "toolCallCount": 12000,
      "tokenUsage": {"input": 95000000, "output": 42000000}
    },
    "toolBreakdown": {
      "web_search": 5200,
      "knowledge_base_search": 3800,
      "generate_content": 2100,
      "analyze_data": 900
    },
    "modelBreakdown": {
      "openai:gpt-4o": {"calls": 8500, "tokens": 85000000, "estimatedCost": 425},
      "openai:gpt-4o-mini": {"calls": 7100, "tokens": 52000000, "estimatedCost": 52}
    },
    "dailyStats": [...]
  },
  "message": "success"
}
```

### 14.4 收入统计

```
GET /admin/v1/stats/revenue?period=30d

权限：stats:revenue:view

Response:
{
  "code": 0,
  "data": {
    "period": "30d",
    "totalRevenue": 68550,
    "newSubscriptions": 120,
    "renewals": 850,
    "cancellations": 30,
    "refunds": 5,
    "arpu": 45.7,
    "dailyStats": [
      {"date": "2026-02-13", "revenue": 2350, "newSubs": 4, "renewals": 28}
    ]
  },
  "message": "success"
}
```

---

## 15. 审计日志 `/admin/v1/audit-logs`

**所需权限：** `system:audit:view`

### 15.1 获取审计日志

```
GET /admin/v1/audit-logs?page=1&pageSize=50&adminId=adm_abc123&module=user&action=update&startDate=2026-03-13&endDate=2026-03-14

权限：system:audit:view

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "audit_abc123",
        "adminId": "adm_abc123",
        "adminName": "系统管理员",
        "action": "update",
        "module": "user",
        "resource": "usr_def456",
        "resourceType": "user",
        "description": "修改用户订阅等级",
        "changes": {
          "before": {"tier": "free"},
          "after": {"tier": "pro", "expireAt": "2026-06-14T00:00:00Z"}
        },
        "ip": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2026-03-14T10:30:00Z"
      }
    ],
    "total": 1250,
    "page": 1,
    "pageSize": 50,
    "hasMore": true
  },
  "message": "success"
}
```

### 15.2 导出审计日志

```
POST /admin/v1/audit-logs/export

权限：system:audit:view

Request:
{
  "startDate": "2026-03-01",
  "endDate": "2026-03-14",
  "format": "csv"
}

Response:
{
  "code": 0,
  "data": {
    "downloadUrl": "https://oss.../audit-logs/export_20260314.csv",
    "expiresIn": 3600
  },
  "message": "success"
}

说明：大量数据异步导出，通过 BullMQ 生成文件上传 OSS
```
