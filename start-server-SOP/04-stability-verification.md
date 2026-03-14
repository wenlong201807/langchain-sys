# 稳定性验证指南

本文档提供部署后的稳定性验证检查项和监控方案。

## 验证检查清单

### 1. 服务健康检查

#### 1.1 应用服务

```bash
# 检查应用是否正常响应
curl -f http://localhost:8080/health

# 预期返回 JSON，例如：
# {"status":"ok","uptime":12345}
```

#### 1.2 数据库连接

```bash
# 检查数据库连接
docker-compose exec thinkagent-app sh -c 'nc -z thinkagent-db 5432 && echo "OK"'

# 或使用 psql 测试
docker-compose exec thinkagent-db psql -U thinkagent -d thinkagent -c "SELECT 1;"
```

#### 1.3 Redis 连接

```bash
# 检查 Redis 连接
docker-compose exec thinkagent-app sh -c 'nc -z thinkagent-redis 6379 && echo "OK"'

# 或使用 redis-cli
docker-compose exec thinkagent-redis redis-cli ping
# 应返回 PONG
```

### 2. 功能验证

#### 2.1 API 接口测试

```bash
# 测试认证接口
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"test123456"}'

# 测试登录接口
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"test123456"}'
```

#### 2.2 管理后台接口

```bash
# 测试管理员登录
curl -X POST http://localhost:8080/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 3. 性能验证

#### 3.1 响应时间

```bash
# 测试响应时间
time curl -o /dev/null -s -w "%{http_code}\n%{time_total}s\n" http://localhost:8080/health
```

| 指标 | 预期值 | 告警阈值 |
|------|--------|----------|
| 健康检查响应时间 | < 100ms | > 500ms |
| API 平均响应时间 | < 200ms | > 1s |

#### 3.2 并发测试

```bash
# 使用 ab 进行并发测试
ab -n 100 -c 10 http://localhost:8080/health
```

#### 3.3 内存使用

```bash
# 检查容器内存使用
docker stats --no-stream thinkagent-app

# 或查看详细内存信息
docker inspect thinkagent-app --format='{{.MemoryStats}}'
```

### 4. 数据完整性

#### 4.1 数据库表结构

```bash
# 连接数据库查看表
docker-compose exec thinkagent-db psql -U thinkagent -d thinkagent -c "\dt"

# 预期看到以下表：
# users, threads, messages, knowledge_bases, documents, document_chunks
# admin_users, roles, permissions, audit_logs, system_configs, content_flags
```

#### 4.2 扩展验证

```bash
# 验证 pgvector 扩展
docker-compose exec thinkagent-db psql -U thinkagent -d thinkagent -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

## 监控方案

### 1. Docker Healthcheck

在 `docker-compose.yml` 中配置健康检查：

```yaml
thinkagent-app:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### 2. 日志监控

```bash
# 查看应用日志
docker-compose logs -f --tail=100 thinkagent-app

# 查看错误日志
docker-compose logs thinkagent-app | grep -i error

# 查看最近 1 小时的日志
docker-compose logs --since=1h thinkagent-app
```

### 3. 资源监控

创建监控脚本 `monitor.sh`:

```bash
#!/bin/bash

# 监控脚本

APP_URL="http://localhost:8080/health"
THRESHOLD_CPU=80
THRESHOLD_MEM=80

# 检查应用健康
check_health() {
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL)
    if [ "$HTTP_CODE" != "200" ]; then
        echo "[ALERT] Application health check failed! HTTP: $HTTP_CODE"
        return 1
    fi
    echo "[OK] Application is healthy"
    return 0
}

# 检查资源使用
check_resources() {
    CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" thinkagent-app | sed 's/%//')
    MEM=$(docker stats --no-stream --format "{{.MemPerc}}" thinkagent-app | sed 's/%//')
    
    if (( $(echo "$CPU > $THRESHOLD_CPU" | bc -l) )); then
        echo "[ALERT] High CPU usage: $CPU%"
    fi
    
    if (( $(echo "$MEM > $THRESHOLD_MEM" | bc -l) )); then
        echo "[ALERT] High Memory usage: $MEM%"
    fi
}

# 运行检查
check_health
check_resources
```

添加到 crontab 每分钟执行：

```bash
*/1 * * * * /opt/thinkagent-deploy/monitor.sh >> /var/log/thinkagent-monitor.log 2>&1
```

## 故障排查

### 常见问题及解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 502 Bad Gateway | 应用未启动 | `docker-compose restart thinkagent-app` |
| 数据库连接失败 | 数据库未就绪 | 检查 healthcheck 状态 |
| 响应超时 | 资源不足 | 扩展容器资源 |
| 内存持续增长 | 内存泄漏 | 重启容器并排查代码 |

### 紧急恢复

```bash
# 1. 停止服务
docker-compose stop

# 2. 查看错误日志
docker-compose logs thinkagent-app > error.log

# 3. 重启所有服务
docker-compose restart

# 4. 如果需要，重建容器
docker-compose up -d --force-recreate
```

## 验证报告模板

部署完成后，填写以下验证报告：

```
# 部署验证报告

## 基本信息
- 部署时间: 
- 部署版本: 
- 部署环境: 

## 验证结果

### 1. 服务健康
- [ ] 应用健康检查通过
- [ ] 数据库连接正常
- [ ] Redis 连接正常

### 2. 功能测试
- [ ] 用户注册接口正常
- [ ] 用户登录接口正常
- [ ] 管理员登录正常

### 3. 性能指标
- 响应时间: XXms
- CPU 使用率: XX%
- 内存使用率: XX%

### 4. 日志检查
- [ ] 无 ERROR 级别日志
- [ ] 无异常堆栈

## 结论
- [ ] 验证通过，可以上线
- [ ] 存在问题，需要修复

## 备注
```
