# Web-Server 接口配置说明

本文档说明 Web 端与 Server 端的对接配置。

## Server 配置

### 端口配置

文件: `packages/server/.env`

```bash
PORT=8081
DATABASE_URL=postgresql://thinkagent:thinkagent123@127.0.0.1:5433/thinkagent
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
```

### CORS 配置

文件: `packages/server/src/app.ts`

开发环境允许的跨域来源:

```typescript
const corsOptions = isDev
  ? {
      origin: [
        'http://localhost:3000',    // Web (Next.js)
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3005',    // Admin
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:8080',     // Mobile H5
        'http://localhost:8081',    // Server
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3005',
        'http://127.0.0.1:8081',
      ],
      credentials: true,
    }
  : {
      origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
      credentials: true,
    };
```

## Web 配置

### 环境配置

文件: `packages/web/.env.local`

```bash
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8081/api/v1
```

### API 客户端配置

文件: `packages/web/src/lib/api-client.ts`

```typescript
import axios from 'axios';
import { config } from '@/config';

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((reqConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth-token');
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
  }
  return reqConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth-token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
```

### 认证 Store

文件: `packages/web/src/stores/auth.store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import apiClient from '@/lib/api-client';

interface AuthState {
  token: string | null;
  user: User | null;
  login: (phone: string, code: string) => Promise<void>;
  logout: () => void;
  sendSmsCode: (phone: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      login: async (phone: string, code: string) => {
        const { data } = await apiClient.post('/auth/login', { phone, code });
        const { token, user } = data.data;
        localStorage.setItem('auth-token', token);
        set({ token, user });
      },

      logout: () => {
        localStorage.removeItem('auth-token');
        set({ token: null, user: null });
        window.location.href = '/login';
      },

      sendSmsCode: async (phone: string) => {
        await apiClient.post('/auth/send-code', { phone });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
```

## API 路由说明

### 认证接口

| 路径 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/api/v1/auth/send-code` | POST | 发送验证码 | 否 |
| `/api/v1/auth/login` | POST | 手机号登录 | 否 |
| `/api/v1/auth/profile` | GET | 获取用户信息 | 是 |

### 聊天接口

| 路径 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/api/v1/threads` | POST | 创建会话 | 是 |
| `/api/v1/threads` | GET | 获取会话列表 | 是 |
| `/api/v1/threads/:threadId` | GET | 获取会话详情 | 是 |
| `/api/v1/threads/:threadId` | DELETE | 删除会话 | 是 |
| `/api/v1/threads/:threadId/messages` | POST | 发送消息 (SSE) | 是 |

### 知识库接口

| 路径 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/api/v1/knowledge-bases` | POST | 创建知识库 | 是 |
| `/api/v1/knowledge-bases` | GET | 获取知识库列表 | 是 |
| `/api/v1/knowledge-bases/:kbId` | GET | 获取知识库详情 | 是 |
| `/api/v1/knowledge-bases/:kbId` | PATCH | 更新知识库 | 是 |
| `/api/v1/knowledge-bases/:kbId` | DELETE | 删除知识库 | 是 |

## 启动步骤

### 1. 启动数据库和 Redis

```bash
# 使用 Docker 启动 PostgreSQL
docker run -d --name thinkagent-db \
  -e POSTGRES_USER=thinkagent \
  -e POSTGRES_PASSWORD=thinkagent123 \
  -e POSTGRES_DB=thinkagent \
  -p 5433:5432 \
  postgres:16-alpine

# 启动 Redis (如果未运行)
docker run -d --name thinkagent-redis \
  -p 6380:6379 \
  redis:7-alpine
```

### 2. 初始化数据库

```bash
cd packages/server

# 生成 Prisma Client
pnpm db:generate

# 推送 schema 到数据库
npx prisma db push --accept-data-loss
```

### 3. 启动 Server

```bash
cd packages/server
pnpm dev
```

### 4. 启动 Web

```bash
cd packages/web
pnpm dev
```

## 验证

访问 http://localhost:3000 并尝试:

1. 输入手机号并点击"发送验证码"
2. 输入验证码 `000000` (开发环境通用验证码)
3. 点击登录
4. 创建会话并发送消息

所有操作应能正常完成，无报错。
