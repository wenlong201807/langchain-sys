# ThinkAgent 移动端项目方案 (packages/mobile)

## 一、项目概述

ThinkAgent 移动端基于 UniApp 构建，一套代码同时支持微信小程序与 H5，实现跨平台 AI 对话与知识库能力。

| 技术 | 版本/说明 |
|------|-----------|
| **UniApp** | 3.x，基于 Vue 3 |
| **Vue** | 3.x，Composition API |
| **TypeScript** | 5.x |
| **UI 组件库** | uv-ui / uView Plus |
| **状态管理** | Pinia |
| **目标平台** | 微信小程序 + H5 |
| **环境** | test / staging / prod |

### 技术选型理由

- **UniApp**：一套代码多端运行，降低维护成本；与微信小程序 API 深度集成
- **Vue 3 + TypeScript**：与 Web 端技术栈一致，便于团队协作
- **uv-ui / uView Plus**：UniApp 生态成熟 UI 库，组件丰富、支持主题定制
- **Pinia**：Vue 官方推荐状态管理，轻量、类型友好

---

## 二、项目目录结构

```
packages/mobile/
├── src/
│   ├── pages/                    # 页面
│   │   ├── index/                # 首页（对话列表）
│   │   │   └── index.vue
│   │   ├── chat/                 # 对话页（核心）
│   │   │   └── index.vue
│   │   ├── knowledge/            # 知识库页
│   │   │   └── index.vue
│   │   └── mine/                 # 个人中心
│   │       └── index.vue
│   ├── components/               # 公共组件
│   │   ├── chat/
│   │   │   ├── MessageBubble.vue
│   │   │   ├── ChatInput.vue
│   │   │   └── StreamingText.vue
│   │   ├── knowledge/
│   │   │   └── DocumentList.vue
│   │   └── common/
│   │       └── EmptyState.vue
│   ├── stores/                   # Pinia 状态
│   │   ├── auth.store.ts
│   │   ├── chat.store.ts
│   │   └── knowledge.store.ts
│   ├── api/                      # API 请求层
│   │   ├── request.ts            # uni.request 封装
│   │   ├── auth.api.ts
│   │   ├── chat.api.ts
│   │   └── knowledge.api.ts
│   ├── utils/                    # 工具函数
│   │   ├── sse.ts                # SSE 兼容方案
│   │   ├── storage.ts
│   │   └── platform.ts
│   ├── config/                   # 环境配置
│   │   └── env.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── pages.json                    # 页面路由配置
├── manifest.json                 # 应用配置
├── uni.scss                      # 全局样式变量
└── package.json
```

---

## 三、配置管理

### 3.1 环境检测 (src/config/env.ts)

通过 `UNI_ENV` 或 `process.env.NODE_ENV` 区分环境，不同环境使用不同 API 地址与 AppID。

```typescript
// src/config/env.ts

export type EnvType = 'test' | 'staging' | 'production'

/** 当前环境，build 时由 cross-env UNI_ENV=xxx 注入 */
const rawEnv = (process.env.UNI_ENV || process.env.NODE_ENV || 'development') as string

/** 标准化为 test | staging | production */
export const env: EnvType = 
  rawEnv === 'test' ? 'test' :
  rawEnv === 'staging' ? 'staging' :
  rawEnv === 'production' ? 'production' :
  'test'

/** 是否为开发模式 */
export const isDev = env === 'test' || process.env.NODE_ENV === 'development'

/** API 基础地址 */
export const API_BASE_URL: Record<EnvType, string> = {
  test: 'http://localhost:3000/api',
  staging: 'https://staging-api.thinkagent.ai/api',
  production: 'https://api.thinkagent.ai/api',
}

/** 微信小程序 AppID（按环境区分） */
export const WX_APP_ID: Record<EnvType, string> = {
  test: 'wx_test_appid',
  staging: 'wx_staging_appid',
  production: 'wx_prod_appid',
}

/** 当前 API 地址 */
export const apiBaseUrl = API_BASE_URL[env]

/** 当前微信 AppID */
export const wxAppId = WX_APP_ID[env]
```

### 3.2 manifest.json 按环境配置 AppID

`manifest.json` 中 `mp-weixin.appid` 可在构建时通过 `define` 或环境变量覆盖，或使用 `manifest.config.js` 动态生成：

```javascript
// manifest.config.js (可选，用于动态 manifest)
module.exports = (config) => {
  const env = process.env.UNI_ENV || 'test'
  const appIds = {
    test: 'wx_test_appid',
    staging: 'wx_staging_appid',
    production: 'wx_prod_appid',
  }
  config['mp-weixin'] = config['mp-weixin'] || {}
  config['mp-weixin'].appid = appIds[env]
  return config
}
```

---

## 四、多环境启动

### 4.1 package.json scripts

```json
{
  "scripts": {
    "dev:mp-weixin": "uni -p mp-weixin",
    "dev:h5": "uni -p h5",
    "build:mp-weixin:test": "cross-env UNI_ENV=test uni build -p mp-weixin",
    "build:mp-weixin:staging": "cross-env UNI_ENV=staging uni build -p mp-weixin",
    "build:mp-weixin:prod": "cross-env UNI_ENV=production uni build -p mp-weixin",
    "build:h5:test": "cross-env UNI_ENV=test uni build -p h5",
    "build:h5:staging": "cross-env UNI_ENV=staging uni build -p h5",
    "build:h5:prod": "cross-env UNI_ENV=production uni build -p h5"
  }
}
```

### 4.2 依赖

```bash
pnpm add cross-env -D
```

---

## 五、SSE 兼容方案

微信小程序不支持标准 `EventSource`，需使用 `uni.request` 的 `enableChunkedTransfer` 或 `RequestTask` 分片接收；H5 可直接使用 `EventSource`。

### 5.1 微信小程序：RequestTask + enableChunkedTransfer

```typescript
// src/utils/sse.ts

import { apiBaseUrl } from '@/config/env'

export interface SSECallbacks {
  onMessage?: (data: string) => void
  onError?: (err: Error) => void
  onComplete?: () => void
}

/** 微信小程序 SSE：使用 RequestTask 分片接收 */
export function createMiniProgramSSE(
  url: string,
  options: { token?: string; body?: Record<string, unknown> },
  callbacks: SSECallbacks
) {
  // #ifdef MP-WEIXIN
  const requestTask = uni.request({
    url: apiBaseUrl + url,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      Authorization: options.token ? `Bearer ${options.token}` : '',
    },
    data: options.body,
    enableChunked: true, // 启用分片传输
    success: (res) => {
      if (res.statusCode !== 200) {
        callbacks.onError?.(new Error(`HTTP ${res.statusCode}`))
      }
      callbacks.onComplete?.()
    },
    fail: (err) => {
      callbacks.onError?.(new Error(err.errMsg || 'Request failed'))
    },
  })

  requestTask.onChunkReceived?.((res) => {
    const decoder = new TextDecoder()
    const text = decoder.decode(new Uint8Array(res.data))
    // 简单解析 SSE 格式：data: xxx\n\n
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data !== '[DONE]') callbacks.onMessage?.(data)
      }
    }
  })

  return () => requestTask.abort()
  // #endif

  // #ifdef H5
  return createH5SSE(url, options, callbacks)
  // #endif
}
```

### 5.2 H5：EventSource

```typescript
/** H5 SSE：使用 EventSource */
function createH5SSE(
  url: string,
  options: { token?: string; body?: Record<string, unknown> },
  callbacks: SSECallbacks
) {
  // H5 需后端支持 GET + 查询参数，或使用 fetch + ReadableStream
  const params = new URLSearchParams(options.body as Record<string, string>)
  const fullUrl = `${apiBaseUrl}${url}?${params}`
  const es = new EventSource(fullUrl, { withCredentials: true })

  es.onmessage = (e) => callbacks.onMessage?.(e.data)
  es.onerror = () => {
    callbacks.onError?.(new Error('EventSource error'))
    es.close()
  }

  return () => es.close()
}
```

### 5.3 Fallback：分片不支持时轮询

```typescript
/** 当 enableChunked 不可用时，降级为轮询 */
export function createPollingFallback(
  url: string,
  options: { token?: string; body?: Record<string, unknown> },
  callbacks: SSECallbacks
) {
  let cancelled = false
  const poll = async () => {
    if (cancelled) return
    const res = await uni.request({
      url: apiBaseUrl + url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: options.token ? `Bearer ${options.token}` : '',
      },
      data: options.body,
    })
    const data = (res.data as { content?: string })?.content
    if (data) callbacks.onMessage?.(data)
    if (!cancelled) setTimeout(poll, 500)
  }
  poll()
  return () => { cancelled = true }
}
```

---

## 六、核心页面设计

### 6.1 首页（对话列表）

展示用户对话列表，支持新建、删除、进入对话。

```vue
<!-- src/pages/index/index.vue -->
<template>
  <view class="page-index">
    <uv-navbar title="ThinkAgent" :borderBottom="false" />
    <view class="chat-list" v-if="chatStore.threads.length">
      <view
        v-for="t in chatStore.threads"
        :key="t.id"
        class="chat-item"
        @click="goChat(t.id)"
      >
        <text class="title">{{ t.title || '新对话' }}</text>
        <text class="time">{{ formatTime(t.updatedAt) }}</text>
      </view>
    </view>
    <uv-empty v-else text="暂无对话，点击下方按钮开始" />
    <view class="fab" @click="createChat">
      <uv-icon name="plus" size="28" color="#fff" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'uni-mini-router' // 或 uni.navigateTo
import { useChatStore } from '@/stores/chat.store'

const chatStore = useChatStore()

onMounted(() => {
  chatStore.fetchThreads()
})

function goChat(id: string) {
  uni.navigateTo({ url: `/pages/chat/index?id=${id}` })
}

function createChat() {
  chatStore.createThread().then((t) => goChat(t.id))
}

function formatTime(date: string) {
  return new Date(date).toLocaleDateString()
}
</script>

<style lang="scss" scoped>
.page-index { padding-bottom: 100rpx; }
.chat-list { padding: 24rpx; }
.chat-item {
  padding: 24rpx; background: #f5f5f5; border-radius: 16rpx;
  margin-bottom: 16rpx; display: flex; justify-content: space-between;
}
.fab {
  position: fixed; right: 32rpx; bottom: 80rpx;
  width: 96rpx; height: 96rpx; background: #07c160;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
}
</style>
```

### 6.2 对话页（核心）

消息气泡、流式展示、Markdown 渲染（mp-html）。

```vue
<!-- src/pages/chat/index.vue -->
<template>
  <view class="page-chat">
    <uv-navbar :title="thread?.title || '对话'" />
    <scroll-view
      scroll-y
      class="message-list"
      :scroll-into-view="scrollIntoView"
      scroll-with-animation
    >
      <view
        v-for="m in messages"
        :id="`msg-${m.id}`"
        :key="m.id"
        class="msg-wrap"
      >
        <MessageBubble :message="m" />
      </view>
      <view v-if="isStreaming" class="msg-wrap">
        <StreamingText :content="streamingContent" />
      </view>
    </scroll-view>
    <ChatInput
      v-model="inputText"
      :loading="isStreaming"
      @send="onSend"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import StreamingText from '@/components/chat/StreamingText.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import { useChatStore } from '@/stores/chat.store'
import { createMiniProgramSSE } from '@/utils/sse'

const threadId = ref('')
const inputText = ref('')
const scrollIntoView = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')

const chatStore = useChatStore()
const messages = computed(() => chatStore.getMessages(threadId.value))
const thread = computed(() => chatStore.getThread(threadId.value))

onLoad((q) => { threadId.value = q.id || '' })
onMounted(() => chatStore.fetchMessages(threadId.value))

watch(
  () => [...messages.value].length + (isStreaming.value ? 1 : 0),
  () => { scrollIntoView.value = `msg-${messages.value[messages.value.length - 1]?.id || 'streaming'}` }
)

async function onSend() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  inputText.value = ''
  await chatStore.sendMessage(threadId.value, text, {
    onChunk: (chunk) => {
      isStreaming.value = true
      streamingContent.value += chunk
    },
    onDone: () => {
      isStreaming.value = false
      streamingContent.value = ''
    },
  })
}
</script>

<style lang="scss" scoped>
.page-chat { height: 100vh; display: flex; flex-direction: column; }
.message-list { flex: 1; padding: 24rpx; }
.msg-wrap { margin-bottom: 24rpx; }
</style>
```

### 6.3 MessageBubble + mp-html 渲染 Markdown

```vue
<!-- src/components/chat/MessageBubble.vue -->
<template>
  <view :class="['bubble', message.role]">
    <view class="avatar">
      <uv-icon :name="message.role === 'user' ? 'account' : 'chat'" size="20" />
    </view>
    <view class="content">
      <mp-html
        v-if="message.role === 'assistant'"
        :content="message.content"
        :options="htmlOptions"
      />
      <text v-else>{{ message.content }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ message: { role: string; content: string } }>()

const htmlOptions = computed(() => ({
  theme: 'light',
  // mp-html 配置：代码高亮、图片懒加载等
}))
</script>
```

> 需安装 `mp-html` 插件：`pnpm add mp-html`，并在 `pages.json` 中配置 `easycom`。

### 6.4 StreamingText 流式展示

```vue
<!-- src/components/chat/StreamingText.vue -->
<template>
  <view class="bubble assistant">
    <view class="avatar"><uv-icon name="chat" size="20" /></view>
    <view class="content">
      <mp-html :content="content" :options="htmlOptions" />
      <text class="cursor">|</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineProps<{ content: string }>()
const htmlOptions = { theme: 'light' }
</script>
```

### 6.5 知识库页

```vue
<!-- src/pages/knowledge/index.vue -->
<template>
  <view class="page-knowledge">
    <uv-navbar title="知识库" />
    <DocumentList :list="knowledgeStore.documents" @refresh="refresh" />
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import DocumentList from '@/components/knowledge/DocumentList.vue'
import { useKnowledgeStore } from '@/stores/knowledge.store'

const knowledgeStore = useKnowledgeStore()
onMounted(refresh)
function refresh() {
  knowledgeStore.fetchDocuments()
}
</script>
```

### 6.6 个人中心

```vue
<!-- src/pages/mine/index.vue -->
<template>
  <view class="page-mine">
    <uv-navbar title="个人中心" />
    <view class="user-card" v-if="authStore.user">
      <image :src="authStore.user.avatar" class="avatar" />
      <text class="name">{{ authStore.user.nickname }}</text>
    </view>
    <uv-cell-group>
      <uv-cell title="设置" isLink url="/pages/settings/index" />
      <uv-cell title="退出登录" @click="logout" />
    </uv-cell-group>
  </view>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
function logout() {
  authStore.logout()
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>
```

---

## 七、微信登录

```typescript
// src/api/auth.api.ts

import { apiBaseUrl } from '@/config/env'

export async function wxLogin() {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: async (res) => {
        const code = res.code
        if (!code) {
          reject(new Error('微信登录失败'))
          return
        }
        const { data } = await uni.request({
          url: `${apiBaseUrl}/auth/wechat/login`,
          method: 'POST',
          data: { code },
        }) as { data: { token: string } }
        resolve(data.token)
      },
      fail: (err) => reject(err),
    })
  })
}
```

```typescript
// src/stores/auth.store.ts

import { defineStore } from 'pinia'
import { wxLogin } from '@/api/auth.api'
import { setToken, getToken, removeToken } from '@/utils/storage'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken() as string | null,
    user: null as { id: string; nickname: string; avatar: string } | null,
  }),
  actions: {
    async login() {
      const token = await wxLogin()
      setToken(token)
      this.token = token
      await this.fetchUser()
    },
    async fetchUser() {
      // 调用 /auth/me 获取用户信息
    },
    logout() {
      removeToken()
      this.token = null
      this.user = null
    },
  },
})
```

---

## 八、API 请求层

### 8.1 uni.request 封装与拦截器

```typescript
// src/api/request.ts

import { apiBaseUrl } from '@/config/env'
import { useAuthStore } from '@/stores/auth.store'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  needAuth?: boolean
}

export function request<T = unknown>(options: RequestOptions): Promise<T> {
  const authStore = useAuthStore()
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.header,
  }
  if (options.needAuth !== false && authStore.token) {
    header.Authorization = `Bearer ${authStore.token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: apiBaseUrl + options.url,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        if (res.statusCode === 401) {
          authStore.logout()
          uni.reLaunch({ url: '/pages/index/index' })
          reject(new Error('未登录'))
          return
        }
        const data = res.data as { code?: number; data?: T; message?: string }
        if (data.code === 0 || res.statusCode === 200) {
          resolve((data.data ?? data) as T)
        } else {
          reject(new Error(data.message || '请求失败'))
        }
      },
      fail: (err) => reject(err),
    })
  })
}
```

### 8.2 Token 自动刷新（可选）

```typescript
// 在 request 拦截器中检测 401，调用 refresh token 接口后重试
async function requestWithRefresh<T>(options: RequestOptions): Promise<T> {
  try {
    return await request<T>(options)
  } catch (e) {
    if (e.message === '未登录' && authStore.refreshToken) {
      await authStore.refreshToken()
      return request<T>(options)
    }
    throw e
  }
}
```

### 8.3 平台适配

```typescript
// src/utils/platform.ts

export const isMpWeixin = () => {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  return false
}

export const isH5 = () => {
  // #ifdef H5
  return true
  // #endif
  return false
}
```

---

## 九、部署方案

### 9.1 微信小程序

1. 执行对应环境构建：
   ```bash
   pnpm build:mp-weixin:staging   # 或 prod
   ```
2. 用微信开发者工具打开 `dist/dev/mp-weixin`（或 `dist/build/mp-weixin`）
3. 上传代码 → 提交审核 → 发布

### 9.2 H5

1. 构建：
   ```bash
   pnpm build:h5:prod
   ```
2. 将 `dist/build/h5` 部署到 CDN 或静态服务器（如 Nginx）
3. 配置 SPA 路由回退：
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

---

## 十、pages.json 示例

```json
{
  "pages": [
    { "path": "pages/index/index", "style": { "navigationBarTitleText": "ThinkAgent" } },
    { "path": "pages/chat/index", "style": { "navigationBarTitleText": "对话" } },
    { "path": "pages/knowledge/index", "style": { "navigationBarTitleText": "知识库" } },
    { "path": "pages/mine/index", "style": { "navigationBarTitleText": "个人中心" } }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarBackgroundColor": "#fff"
  }
}
```

---

## 十一、依赖清单

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "uv-ui": "^2.0.0",
    "mp-html": "^2.4.0"
  },
  "devDependencies": {
    "cross-env": "^7.0.0",
    "sass": "^1.69.0",
    "typescript": "^5.3.0"
  }
}
```
