# 多平台接入资源必备清单（测试环境）

## 概述

ThinkAgent 需要对接 6 个外部平台，每个平台都需要提前准备账号、资质、密钥和测试环境配置。本文档给出**测试环境下**的完整资源清单。

---

## 一、微信小程序

### 1.1 注册与准备

| 资源项 | 详细说明 | 获取方式 | 必须/可选 |
|--------|---------|---------|----------|
| 微信小程序账号 | 企业主体或个人主体均可（个人不支持支付） | [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册 | 必须 |
| AppID | 小程序唯一标识 | 小程序后台 → 开发管理 → 开发设置 | 必须 |
| AppSecret | 小程序密钥 | 同上（注意保密，仅服务端使用） | 必须 |
| 测试号 AppID | 开发测试阶段可用测试号 | [developers.weixin.qq.com/sandbox](https://developers.weixin.qq.com/sandbox) | 推荐 |

### 1.2 开发配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 服务器域名 - request | `https://api.test.thinkagent.ai` | API 请求域名 |
| 服务器域名 - uploadFile | `https://oss.test.thinkagent.ai` | 文件上传域名 |
| 服务器域名 - downloadFile | `https://cdn.test.thinkagent.ai` | 文件下载域名 |
| 业务域名 | `https://test.thinkagent.ai` | web-view 打开的域名 |

> **测试环境：** 开发者工具中可勾选"不校验合法域名"，绕过域名白名单限制。但体验版和正式版必须配置。

### 1.3 登录流程所需

| 资源项 | 说明 |
|--------|------|
| `wx.login()` 获取 code | 前端 UniApp 调用 |
| `jscode2session` 接口 | 后端用 AppID + AppSecret + code 换取 openid 和 session_key |
| UnionID | 需要绑定微信开放平台才能获取（跨平台用户打通） |

### 1.4 支付（Pro 版订阅）

| 资源项 | 详细说明 | 必须/可选 |
|--------|---------|----------|
| 微信商户号 | 企业主体才能申请 | MVP 可选 |
| 商户 API 密钥 | 用于签名 | 可选 |
| 微信支付证书 | apiclient_cert.pem / apiclient_key.pem | 可选 |
| 关联小程序 | 商户平台绑定小程序 AppID | 可选 |

> **测试环境建议：** 测试阶段不接入支付，使用邀请码或管理员手动开通 Pro。

### 1.5 内容安全

| 资源项 | 说明 |
|--------|------|
| `msgSecCheck` 接口 | 文本内容安全检测（小程序审核要求） |
| `mediaCheckAsync` 接口 | 图片内容安全检测 |

> **重要：** 微信小程序审核要求所有 UGC 内容必须经过内容安全检测，否则会被拒审。

### 1.6 所需环境变量

```env
# .env - 微信小程序
WECHAT_MINI_APP_ID=wx1234567890abcdef
WECHAT_MINI_APP_SECRET=your_app_secret_here
WECHAT_MINI_TOKEN=your_token_here           # 消息推送 token
WECHAT_MINI_ENCODING_AES_KEY=your_aes_key   # 消息加解密密钥
```

### 1.7 开发工具

| 工具 | 用途 |
|------|------|
| 微信开发者工具 | 小程序调试、预览、上传 |
| HBuilderX | UniApp 开发、编译到小程序 |

---

## 二、微信公众号

### 2.1 注册与准备

| 资源项 | 详细说明 | 获取方式 | 必须/可选 |
|--------|---------|---------|----------|
| 公众号账号 | 订阅号（个人可）或服务号（企业） | [mp.weixin.qq.com](https://mp.weixin.qq.com) | 必须 |
| 公众号类型 | **服务号**（网页授权 + 模板消息 + 支付） | 注册时选择 | 必须 |
| AppID | 公众号唯一标识 | 公众号后台 → 开发 → 基本配置 | 必须 |
| AppSecret | 公众号密钥 | 同上 | 必须 |
| 测试号 | 开发测试阶段使用 | [mp.weixin.qq.com/debug/cgi-bin/sandbox](https://mp.weixin.qq.com/debug/cgi-bin/sandbox) | 推荐 |

### 2.2 服务器配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 服务器 URL | `https://api.test.thinkagent.ai/wechat/callback` | 接收微信消息推送 |
| Token | 自定义字符串 | 用于验证消息来源 |
| EncodingAESKey | 43 位字符串 | 消息加密密钥 |
| 消息加密方式 | 安全模式 | 推荐安全模式 |

### 2.3 网页授权（H5 登录）

| 配置项 | 说明 |
|--------|------|
| 网页授权域名 | `test.thinkagent.ai` |
| JS 接口安全域名 | `test.thinkagent.ai` |
| 授权回调域名 | `test.thinkagent.ai` |
| OAuth 2.0 Scope | `snsapi_userinfo`（获取用户信息） |

**授权流程：**

```
用户访问 H5 页面
  → 跳转微信授权页
  → 用户同意
  → 回调 redirect_uri?code=xxx
  → 后端用 code 换取 access_token + openid
  → 获取用户信息
  → 创建/登录用户
```

### 2.4 消息能力

| 能力 | 需要的资源 | 用途 |
|------|----------|------|
| 模板消息 | 模板 ID（从模板库添加） | 对话完成通知、登录验证 |
| 客服消息 | 48 小时内用户互动后可主动发 | AI 回复结果推送 |
| 菜单 | 自定义菜单 JSON | 底部导航到 H5 |

### 2.5 微信开放平台（跨平台打通）

| 资源项 | 说明 | 必须/可选 |
|--------|------|----------|
| 开放平台账号 | [open.weixin.qq.com](https://open.weixin.qq.com) | 可选（用于 UnionID） |
| 绑定公众号 + 小程序 | 实现用户统一身份 | 可选 |
| UnionID 机制 | 同一用户在小程序和公众号共享 ID | 推荐 |

### 2.6 所需环境变量

```env
# .env - 微信公众号
WECHAT_OA_APP_ID=wx0987654321fedcba
WECHAT_OA_APP_SECRET=your_oa_secret_here
WECHAT_OA_TOKEN=your_oa_token
WECHAT_OA_ENCODING_AES_KEY=your_oa_aes_key

# 微信开放平台（如需 UnionID）
WECHAT_OPEN_APP_ID=wxopen1234567890
WECHAT_OPEN_APP_SECRET=your_open_secret
```

---

## 三、小红书（小红薯）

### 3.1 注册与准备

| 资源项 | 详细说明 | 获取方式 | 必须/可选 |
|--------|---------|---------|----------|
| 小红书开放平台账号 | 企业认证 | [open.xiaohongshu.com](https://open.xiaohongshu.com) | 必须 |
| 应用创建 | 创建"第三方应用" | 开放平台控制台 | 必须 |
| App Key | 应用标识 | 应用详情页 | 必须 |
| App Secret | 应用密钥 | 应用详情页 | 必须 |

### 3.2 开放能力

小红书开放平台目前开放的能力较有限，主要包括：

| 能力 | API | 用途 | 审核要求 |
|------|-----|------|---------|
| 用户授权登录 | OAuth 2.0 | 小红书账号登录 ThinkAgent | 需审核 |
| 笔记发布 | 内容发布 API | AI 生成内容一键发布 | 需审核 + 资质 |
| 用户信息 | 用户 API | 获取昵称、头像 | 需授权 |
| 数据分析 | 数据 API | 笔记数据回收分析 | 需审核 |

### 3.3 授权流程

```
用户点击"小红书登录"
  → 跳转小红书授权页
  → 用户授权
  → 回调 redirect_uri?code=xxx
  → 后端用 code 换取 access_token
  → 获取用户信息
  → 创建/绑定 ThinkAgent 账号
```

### 3.4 内容发布集成（AI 生成 → 一键发布）

```
Agent 生成小红书风格笔记
  → 用户确认内容
  → 调用小红书发布 API
  → 返回笔记链接
```

| 配置项 | 说明 |
|--------|------|
| 回调域名 | `https://test.thinkagent.ai/auth/xiaohongshu/callback` |
| Scope | `user_info,content_publish` |

### 3.5 测试环境注意事项

> **重要：** 小红书开放平台审核较严格，个人开发者不易获得权限。测试环境建议：
> 1. 先完成开放平台注册和应用创建
> 2. 使用沙箱环境（如有）
> 3. MVP 阶段小红书集成优先级降低，先做内容生成格式适配，后接发布 API

### 3.6 所需环境变量

```env
# .env - 小红书
XHS_APP_KEY=your_xhs_app_key
XHS_APP_SECRET=your_xhs_app_secret
XHS_REDIRECT_URI=https://test.thinkagent.ai/auth/xhs/callback
```

---

## 四、飞书 (Feishu / Lark)

### 4.1 注册与准备

| 资源项 | 详细说明 | 获取方式 | 必须/可选 |
|--------|---------|---------|----------|
| 飞书开发者账号 | 个人或企业均可 | [open.feishu.cn](https://open.feishu.cn) | 必须 |
| 创建企业自建应用 | 用于 Bot + API | 开发者后台 → 创建应用 | 必须 |
| App ID | 应用唯一标识 | 应用凭证页 | 必须 |
| App Secret | 应用密钥 | 应用凭证页 | 必须 |
| Verification Token | 事件订阅验证 | 事件订阅页 | 必须 |
| Encrypt Key | 事件加密密钥 | 事件订阅页 | 推荐 |

### 4.2 开启的能力

| 能力 | 配置位置 | 用途 |
|------|---------|------|
| 机器人 | 应用能力 → 机器人 | 飞书群内 @bot 对话 |
| 网页应用 | 应用能力 → 网页应用 | 飞书内打开 H5 页面 |
| 消息卡片 | 消息与群组 | 结构化消息展示 |

### 4.3 权限申请

| 权限 | 权限标识 | 用途 |
|------|---------|------|
| 获取用户信息 | `contact:user.base:readonly` | 用户身份 |
| 发送消息 | `im:message:send_as_bot` | Bot 回复消息 |
| 接收消息 | `im:message:receive_v1` | 接收用户 @bot 消息 |
| 获取群信息 | `im:chat:readonly` | 获取群组上下文 |
| 上传图片 | `im:resource` | 发送图片消息 |

### 4.4 事件订阅

| 事件 | 回调 URL | 用途 |
|------|---------|------|
| 接收消息 | `https://api.test.thinkagent.ai/feishu/events` | 用户发消息给 Bot |
| 机器人进群 | 同上 | 感知 Bot 被添加 |
| 消息已读 | 同上 | 用户已读回执 |

### 4.5 飞书 Bot 对话流程

```
用户在飞书群/私聊 @ThinkAgent Bot
  → 飞书推送事件到回调 URL
  → 后端解析消息内容
  → 调用 Agent 引擎处理
  → 通过飞书 API 发送回复消息（支持富文本卡片）
```

**消息卡片模板（结构化 AI 回复）：**

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "ThinkAgent 回复" },
      "template": "blue"
    },
    "elements": [
      {
        "tag": "markdown",
        "content": "**AI 回复内容**\n\n这里是 Agent 生成的回答..."
      },
      {
        "tag": "action",
        "actions": [
          {
            "tag": "button",
            "text": { "tag": "plain_text", "content": "👍 有用" },
            "type": "primary",
            "value": { "action": "feedback_up" }
          },
          {
            "tag": "button",
            "text": { "tag": "plain_text", "content": "👎 改进" },
            "value": { "action": "feedback_down" }
          }
        ]
      }
    ]
  }
}
```

### 4.6 所需环境变量

```env
# .env - 飞书
FEISHU_APP_ID=cli_a1234567890b
FEISHU_APP_SECRET=your_feishu_secret
FEISHU_VERIFICATION_TOKEN=your_verification_token
FEISHU_ENCRYPT_KEY=your_encrypt_key
FEISHU_BOT_NAME=ThinkAgent
```

### 4.7 测试环境技巧

| 技巧 | 说明 |
|------|------|
| 使用测试企业 | 飞书开发者后台可创建测试企业 |
| 内网穿透 | 开发时用 ngrok/frp 暴露本地服务接收事件回调 |
| API 调试器 | 飞书开放平台提供在线 API Explorer |
| 沙箱环境 | 应用可在"开发中"状态测试，无需审核上线 |

---

## 五、Discord

### 5.1 注册与准备

| 资源项 | 详细说明 | 获取方式 | 必须/可选 |
|--------|---------|---------|----------|
| Discord 开发者账号 | 需要 Discord 账号 | [discord.com/developers](https://discord.com/developers) | 必须 |
| 创建 Application | Discord Developer Portal | Applications → New Application | 必须 |
| Application ID | 应用标识 | 应用 General Information 页 | 必须 |
| Bot Token | Bot 认证令牌 | Bot 页面 → Reset Token | 必须 |
| Public Key | 用于验证交互请求 | General Information 页 | 必须 |

### 5.2 Bot 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Bot 名称 | ThinkAgent | 显示名 |
| Bot 头像 | 上传产品 Logo | 品牌一致性 |
| Privileged Intents | `MESSAGE_CONTENT` | 读取消息内容（需要申请） |
| Interactions Endpoint | `https://api.test.thinkagent.ai/discord/interactions` | 接收交互事件 |

### 5.3 权限 (Permissions)

| 权限 | Bot Permission | 用途 |
|------|---------------|------|
| 发送消息 | `Send Messages` | Bot 回复 |
| 读取消息 | `Read Message History` | 上下文理解 |
| 嵌入链接 | `Embed Links` | 富文本回复 |
| 附件 | `Attach Files` | 发送文件 |
| 使用斜杠命令 | `Use Application Commands` | /ask, /search 等 |
| 管理线程 | `Manage Threads` | 创建对话线程 |

### 5.4 OAuth2 Scopes

| Scope | 用途 |
|-------|------|
| `bot` | 将 Bot 添加到服务器 |
| `applications.commands` | 注册斜杠命令 |
| `identify` | 获取用户信息（登录用） |

**邀请链接生成：**

```
https://discord.com/api/oauth2/authorize
  ?client_id=YOUR_APPLICATION_ID
  &permissions=274877975552
  &scope=bot%20applications.commands
```

### 5.5 斜杠命令 (Slash Commands)

```javascript
// 注册的斜杠命令
const commands = [
  {
    name: 'ask',
    description: '向 ThinkAgent 提问',
    options: [{
      name: 'question',
      type: 3, // STRING
      description: '你的问题',
      required: true,
    }],
  },
  {
    name: 'search',
    description: '联网搜索信息',
    options: [{
      name: 'query',
      type: 3,
      description: '搜索关键词',
      required: true,
    }],
  },
  {
    name: 'kb',
    description: '知识库问答',
    options: [
      {
        name: 'query',
        type: 3,
        description: '你的问题',
        required: true,
      },
      {
        name: 'knowledge_base',
        type: 3,
        description: '知识库名称',
        required: false,
      },
    ],
  },
];
```

### 5.6 消息交互流程

```
用户在 Discord 频道输入 /ask 或 @ThinkAgent
  → Discord 推送 Interaction 事件到 Endpoint
  → 后端验证签名（Public Key）
  → 先回复 "思考中..."（Deferred Reply，3 秒内必须响应）
  → 调用 Agent 引擎处理
  → 通过 Webhook 更新回复内容（支持 Embed 富文本）
```

**Discord Embed 格式（结构化 AI 回复）：**

```javascript
{
  embeds: [{
    title: '🤖 ThinkAgent',
    description: 'AI 回复内容，支持 Markdown...',
    color: 0x5865F2,
    fields: [
      { name: '🔍 搜索来源', value: '[链接1](url)\n[链接2](url)', inline: true },
      { name: '📊 Token 消耗', value: '680 tokens', inline: true },
    ],
    footer: { text: 'Powered by ThinkAgent | 回复 👍/👎 反馈' },
    timestamp: new Date().toISOString(),
  }],
  components: [{
    type: 1,
    components: [
      { type: 2, style: 1, label: '👍', custom_id: 'feedback_up' },
      { type: 2, style: 4, label: '👎', custom_id: 'feedback_down' },
    ],
  }],
}
```

### 5.7 所需环境变量

```env
# .env - Discord
DISCORD_APPLICATION_ID=1234567890123456789
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_PUBLIC_KEY=your_public_key_here
DISCORD_GUILD_ID=9876543210987654321    # 测试服务器 ID
```

### 5.8 测试环境技巧

| 技巧 | 说明 |
|------|------|
| 创建测试服务器 | 专门建一个 Discord 服务器用于开发测试 |
| Guild Commands | 测试阶段注册 Guild 级命令（即时生效），而非 Global（1 小时生效） |
| discord.js | 推荐使用 discord.js v14 库 |
| 内网穿透 | 开发时需要暴露 Interactions Endpoint |

---

## 六、测试环境基础设施汇总

### 6.1 域名与 SSL

| 域名 | 用途 | SSL |
|------|------|-----|
| `test.thinkagent.ai` | Web 前端 | Let's Encrypt 免费证书 |
| `api.test.thinkagent.ai` | API 服务 | 同上 |
| `n8n.test.thinkagent.ai` | n8n 面板 | 同上 |

> 测试环境可使用 `*.test.thinkagent.ai` 通配符证书。也可用 Cloudflare 免费 SSL。

### 6.2 开发阶段内网穿透

飞书、Discord 的 Webhook 回调需要公网可达的 URL，开发时需要内网穿透：

| 工具 | 免费额度 | 推荐度 |
|------|---------|--------|
| ngrok | 1 个免费隧道 | 推荐 |
| frp | 自建，免费 | 推荐（已有服务器） |
| Cloudflare Tunnel | 免费 | 推荐 |
| localtunnel | 免费 | 备选 |

### 6.3 第三方服务 API Key

| 服务 | 用途 | 获取方式 | 费用 |
|------|------|---------|------|
| OpenAI API Key | GPT-4o 模型 | [platform.openai.com](https://platform.openai.com) | 按量付费 |
| Anthropic API Key | Claude 备用模型 | [console.anthropic.com](https://console.anthropic.com) | 按量付费 |
| Tavily API Key | 联网搜索工具 | [tavily.com](https://tavily.com) | 1000 次/月免费 |
| 阿里云 OSS | 文件存储 | [aliyun.com](https://www.aliyun.com) | 按量，~¥1/月 |
| 阿里云短信 | 验证码 | 同上 | ¥0.045/条 |
| LangSmith | AI 追踪调试 | [smith.langchain.com](https://smith.langchain.com) | 免费额度 |

### 6.4 完整环境变量清单

```env
# ============================================
# ThinkAgent 测试环境完整环境变量
# ============================================

# ===== 基础配置 =====
NODE_ENV=development
PORT=3000
API_BASE_URL=https://api.test.thinkagent.ai
WEB_BASE_URL=https://test.thinkagent.ai

# ===== 数据库 =====
DATABASE_URL=postgresql://thinkagent:password@localhost:5432/thinkagent
REDIS_URL=redis://localhost:6379

# ===== JWT =====
JWT_SECRET=your-jwt-secret-at-least-32-chars
JWT_REFRESH_SECRET=your-refresh-jwt-secret-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ===== AI 模型 =====
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...

# ===== LangSmith =====
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=thinkagent-dev

# ===== 文件存储 (OSS) =====
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key
OSS_BUCKET=thinkagent-test
OSS_CDN_DOMAIN=https://cdn.test.thinkagent.ai

# ===== 短信 =====
SMS_ACCESS_KEY_ID=your_sms_key
SMS_ACCESS_KEY_SECRET=your_sms_secret
SMS_SIGN_NAME=ThinkAgent
SMS_TEMPLATE_CODE=SMS_123456789

# ===== 微信小程序 =====
WECHAT_MINI_APP_ID=wx1234567890abcdef
WECHAT_MINI_APP_SECRET=your_mini_secret
WECHAT_MINI_TOKEN=your_mini_token
WECHAT_MINI_ENCODING_AES_KEY=your_mini_aes_key

# ===== 微信公众号 =====
WECHAT_OA_APP_ID=wx0987654321fedcba
WECHAT_OA_APP_SECRET=your_oa_secret
WECHAT_OA_TOKEN=your_oa_token
WECHAT_OA_ENCODING_AES_KEY=your_oa_aes_key

# ===== 微信开放平台 =====
WECHAT_OPEN_APP_ID=wxopen1234567890
WECHAT_OPEN_APP_SECRET=your_open_secret

# ===== 小红书 =====
XHS_APP_KEY=your_xhs_app_key
XHS_APP_SECRET=your_xhs_app_secret
XHS_REDIRECT_URI=https://test.thinkagent.ai/auth/xhs/callback

# ===== 飞书 =====
FEISHU_APP_ID=cli_a1234567890b
FEISHU_APP_SECRET=your_feishu_secret
FEISHU_VERIFICATION_TOKEN=your_verification_token
FEISHU_ENCRYPT_KEY=your_encrypt_key

# ===== Discord =====
DISCORD_APPLICATION_ID=1234567890123456789
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_PUBLIC_KEY=your_public_key
DISCORD_GUILD_ID=9876543210987654321

# ===== n8n =====
N8N_USER=admin
N8N_PASSWORD=your_n8n_password

# ===== 部署 =====
DB_PASSWORD=your_db_password
```

---

## 七、各平台接入优先级建议

| 优先级 | 平台 | 理由 | 预估工时 |
|--------|------|------|---------|
| P0 | 微信小程序 | 核心入口，用户量最大 | 已在 MVP 计划内 |
| P1 | 微信公众号 | H5 登录 + 消息推送，与小程序互补 | 3 天 |
| P1 | 飞书 Bot | 企业用户入口，API 完善 | 3 天 |
| P2 | Discord Bot | 技术社区用户入口，国际化 | 2 天 |
| P3 | 小红书 | 内容创作者入口，审核周期长 | 5 天（含审核等待） |

---

## 八、测试环境搭建 Checklist

### 第一步：账号注册（第 1 天）

- [ ] 注册微信小程序账号 / 获取测试号
- [ ] 注册微信公众号测试号
- [ ] 注册微信开放平台（绑定小程序和公众号）
- [ ] 注册飞书开发者账号，创建应用
- [ ] 注册 Discord 开发者账号，创建 Application
- [ ] 注册小红书开放平台账号
- [ ] 注册 OpenAI 账号，获取 API Key
- [ ] 注册 Tavily 账号，获取 API Key
- [ ] 注册 LangSmith 账号
- [ ] 注册阿里云账号（OSS + 短信）

### 第二步：配置与密钥（第 2 天）

- [ ] 获取所有平台的 AppID / AppSecret
- [ ] 配置微信小程序服务器域名
- [ ] 配置微信公众号服务器 URL
- [ ] 配置飞书事件订阅回调 URL
- [ ] 配置 Discord Interactions Endpoint
- [ ] 配置 SSL 证书
- [ ] 配置内网穿透（ngrok/frp）
- [ ] 填写 .env 环境变量文件

### 第三步：基础验证（第 3 天）

- [ ] 微信小程序 `wx.login` → 获取 openid 验证通过
- [ ] 微信公众号服务器 URL 验证通过
- [ ] 飞书事件订阅 Challenge 验证通过
- [ ] Discord Bot 上线，响应 /ping 命令
- [ ] 各平台 OAuth 授权流程跑通
- [ ] 内网穿透各 Webhook 回调正常接收
