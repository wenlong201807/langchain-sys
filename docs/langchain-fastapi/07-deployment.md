# Docker / Kubernetes 部署指南

## 一、Docker 部署

### 1. Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app/ ./app/

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 2. .dockerignore

```
__pycache__
*.pyc
.env
.venv
.git
.gitignore
*.md
tests/
.mypy_cache
.pytest_cache
```

### 3. docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      - APP_ENV=production
    depends_on:
      - postgres
      - redis
      - chromadb
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: langchain_app
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    volumes:
      - chroma_data:/chroma/chroma

volumes:
  postgres_data:
  redis_data:
  chroma_data:
```

### 4. 构建与运行

```bash
# 构建镜像
docker build -t fastapi-langchain-app .

# 单独运行
docker run -p 8000:8000 --env-file .env fastapi-langchain-app

# 使用 docker-compose
docker-compose up -d

# 查看日志
docker-compose logs -f api

# 停止服务
docker-compose down
```

## 二、多阶段构建（优化镜像）

```dockerfile
# 构建阶段
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# 运行阶段
FROM python:3.11-slim AS runner

WORKDIR /app

COPY --from=builder /install /usr/local
COPY app/ ./app/

RUN adduser --disabled-password --no-create-home appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

## 三、Kubernetes 部署

### 1. Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fastapi-langchain
  labels:
    app: fastapi-langchain
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fastapi-langchain
  template:
    metadata:
      labels:
        app: fastapi-langchain
    spec:
      containers:
        - name: api
          image: your-registry/fastapi-langchain-app:latest
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: langchain-secrets
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
```

### 2. Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: fastapi-langchain-service
spec:
  selector:
    app: fastapi-langchain
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
  type: ClusterIP
```

### 3. Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fastapi-langchain-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: fastapi-langchain-service
                port:
                  number: 80
```

### 4. Secret

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: langchain-secrets
type: Opaque
stringData:
  OPENAI_API_KEY: "sk-xxxxx"
  ANTHROPIC_API_KEY: "sk-ant-xxxxx"
  DATABASE_URL: "postgresql://user:pass@postgres:5432/db"
```

### 5. 部署命令

```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# 查看状态
kubectl get pods -l app=fastapi-langchain
kubectl logs -f deployment/fastapi-langchain

# 扩缩容
kubectl scale deployment fastapi-langchain --replicas=5
```

## 四、云平台部署

### AWS (ECS Fargate)

```bash
# 推送镜像到 ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag fastapi-langchain-app:latest <account>.dkr.ecr.<region>.amazonaws.com/fastapi-langchain:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/fastapi-langchain:latest
```

### Google Cloud Run

```bash
gcloud run deploy fastapi-langchain \
  --image gcr.io/<project>/fastapi-langchain:latest \
  --platform managed \
  --port 8000 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars "OPENAI_API_KEY=sk-xxxxx"
```

### Azure Container Apps

```bash
az containerapp create \
  --name fastapi-langchain \
  --resource-group mygroup \
  --image your-registry/fastapi-langchain:latest \
  --target-port 8000 \
  --env-vars "OPENAI_API_KEY=sk-xxxxx"
```

## 五、生产环境 Checklist

| 项目 | 说明 |
|------|------|
| API Key 安全 | 使用环境变量/Secret Manager，不要硬编码 |
| CORS 配置 | 生产环境限制 allowed_origins |
| 速率限制 | 使用 slowapi 或 Nginx 限流 |
| 日志记录 | 结构化日志，集成 ELK/CloudWatch |
| 监控告警 | Prometheus + Grafana / CloudWatch |
| 健康检查 | /health 端点 + LLM 连通性检查 |
| LangSmith | 启用追踪用于调试和评估 |
| 错误处理 | 全局异常处理器 + 降级策略 |
| 缓存 | Redis 缓存常见查询结果 |
| 超时设置 | LLM 调用超时 + 全局请求超时 |
