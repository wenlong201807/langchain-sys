# 快速验证脚本

使用此脚本可以快速验证 Server 与各端的连接。

## 验证脚本

```bash
#!/bin/bash

SERVER_URL="http://localhost:8081"

echo "========================================"
echo "ThinkAgent API 快速验证"
echo "========================================"
echo ""

# 1. 健康检查
echo "1. 健康检查..."
HEALTH=$(curl -s $SERVER_URL/health)
echo "$HEALTH"
echo ""

# 2. Web 端 CORS
echo "2. Web 端 CORS (localhost:3000)..."
curl -s -I -X OPTIONS $SERVER_URL/api/v1/auth/send-code \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -w "\nHTTP Status: %{http_code}\n" 2>&1 | grep -E "access-control|HTTP Status"
echo ""

# 3. Mobile 端 CORS
echo "3. Mobile 端 CORS (localhost:8080)..."
curl -s -I -X OPTIONS $SERVER_URL/api/v1/auth/send-code \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: POST" \
  -w "\nHTTP Status: %{http_code}\n" 2>&1 | grep -E "access-control|HTTP Status"
echo ""

# 4. Admin 端 CORS
echo "4. Admin 端 CORS (localhost:3005)..."
curl -s -I -X OPTIONS $SERVER_URL/api/admin/v1/auth/login \
  -H "Origin: http://localhost:3005" \
  -H "Access-Control-Request-Method: POST" \
  -w "\nHTTP Status: %{http_code}\n" 2>&1 | grep -E "access-control|HTTP Status"
echo ""

# 5. API 功能测试
echo "5. API 功能测试 (发送验证码)..."
RESULT=$(curl -s -X POST $SERVER_URL/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"phone":"13800138000"}')
echo "$RESULT"
echo ""

# 6. Admin 登录测试
echo "6. Admin 登录测试..."
RESULT=$(curl -s -X POST $SERVER_URL/api/admin/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3005" \
  -d '{"username":"admin","password":"admin123"}')
echo "$RESULT"
echo ""

echo "========================================"
echo "验证完成"
echo "========================================"
```

## 使用方法

1. 保存脚本为 `verify-api.sh`
2. 运行脚本:
```bash
chmod +x verify-api.sh
./verify-api.sh
```

## 预期输出

```
========================================
ThinkAgent API 快速验证
========================================

1. 健康检查...
{"status":"healthy","checks":{"database":"ok","redis":"ok"}}

2. Web 端 CORS (localhost:3000)...
access-control-allow-origin: http://localhost:3000
HTTP Status: 204

3. Mobile 端 CORS (localhost:8080)...
access-control-allow-origin: http://localhost:8080
HTTP Status: 204

4. Admin 端 CORS (localhost:3005)...
access-control-allow-origin: http://localhost:3005
HTTP Status: 204

5. API 功能测试 (发送验证码)...
{"success":true,"message":"Verification code sent"}

6. Admin 登录测试...
{"success":true,"data":{...}}

========================================
验证完成
========================================
```

## 验证检查清单

- [ ] Server 健康检查返回 healthy
- [ ] Web 端 CORS 头包含 `http://localhost:3000`
- [ ] Mobile 端 CORS 头包含 `http://localhost:8080`
- [ ] Admin 端 CORS 头包含 `http://localhost:3005`
- [ ] 发送验证码 API 返回 success
- [ ] Admin 登录 API 返回 token
