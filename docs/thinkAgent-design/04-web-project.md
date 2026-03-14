# ThinkAgent Web 前端项目方案 (packages/web)

## 一、项目概述

ThinkAgent Web 前端是基于现代 React 技术栈构建的 AI 对话与知识库管理应用，采用以下核心技术选型：

| 技术 | 版本/说明 |
|------|-----------|
| **Next.js** | 14.x，App Router 架构 |
| **React** | 18.x |
| **TypeScript** | 5.x |
| **UI 组件** | shadcn/ui + Tailwind CSS |
| **状态管理** | Zustand |
| **数据请求** | TanStack Query (React Query) |
| **环境** | test / staging / prod |

### 技术选型理由

- **Next.js 14 App Router**：服务端组件、流式渲染、内置 API Routes 作为 BFF
- **shadcn/ui**：可定制、无障碍、与 Tailwind 深度集成
- **Zustand**：轻量、无样板、支持中间件
- **TanStack Query**：自动缓存、重试、乐观更新

---

## 二、项目目录结构

```
packages/web/
├── app/
│   ├── (auth)/                    # 认证相关路由组
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (main)/                    # 主应用路由组
│   │   ├── chat/
│   │   │   └── [threadId]/
│   │   │       └── page.tsx
│   │   ├── knowledge/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── layout.tsx                 # 根布局
│   ├── page.tsx                   # 首页（重定向）
│   └── api/                       # BFF API Routes
│       ├── auth/
│       ├── chat/
│       └── knowledge/
├── components/
│   ├── chat/                      # 对话相关组件
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ChatSidebar.tsx
│   │   └── ToolCallStatus.tsx
│   ├── knowledge/                 # 知识库相关组件
│   │   ├── DocumentList.tsx
│   │   └── DocumentUpload.tsx
│   ├── layout/                    # 布局组件
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   └── ui/                        # shadcn/ui 组件
├── lib/
│   ├── api-client.ts              # Axios 封装
│   ├── sse-handler.ts             # SSE 流处理
│   └── utils.ts
├── hooks/
│   ├── useSSE.ts
│   ├── useChat.ts
│   ├── useAuth.ts
│   └── useKnowledge.ts
├── stores/
│   ├── auth.store.ts
│   ├── chat.store.ts
│   └── knowledge.store.ts
├── config/
│   └── index.ts                   # 环境配置
├── types/
│   └── index.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 三、配置管理

### 3.1 next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV || 'development',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.example.com',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
```

### 3.2 环境变量文件

- `.env.local` - 本地开发
- `.env.test` - 测试环境
- `.env.staging` - 预发布环境
- `.env.production` - 生产环境

```bash
# .env.example
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

### 3.3 config/index.ts

```typescript
// config/index.ts
const env = process.env.NEXT_PUBLIC_ENV || 'development';

export const config = {
  env: env as 'development' | 'test' | 'staging' | 'production',
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (env === 'production' ? 'https://api.thinkagent.com' : 'http://localhost:8080'),
  wsUrl:
    process.env.NEXT_PUBLIC_WS_URL ||
    (env === 'production' ? 'wss://api.thinkagent.com' : 'ws://localhost:8080'),
  isDev: env === 'development',
  isTest: env === 'test',
  isProd: env === 'production',
} as const;
```

---

## 四、多环境启动

### package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:test": "NEXT_PUBLIC_ENV=test next build",
    "build:staging": "NEXT_PUBLIC_ENV=staging next build",
    "build:prod": "NEXT_PUBLIC_ENV=production next build",
    "start": "next start",
    "start:test": "NEXT_PUBLIC_ENV=test next start -p 3001",
    "start:staging": "NEXT_PUBLIC_ENV=staging next start -p 3001",
    "start:prod": "NEXT_PUBLIC_ENV=production next start -p 3001",
    "lint": "next lint"
  }
}
```

---

## 五、核心页面设计

### 5.1 对话页面 (核心)

#### 布局结构

```tsx
// app/(main)/chat/[threadId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMain } from '@/components/chat/ChatMain';
import { ChatInput } from '@/components/chat/ChatInput';

export default function ChatPage() {
  const params = useParams();
  const threadId = params.threadId as string;

  return (
    <div className="flex h-screen">
      <ChatSidebar threadId={threadId} />
      <div className="flex flex-1 flex-col">
        <ChatMain threadId={threadId} />
        <ChatInput threadId={threadId} />
      </div>
    </div>
  );
}
```

#### SSE 流式处理 + EventSource

```tsx
// components/chat/ChatMain.tsx
'use client';

import { useSSE } from '@/hooks/useSSE';
import { ChatMessage } from './ChatMessage';

interface ChatMainProps {
  threadId: string;
}

export function ChatMain({ threadId }: ChatMainProps) {
  const { messages, isStreaming, error } = useSSE(threadId);

  if (error) {
    return <div className="p-4 text-destructive">{error}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        <div className="animate-pulse text-muted-foreground">思考中...</div>
      )}
    </div>
  );
}
```

#### Markdown 渲染 (react-markdown + Shiki + KaTeX)

```tsx
// components/chat/ChatMessage.tsx
'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import { createShikiHighlighter } from '@/lib/shiki';
import 'katex/dist/katex.min.css';

// MarkdownContent：Shiki 高亮需异步初始化，可封装为独立组件
function MarkdownContent({ content }: { content: string }) {
  const [highlighter, setHighlighter] = useState<Awaited<ReturnType<typeof createShikiHighlighter>> | null>(null);
  useEffect(() => {
    createShikiHighlighter().then(setHighlighter);
  }, []);
  if (!highlighter) return <span>{content}</span>;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, [rehypeShiki, { highlighter }]]}
    >
      {content}
    </ReactMarkdown>
  );
}

interface ChatMessageProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: Array<{ name: string; status: string }>;
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {message.role === 'assistant' ? (
          <MarkdownContent content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallStatus toolCalls={message.toolCalls} />
        )}
      </div>
    </div>
  );
}
```

#### 消息组件：用户气泡、助手气泡、Tool Call 状态

```tsx
// components/chat/ToolCallStatus.tsx
'use client';

interface ToolCallStatusProps {
  toolCalls: Array<{ name: string; status: 'pending' | 'running' | 'completed' | 'failed' }>;
}

export function ToolCallStatus({ toolCalls }: ToolCallStatusProps) {
  return (
    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
      {toolCalls.map((tc, i) => (
        <div key={i} className="flex items-center gap-2">
          <StatusIcon status={tc.status} />
          <span>{tc.name}</span>
          <span className="text-xs">({tc.status})</span>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <span className="animate-spin">⏳</span>;
    case 'completed':
      return <span className="text-green-500">✓</span>;
    case 'failed':
      return <span className="text-destructive">✗</span>;
    default:
      return <span>○</span>;
  }
}
```

### 5.2 知识库页面

#### 知识库列表 + 文档上传 (react-dropzone)

```tsx
// app/(main)/knowledge/page.tsx
'use client';

import { useKnowledge } from '@/hooks/useKnowledge';
import { DocumentList } from '@/components/knowledge/DocumentList';
import { DocumentUpload } from '@/components/knowledge/DocumentUpload';

export default function KnowledgePage() {
  const { knowledgeBases, documents, isLoading } = useKnowledge();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">知识库管理</h1>
      <DocumentUpload />
      <DocumentList documents={documents} isLoading={isLoading} />
    </div>
  );
}
```

```tsx
// components/knowledge/DocumentUpload.tsx
'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useKnowledgeStore } from '@/stores/knowledge.store';

export function DocumentUpload() {
  const uploadDocument = useKnowledgeStore((s) => s.uploadDocument);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        await uploadDocument(file);
      }
    },
    [uploadDocument]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-muted-foreground">
        {isDragActive ? '释放以上传文件' : '拖拽文件到此处，或点击选择'}
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        支持 PDF、TXT、DOCX，最大 10MB
      </p>
    </div>
  );
}
```

#### 文档处理状态轮询

```tsx
// hooks/useKnowledge.ts
import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '@/lib/api-client';

export function useKnowledge() {
  const { data: knowledgeBases, isLoading } = useQuery({
    queryKey: ['knowledgeBases'],
    queryFn: () => knowledgeApi.listBases(),
  });

  const { data: documents, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: () => knowledgeApi.listDocuments(),
    refetchInterval: (query) => {
      // 有处理中的文档时每 3 秒轮询
      const hasProcessing = query.state.data?.some(
        (d) => d.status === 'processing' || d.status === 'pending'
      );
      return hasProcessing ? 3000 : false;
    },
  });

  return { knowledgeBases, documents: documents ?? [], isLoading, refetch };
}
```

### 5.3 登录/注册页面

#### 手机号 + 短信验证码登录

```tsx
// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const login = useAuthStore((s) => s.login);
  const sendCode = useAuthStore((s) => s.sendSmsCode);
  const router = useRouter();

  const handleSendCode = async () => {
    await sendCode(phone);
    setStep('code');
  };

  const handleLogin = async () => {
    await login({ phone, code });
    router.push('/chat/new');
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-bold">登录</h1>
        {step === 'phone' ? (
          <>
            <Input
              placeholder="手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button onClick={handleSendCode} className="w-full">
              发送验证码
            </Button>
          </>
        ) : (
          <>
            <Input
              placeholder="验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={handleLogin} className="w-full">
              登录
            </Button>
            <Button variant="ghost" onClick={() => setStep('phone')}>
              更换手机号
            </Button>
          </>
        )}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">或</span>
          </div>
        </div>
        <Button variant="outline" className="w-full">
          微信登录
        </Button>
      </div>
    </div>
  );
}
```

#### 微信 OAuth 登录

```tsx
// lib/wechat-oauth.ts
import { config } from '@/config';

export function getWechatAuthUrl(redirectUri: string, state?: string) {
  const params = new URLSearchParams({
    appid: config.wechatAppId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'snsapi_login',
    state: state ?? '',
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${params}#wechat_redirect`;
}

// 在登录页调用
const handleWechatLogin = () => {
  const redirectUri = `${window.location.origin}/api/auth/wechat/callback`;
  window.location.href = getWechatAuthUrl(redirectUri);
};
```

---

## 六、SSE 流式通信方案

### 6.1 EventSource 封装（含重连）

```typescript
// lib/sse-handler.ts
export type SSEEventType = 'message' | 'tool_call' | 'done' | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: string;
}

export class SSEConnection {
  private eventSource: EventSource | null = null;
  private url: string;
  private onMessage: (event: SSEEvent) => void;
  private onError: (err: Error) => void;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(
    url: string,
    onMessage: (event: SSEEvent) => void,
    onError: (err: Error) => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onError = onError;
  }

  connect(token: string) {
    const urlWithAuth = `${this.url}?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(urlWithAuth);

    this.eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as SSEEvent;
        this.onMessage(parsed);
      } catch {
        this.onMessage({ type: 'message', data: e.data });
      }
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.connect(token), 1000 * this.retryCount);
      } else {
        this.onError(new Error('SSE connection failed after retries'));
      }
    };
  }

  close() {
    this.eventSource?.close();
    this.eventSource = null;
    this.retryCount = 0;
  }
}
```

### 6.2 流事件类型处理

```typescript
// hooks/useSSE.ts
import { useState, useEffect, useCallback } from 'react';
import { SSEConnection } from '@/lib/sse-handler';
import { config } from '@/config';
import { useAuthStore } from '@/stores/auth.store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; status: string }>;
}

export function useSSE(threadId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!threadId || !token) return;

    const url = `${config.apiBaseUrl}/chat/stream/${threadId}`;
    const conn = new SSEConnection(
      url,
      (event) => {
        switch (event.type) {
          case 'message':
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + event.data },
                ];
              }
              return [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: event.data,
                },
              ];
            });
            break;
          case 'tool_call':
            // 解析 tool call 并更新 UI
            break;
          case 'done':
            setIsStreaming(false);
            break;
          case 'error':
            setError(event.data);
            setIsStreaming(false);
            break;
        }
      },
      (err) => {
        setError(err.message);
        setIsStreaming(false);
      }
    );

    conn.connect(token);
    return () => conn.close();
  }, [threadId, token]);

  const sendMessage = useCallback(async (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content },
    ]);
    setIsStreaming(true);
    setError(null);
    // 实际发送由 ChatInput 调用 API
  }, []);

  return { messages, isStreaming, error, sendMessage };
}
```

### 6.3 错误处理与重试

- 网络断开：自动重连，指数退避（1s、2s、3s）
- 401：清除 token，跳转登录
- 5xx：提示用户稍后重试，支持手动重试

---

## 七、状态管理设计

### 7.1 Zustand Store 结构

```typescript
// stores/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: string; phone?: string } | null;
  login: (params: { phone: string; code: string }) => Promise<void>;
  logout: () => void;
  sendSmsCode: (phone: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async ({ phone, code }) => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ phone, code }),
        });
        const data = await res.json();
        set({ token: data.token, user: data.user });
      },
      logout: () => set({ token: null, user: null }),
      sendSmsCode: async (phone) => {
        await fetch('/api/auth/send-code', {
          method: 'POST',
          body: JSON.stringify({ phone }),
        });
      },
    }),
    { name: 'auth-storage' }
  )
);
```

```typescript
// stores/chat.store.ts
import { create } from 'zustand';

interface ChatState {
  threads: Array<{ id: string; title: string; updatedAt: string }>;
  activeThreadId: string | null;
  setActiveThread: (id: string | null) => void;
  addThread: (thread: { id: string; title: string; updatedAt: string }) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  threads: [],
  activeThreadId: null,
  setActiveThread: (id) => set({ activeThreadId: id }),
  addThread: (thread) =>
    set((s) => ({ threads: [thread, ...s.threads] })),
}));
```

```typescript
// stores/knowledge.store.ts
import { create } from 'zustand';

interface KnowledgeState {
  uploadDocument: (file: File) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    await fetch('/api/knowledge/upload', {
      method: 'POST',
      body: formData,
    });
  },
}));
```

### 7.2 TanStack Query 缓存策略

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 分钟
      gcTime: 5 * 60 * 1000,     // 5 分钟 (原 cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// 对话列表：staleTime 30s
// 知识库文档：有 processing 时 refetchInterval 3s
// 用户信息：staleTime 5min
```

---

## 八、API 请求层

### 8.1 Axios 实例与拦截器

```typescript
// lib/api-client.ts
import axios, { AxiosError } from 'axios';
import { config } from '@/config';

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((req) => {
  const token = typeof window !== 'undefined' && localStorage.getItem('auth-storage');
  if (token) {
    try {
      const parsed = JSON.parse(token);
      req.headers.Authorization = `Bearer ${parsed.state?.token}`;
    } catch {}
  }
  return req;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      // 尝试 refresh token 或跳转登录
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const chatApi = {
  createThread: () => api.post<{ threadId: string }>('/chat/threads'),
  sendMessage: (threadId: string, content: string) =>
    api.post(`/chat/threads/${threadId}/messages`, { content }),
};

export const knowledgeApi = {
  listBases: () => api.get('/knowledge/bases'),
  listDocuments: () => api.get('/knowledge/documents'),
  upload: (formData: FormData) => api.post('/knowledge/documents', formData),
};
```

### 8.2 JWT Token 自动刷新

```typescript
// 在 response 拦截器中
if (err.response?.status === 401 && !err.config._retry) {
  err.config._retry = true;
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken });
    setToken(data.token);
    err.config.headers.Authorization = `Bearer ${data.token}`;
    return api(err.config);
  }
}
```

### 8.3 统一错误处理

```typescript
// lib/error-handler.ts
export function handleApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message ?? err.message;
    if (err.response?.status === 429) return '请求过于频繁，请稍后再试';
    if (err.response?.status >= 500) return '服务暂时不可用，请稍后再试';
    return msg;
  }
  return '未知错误';
}
```

---

## 九、性能优化

### 9.1 Next.js App Router SSR/SSG 策略

```tsx
// 静态页面：知识库列表骨架
// app/(main)/knowledge/page.tsx - 使用 loading.tsx
// app/(main)/knowledge/loading.tsx
export default function Loading() {
  return <DocumentListSkeleton />;
}

// 动态页面：对话页必须 client
// app/(main)/chat/[threadId]/page.tsx - 'use client'

// 预加载关键路由
// app/layout.tsx
import { prefetch } from '@tanstack/react-query';
<link rel="prefetch" href="/chat/new" />
```

### 9.2 图片优化

```tsx
// 使用 next/image
import Image from 'next/image';

<Image
  src="/avatar.png"
  alt="avatar"
  width={40}
  height={40}
  placeholder="blur"
/>
```

### 9.3 Code Splitting

```tsx
// 动态导入重型组件
import dynamic from 'next/dynamic';

const MarkdownRenderer = dynamic(
  () => import('@/components/chat/MarkdownRenderer'),
  { ssr: false, loading: () => <Skeleton className="h-20" /> }
);
```

---

## 十、部署方案

### 10.1 Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### 10.2 next.config.js 启用 standalone

```javascript
const nextConfig = {
  output: 'standalone',  // 用于 Docker 部署
  // ...
};
```

### 10.3 Static Export 选项（CDN）

```javascript
// 若为纯静态站点
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

```bash
npm run build:prod
# 输出到 out/ 目录，可部署至 CDN
```

---

## 附录：类型定义

```typescript
// types/index.ts
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  createdAt?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: unknown;
}

export interface Document {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}
```
