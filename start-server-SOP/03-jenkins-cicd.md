# Jenkins CI/CD 部署指南

本文档介绍如何使用 Jenkins 实现 thinkagent-server 的持续集成和持续部署。

## 整体流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Git Push  │───►│   Build     │───►│   Test      │───►│  Deploy     │
│   (触发)    │    │   (构建)    │    │   (测试)    │    │  (部署)     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                   │
                     ┌─────────────────────────────────────────────┘
                     ▼
              ┌─────────────┐
              │  Notify     │
              │  (通知)     │
              └─────────────┘
```

## Jenkins 环境准备

### 1. 安装必要插件

在 Jenkins 管理界面安装以下插件：

- Docker Pipeline
- Pipeline
- Git
- Environment Injector

### 2. 配置 Docker

确保 Jenkins 节点有 Docker 访问权限：

```bash
# 将 jenkins 用户添加到 docker 组
sudo usermod -aG docker jenkins

# 重启 Jenkins 服务
sudo systemctl restart jenkins
```

### 3. 配置凭据

在 Jenkins > Credentials 中添加：

| ID | 类型 | 用途 |
|----|------|------|
| `docker-hub-credentials` | Username with password | Docker Hub 登录 |
| `server-ssh-credentials` | SSH Username with private key | 服务器 SSH 登录 |

## Pipeline 脚本

在项目根目录创建 `Jenkinsfile`:

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_IMAGE = 'thinkagent/server'
        DOCKER_TAG = "${env.BRANCH_NAME == 'main' ? 'latest' : env.BRANCH_NAME}-${env.BUILD_NUMBER}"
        REGISTRY = 'docker.io'
        DEPLOY_HOST = 'your-server-ip'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh '''
                    npm install -g pnpm
                    pnpm install --frozen-lockfile
                '''
            }
        }
        
        stage('Lint & Type Check') {
            steps {
                sh '''
                    cd packages/server
                    pnpm run lint || true
                    pnpm run typecheck || true
                '''
            }
        }
        
        stage('Build Application') {
            steps {
                sh '''
                    cd packages/server
                    pnpm build
                '''
            }
        }
        
        stage('Run Tests') {
            steps {
                sh '''
                    cd packages/server
                    pnpm test || true
                '''
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    def dockerImage = docker.build("${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}")
                }
            }
        }
        
        stage('Push to Registry') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        sh '''
                            echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin ${REGISTRY}
                            docker push ${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}
                            docker logout
                        '''
                    }
                }
            }
        }
        
        stage('Deploy to Server') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sshagent(['server-ssh-credentials']) {
                        sh '''
                            ssh -o StrictHostKeyChecking=no user@${DEPLOY_HOST} << 'EOF'
                                cd /opt/thinkagent-deploy
                                docker-compose pull thinkagent-app
                                docker-compose up -d --no-deps thinkagent-app
                                docker image prune -f
                            EOF
                        '''
                    }
                }
            }
        }
        
        stage('Health Check') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    sleep 10
                    curl -f http://${DEPLOY_HOST}:8080/health || exit 1
                '''
            }
        }
    }
    
    post {
        success {
            echo 'Build and Deploy Successful!'
        }
        failure {
            echo 'Build or Deploy Failed!'
        }
        always {
            cleanWs()
        }
    }
}
```

## 部署配置

### 1. 服务器准备

在目标部署服务器上：

```bash
# 创建部署目录
sudo mkdir -p /opt/thinkagent-deploy
cd /opt/thinkagent-deploy

# 创建 docker-compose.yml (参考 02-docker-deployment.md)
sudo vim docker-compose.yml

# 拉取镜像并启动
docker-compose up -d

# 配置开机自启
sudo systemctl enable docker
```

### 2. 创建 Jenkins Job

1. 新建 > Pipeline
2. 配置 Git 仓库地址
3. 选择 "Pipeline script from SCM"
4. 设置分支: `*/main`

## 环境配置

### 测试环境

```groovy
environment {
    DEPLOY_HOST = 'staging-server-ip'
    NODE_ENV = 'staging'
}
```

### 生产环境

```groovy
environment {
    DEPLOY_HOST = 'production-server-ip'
    NODE_ENV = 'production'
}
```

## 回滚操作

当部署失败时，快速回滚：

```bash
# SSH 到服务器
ssh user@production-server

# 回滚到上一个版本
docker-compose stop thinkagent-app
docker tag ${REGISTRY}/${DOCKER_IMAGE}:previous ${REGISTRY}/${DOCKER_IMAGE}:latest
docker-compose up -d thinkagent-app
```

## 监控与告警

### 日志聚合

```groovy
stage('Deploy') {
    steps {
        sshagent(['server-ssh-credentials']) {
            sh '''
                ssh -o StrictHostKeyChecking=no user@${DEPLOY_HOST} \
                    'docker-compose logs -f --tail=100 thinkagent-app > /tmp/app.log &'
            '''
        }
    }
}
```

### 健康检查

```bash
# 在服务器上配置健康检查脚本
#!/bin/bash
HEALTH=$(curl -s http://localhost:8080/health)
if [ "$HEALTH" != "OK" ]; then
    echo "Health check failed" | mail -s "Alert" admin@example.com
fi
```

## 常见问题

### 权限问题

```bash
# Docker 权限问题
sudo chmod 666 /var/run/docker.sock
```

### 构建超时

在 Jenkinsfile 中增加超时：

```groovy
options {
    timeout(time: 30, unit: 'MINUTES')
}
```

### 磁盘空间不足

```bash
# 在服务器上定期清理
docker system prune -af --volumes
```
