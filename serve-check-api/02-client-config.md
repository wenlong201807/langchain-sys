# 各端 API 配置指南

本文档说明如何配置 Web、Mobile、Admin 三个前端项目连接 Server。

## Server 地址

开发环境 Server 地址: `http://localhost:8081`

## 各端配置

### 1. Web 端 (Next.js)

**配置文件**: `packages/web/.env.local`

```bash
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8081/api/v1
```

**启动命令**:
```bash
cd packages/web
pnpm dev
```

访问地址: http://localhost:3000

### 2. Mobile 端 (Uni-app)

**配置文件**: `packages/mobile/src/config/env.ts`

开发环境 (test) 配置:
```typescript
const envConfigs: Record<EnvName, EnvConfig> = {
  test: {
    apiBaseUrl: 'http://localhost:8081/api/v1',
    wsBaseUrl: 'ws://localhost:8081/ws',
    appName: 'ThinkAgent (Test)',
  },
  // ...
};
```

**启动命令**:
```bash
cd packages/mobile
pnpm dev:h5
```

访问地址: http://localhost:8080

### 3. Admin 端 (Vite + React)

**配置文件**: `packages/admin/.env.development`

```bash
VITE_API_BASE_URL=http://localhost:8081/api/admin/v1
VITE_APP_TITLE=ThinkAgent Admin
```

**启动命令**:
```bash
cd packages/admin
pnpm dev
```

访问地址: http://localhost:3005

## 验证步骤

### 1. 启动 Server

```bash
# 确保数据库和 Redis 运行
docker ps | grep thinkagent

# 启动 Server
cd packages/server
pnpm dev
```

Server 启动成功后，访问 http://localhost:8081/health 应返回:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### 2. 验证各端连接

#### Web 端

```bash
# 测试发送验证码接口
curl -X POST http://localhost:8081/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"phone":"13800138000"}'
```

预期响应:
```json
{
  "success": true,
  "message": "Verification code sent"
}
```

#### Mobile 端

```bash
# 测试发送验证码接口
curl -X POST http://localhost:8081/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -d '{"phone":"13800138000"}'
```

预期响应:
```json
{
  "success": true,
  "message": "Verification code sent"
}
```

#### Admin 端

```bash
# 测试管理员登录接口
curl -X POST http://localhost:8081/api/admin/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3005" \
  -d '{"username":"admin","password":"admin123"}'
```

预期响应:
```json
{
  "success": true,
  "data": {
    "token": "..."
  }
}
```

## 常见问题

### 1. CORS 错误

如果遇到 CORS 错误，检查:
1. Server 的 CORS 配置是否包含对应的 origin
2. 各端请求的 Origin header 是否在允许列表中

### 2. 数据库连接失败

如果 API 返回 500 错误，检查:
1. 数据库容器是否运行: `docker ps | grep thinkagent-db`
2. `.env` 文件中的 `DATABASE_URL` 是否正确
3. 数据库迁移是否已执行: `pnpm db:push`

### 3. 端口被占用

如果 Server 启动失败 (端口被占用):
```bash
# 查找占用端口的进程
lsof -i :8081

# 杀死进程
kill -9 <PID>
```

或修改 `.env` 中的 `PORT` 为其他可用端口。
