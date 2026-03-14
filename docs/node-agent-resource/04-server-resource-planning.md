# 2 核 2.5G 40G 服务器资源规划与稳定性保障

## 一、硬件约束分析

```
┌────────────────────────────────────────┐
│          硬件资源总览                    │
│                                         │
│  CPU:  2 核                             │
│  RAM:  2.5 GB (2560 MB)                │
│  Disk: 40 GB                            │
│  带宽: 假设 5Mbps（典型云服务器）          │
│                                         │
│  等级: 入门级云服务器                     │
│  适合: MVP 验证 / 50-100 DAU            │
│  极限: ~50 并发 SSE 连接                 │
└────────────────────────────────────────┘
```

### 资源瓶颈优先级

| 优先级 | 资源 | 瓶颈原因 | 影响 |
|--------|------|---------|------|
| P0 | 内存 2.5G | 所有服务争抢内存，OOM Kill 风险 | 服务崩溃 |
| P1 | 磁盘 40G | Docker 镜像 + PG 数据 + 日志快速消耗 | 服务停止 |
| P2 | CPU 2 核 | AI Agent 调用不吃本地 CPU，但构建时满载 | 响应慢 |
| P3 | 带宽 5Mbps | SSE 流式推送 + 文件上传 | 用户体验差 |

---

## 二、内存精细规划

### 2.1 服务内存分配表

```
总可用内存: 2560 MB
                                          ┌─ Nginx        20 MB
                                          ├─ App (Fastify) 300 MB
                                          ├─ Worker        150 MB
                   ┌─ 应用服务 (820 MB) ──┤
                   │                      ├─ n8n          200 MB
                   │                      └─ Redis         50 MB + 缓冲 100MB
                   │
2560 MB ──────────┤
                   │                      ┌─ PG Server    200 MB
                   ├─ 数据库 (256 MB) ───┤
                   │                      └─ shared_buf   128 MB (含在 200 内)
                   │
                   ├─ 操作系统 (250 MB) ── OS + Docker Engine
                   │
                   ├─ Swap (2048 MB) ──── 应急缓冲（磁盘）
                   │
                   └─ 空闲缓冲 (~1234 MB) ─ 文件缓存 + 突发 + Jenkins 按需
```

### 2.2 每个服务的内存限制策略

| 服务 | 软限制 | 硬限制 | OOM 优先级 | 说明 |
|------|--------|--------|-----------|------|
| PostgreSQL | 200MB | 256MB | 最低（最后被杀） | 数据库不能死 |
| Redis | 40MB | 60MB | 低 | maxmemory + LRU 淘汰 |
| Nginx | 15MB | 30MB | 低 | 几乎不占内存 |
| App (Fastify) | 250MB | 350MB | 中 | 可重启恢复 |
| Worker | 120MB | 180MB | 中高 | 可延迟处理 |
| n8n | 180MB | 250MB | 高（先杀） | 非核心，可降级 |
| Jenkins | - | 600MB | 仅按需启动 | 构建时启动 |

### 2.3 Node.js 内存调优

```bash
# App 容器启动命令
node --max-old-space-size=300 \
     --max-semi-space-size=16 \
     --optimize-for-size \
     dist/app.js

# Worker 容器启动命令
node --max-old-space-size=150 \
     --max-semi-space-size=8 \
     --optimize-for-size \
     dist/worker.js
```

**应用层内存优化措施：**

```typescript
// 1. SSE 连接数限制
const MAX_SSE_CONNECTIONS = 30; // 限制同时在线的 SSE 连接

// 2. LangChain Agent 配置优化
const agent = createAgent({
  model: await initChatModel("openai:gpt-4o", {
    maxRetries: 2,
    timeout: 30000,
  }),
  tools,
  checkpointer: postgresSaver,
  // 限制上下文长度以控制内存
});

// 3. 流式处理不缓存完整响应
// 逐 chunk 写入 SSE，不在内存中累积

// 4. 文件上传直传 OSS，不经过 Node.js 内存
// 使用 presigned URL，客户端直传

// 5. BullMQ 队列限制
const documentQueue = new Queue('document-processing', {
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 100, // 仅保留最近 100 个完成任务
    removeOnFail: 50,
  },
});
```

---

## 三、CPU 使用规划

### 3.1 CPU 消耗分析

| 操作 | CPU 消耗 | 频率 | 优化措施 |
|------|---------|------|---------|
| AI 对话请求 | 低（等待外部 API 返回） | 高 | 异步 I/O，无需优化 |
| 文档向量化 | 中（Embedding API 调用） | 中 | BullMQ 限制并发 = 1 |
| 文档解析 (PDF) | 高（CPU 密集） | 低 | Worker 单并发处理 |
| Docker 构建 | 极高（满载） | 低 | 非高峰时段构建 |
| Prisma 查询 | 低 | 高 | 连接池 + 索引优化 |
| Nginx SSL | 低 | 高 | SSL session 缓存 |

### 3.2 CPU 争抢防护

```bash
# docker-compose.yml 中限制 CPU
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'    # 最多用 1 核
  worker:
    deploy:
      resources:
        limits:
          cpus: '0.5'    # 最多用半核
  postgres:
    deploy:
      resources:
        limits:
          cpus: '0.8'
  n8n:
    deploy:
      resources:
        limits:
          cpus: '0.3'
```

---

## 四、磁盘空间管理

### 4.1 空间使用预估（6 个月增长）

| 项目 | 初始 | 3 个月 | 6 个月 | 说明 |
|------|------|--------|--------|------|
| 操作系统 | 3 GB | 3 GB | 3 GB | 稳定 |
| Docker 镜像 | 2 GB | 3 GB | 3 GB | 定期清理 |
| PostgreSQL 数据 | 0.1 GB | 2 GB | 5 GB | 含向量数据 |
| Redis 数据 | 0.01 GB | 0.1 GB | 0.2 GB | LRU 淘汰 |
| 应用日志 | 0 | 1 GB | 2 GB | 定期轮转 |
| Jenkins 数据 | 1 GB | 2 GB | 3 GB | 定期清理 |
| n8n 数据 | 0.1 GB | 0.5 GB | 1 GB | 执行记录裁剪 |
| Swap 文件 | 2 GB | 2 GB | 2 GB | 固定 |
| 备份临时 | 0 | 2 GB | 3 GB | 上传 OSS 后删 |
| **总计** | **~8 GB** | **~16 GB** | **~22 GB** | 40G 够用 6 个月 |
| **剩余** | **~32 GB** | **~24 GB** | **~18 GB** | 安全 |

### 4.2 自动清理策略

```bash
#!/bin/bash
# scripts/disk-cleanup.sh (由 n8n 每周触发)

echo "=== 磁盘清理开始: $(date) ==="

# 1. Docker 清理
docker system prune -f --filter "until=72h"
docker image prune -f --filter "dangling=true"

# 2. 应用日志清理（保留 7 天）
find /var/log/nginx -name "*.log" -mtime +7 -delete
docker compose logs --no-log-prefix app 2>&1 | tail -n 0 # 触发日志轮转

# 3. PG WAL 清理
docker exec ta-postgres psql -U thinkagent -c "SELECT pg_size_pretty(pg_database_size('thinkagent'));"

# 4. 临时文件清理
find /tmp -type f -mtime +1 -delete

# 5. Jenkins 旧构建清理（保留最近 10 次）
# 由 Jenkins 自身配置管理

# 6. 报告
echo "磁盘使用情况:"
df -h /
echo ""
echo "Docker 空间使用:"
docker system df

echo "=== 磁盘清理完成 ==="
```

---

## 五、网络与带宽规划

### 5.1 带宽消耗估算

| 场景 | 单次流量 | 每秒峰值 | 说明 |
|------|---------|---------|------|
| SSE 流式回复 | ~2-10 KB/消息 | ~50 KB/s (10 并发) | token 逐个推送 |
| API 请求/响应 | ~1-5 KB | ~100 KB/s | JSON 数据 |
| 文件上传 | 1-20 MB | 直传 OSS，不过服务器 | presigned URL |
| 静态资源 | 100-500 KB | CDN 分发 | 不走服务器 |
| 数据库备份上传 | 10-100 MB | 非高峰时段 | 凌晨执行 |

> 5 Mbps (~625 KB/s) 对于 50 DAU + SSE 流式足够。文件上传走 OSS 直传是关键优化。

### 5.2 Nginx 优化

```nginx
# 针对低带宽优化

# 开启 gzip
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript
           text/xml application/xml application/xml+rss text/javascript
           text/event-stream;
gzip_min_length 256;

# 开启 brotli（如果安装了模块）
# brotli on;
# brotli_comp_level 6;

# 静态资源强缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
    expires 365d;
    add_header Cache-Control "public, immutable";
}

# 限制单连接带宽（防止单用户占满）
limit_rate 512k;          # 单连接限速 512KB/s
limit_rate_after 1m;       # 前 1MB 不限速
```

---

## 六、稳定性保障措施

### 6.1 OOM 防护

```bash
# 1. 系统级 OOM 调优
# 保护关键进程不被 OOM Killer 杀死
echo -1000 > /proc/$(docker inspect --format '{{.State.Pid}}' ta-postgres)/oom_score_adj

# 2. Docker 内存硬限制（已在 compose 中配置）
# 容器超限会被 Docker 重启，而不是触发系统级 OOM

# 3. 内存监控告警（n8n 工作流）
# 当可用内存 < 200MB 时告警
```

### 6.2 服务健康检查与自动恢复

```yaml
# 所有服务配置 restart: always + healthcheck
# Docker 会在容器不健康时自动重启

# 健康检查间隔：
# PostgreSQL: 10s 检查一次
# Redis: 10s
# App: 30s
# Worker: 30s
# Nginx: 依赖 App 健康
```

### 6.3 数据安全

```
备份策略（n8n 自动化）：

每日备份 (凌晨 3:00)：
  ├─ PostgreSQL: pg_dump --compress=9 → 上传 OSS → 删除本地
  ├─ Redis: RDB 快照已开启（save 60 1000）
  └─ 保留周期：OSS 保留 30 天

紧急恢复步骤：
  1. docker compose down
  2. 从 OSS 下载最近备份
  3. docker compose up -d postgres redis
  4. pg_restore 恢复数据
  5. docker compose up -d
  预计恢复时间：< 30 分钟
```

### 6.4 降级策略

当服务器资源紧张时的降级方案：

| 级别 | 触发条件 | 降级动作 |
|------|---------|---------|
| L1 | 内存 > 80% | 停止 n8n，释放 ~250MB |
| L2 | 内存 > 90% | 停止 Worker，文档处理暂停 |
| L3 | 内存 > 95% | 限制 SSE 并发为 10，拒绝新对话 |
| L4 | 磁盘 > 85% | 紧急清理日志和 Docker 缓存 |
| L5 | 磁盘 > 95% | 停止文件上传，只保留对话功能 |

```bash
#!/bin/bash
# scripts/auto-degrade.sh (由 cron 每分钟执行)

MEM_USAGE=$(free | awk '/^Mem:/{printf("%.0f", $3/$2 * 100)}')
DISK_USAGE=$(df / | awk 'NR==2{printf("%.0f", $5)}')

if [ "$MEM_USAGE" -gt 90 ]; then
    echo "[WARN] 内存使用 ${MEM_USAGE}%，停止 Worker"
    docker stop ta-worker 2>/dev/null
    curl -s -X POST "https://n8n.thinkagent.ai/webhook/alert" \
         -d "{\"level\":\"L2\",\"mem\":\"${MEM_USAGE}%\"}"
fi

if [ "$MEM_USAGE" -lt 70 ]; then
    docker start ta-worker 2>/dev/null
fi

if [ "$DISK_USAGE" -gt 85 ]; then
    echo "[WARN] 磁盘使用 ${DISK_USAGE}%，执行清理"
    bash /opt/thinkagent/scripts/disk-cleanup.sh
fi
```

---

## 七、容量估算

### 7.1 用户承载能力

| 指标 | 预估值 | 瓶颈 |
|------|--------|------|
| 注册用户 | 不限 | 仅数据库存储 |
| DAU (日活) | 50-100 | 内存（SSE 连接） |
| 同时在线 | 30-50 | 内存 + CPU |
| 并发 SSE | 20-30 | 内存（每连接 ~5MB） |
| 日对话量 | 500-1000 次 | API 调用成本 |
| 知识库总量 | 100 个 | 磁盘（向量数据） |
| 文档总量 | 1000 个 | 磁盘 + 向量化时间 |

### 7.2 何时需要升级服务器

| 触发条件 | 建议升级到 |
|---------|----------|
| DAU > 100 | 4 核 8G |
| 并发 SSE > 30 | 4 核 8G |
| PG 数据 > 10GB | 扩磁盘或 RDS |
| 需要多人同时构建 | 独立 Jenkins 服务器 |
| 团队版上线 | 4 核 8G + RDS + Redis 云版 |

---

## 八、监控面板（n8n 实现）

```
每 5 分钟采集一次，推送到 n8n：

系统指标：
├─ CPU 使用率 (%)
├─ 内存使用率 (%)
├─ Swap 使用率 (%)
├─ 磁盘使用率 (%)
├─ 网络 I/O (KB/s)
└─ 系统负载 (load average)

应用指标：
├─ App 容器状态 (running/stopped)
├─ Worker 容器状态
├─ 活跃 SSE 连接数
├─ API 请求量 (RPM)
├─ 平均响应时间 (ms)
└─ 错误率 (%)

数据库指标：
├─ PG 连接数 / 最大连接数
├─ PG 数据库大小
├─ Redis 内存使用 / 最大内存
└─ Redis 连接数

采集脚本：scripts/collect-metrics.sh
数据存储：n8n 内部 / 写入 PG metrics 表
告警通道：企业微信 / 飞书 / Discord Webhook
```
