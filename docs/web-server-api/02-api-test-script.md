# API 快速测试脚本

此脚本用于快速验证 Web 与 Server 的接口联调状态。

## 使用方法

### 1. 启动 Server

```bash
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

### 2. 运行测试脚本

将以下脚本保存为 `test-api.sh` 并运行:

```bash
#!/bin/bash

SERVER_URL="http://localhost:8081"
ORIGIN="http://localhost:3000"

echo "============================================"
echo "ThinkAgent Web-Server API 联调测试"
echo "============================================"
echo ""

# 1. 健康检查
echo "1. 健康检查..."
HEALTH=$(curl -s $SERVER_URL/health)
echo "$HEALTH"
echo ""

# 2. 发送验证码
echo "2. 发送验证码..."
SEND_CODE=$(curl -s -X POST $SERVER_URL/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"phone":"13800138000"}')
echo "$SEND_CODE"
echo ""

# 3. 登录
echo "3. 用户登录..."
LOGIN_RESULT=$(curl -s -X POST $SERVER_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{"phone":"13800138000","code":"000000"}')
echo "$LOGIN_RESULT"

# 提取 token
TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，未获取到 token"
  exit 1
fi
echo "✓ Token 获取成功"
echo ""

# 4. 获取用户信息
echo "4. 获取用户信息..."
PROFILE=$(curl -s -X GET $SERVER_URL/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $ORIGIN")
echo "$PROFILE"
echo ""

# 5. 创建会话
echo "5. 创建会话..."
THREAD=$(curl -s -X POST $SERVER_URL/api/v1/threads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $ORIGIN" \
  -d '{"title":"测试会话"}')
echo "$THREAD"

THREAD_ID=$(echo "$THREAD" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ 会话 ID: $THREAD_ID"
echo ""

# 6. 获取会话列表
echo "6. 获取会话列表..."
curl -s -X GET "$SERVER_URL/api/v1/threads?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $ORIGIN"
echo ""
echo ""

# 7. 创建知识库
echo "7. 创建知识库..."
KB=$(curl -s -X POST $SERVER_URL/api/v1/knowledge-bases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $ORIGIN" \
  -d '{"name":"测试知识库","description":"测试描述"}')
echo "$KB"

KB_ID=$(echo "$KB" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ 知识库 ID: $KB_ID"
echo ""

# 8. 获取知识库列表
echo "8. 获取知识库列表..."
curl -s -X GET "$SERVER_URL/api/v1/knowledge-bases?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $ORIGIN"
echo ""

echo ""
echo "============================================"
echo "测试完成"
echo "============================================"
```

## 测试检查清单

- [ ] 健康检查返回 healthy
- [ ] 发送验证码返回 success
- [ ] 登录返回 token
- [ ] 获取用户信息返回用户数据
- [ ] 创建会话返回会话 ID
- [ ] 获取会话列表返回会话数据
- [ ] 创建知识库返回知识库 ID
- [ ] 获取知识库列表返回知识库数据

## 预期输出

```
============================================
ThinkAgent Web-Server API 联调测试
============================================

1. 健康检查...
{"status":"healthy","checks":{"database":"ok","redis":"ok"}}

2. 发送验证码...
{"success":true,"message":"Verification code sent"}

3. 用户登录...
{"success":true,"data":{"token":"eyJhbGci...","isNew":true}}
✓ Token 获取成功

4. 获取用户信息...
{"success":true,"data":{...}}

5. 创建会话...
{"success":true,"data":{...}}
✓ 会话 ID: xxx

6. 获取会话列表...
{"success":true,"data":{...}}

7. 创建知识库...
{"success":true,"data":{...}}
✓ 知识库 ID: xxx

8. 获取知识库列表...
{"success":true,"data":{...}}

============================================
测试完成
============================================
```

## 常见问题

### 1. 端口被占用

如果端口 8081 被占用，可以修改 `packages/server/.env` 中的 `PORT` 为其他端口。

### 2. 数据库连接失败

确保 PostgreSQL 容器正在运行:
```bash
docker ps | grep thinkagent-db
```

### 3. Redis 连接失败

确保 Redis 正在运行:
```bash
redis-cli ping
```

### 4. CORS 错误

检查 Server 的 CORS 配置是否包含对应的 Origin。

### 5. 验证码无效

开发环境支持使用 `000000` 作为通用验证码。
