# LangChain.js 安装指南

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/install

## 系统要求

- **Node.js**: 20+ (必须)
- **Bun**: v1.0.0+ (可选替代)

## 安装核心包

使用你偏好的包管理器安装 LangChain 核心包:

```bash
# npm
npm install langchain @langchain/core

# pnpm
pnpm add langchain @langchain/core

# yarn
yarn add langchain @langchain/core

# bun
bun add langchain @langchain/core
```

## 安装模型提供商集成

LangChain 提供了数百个 LLM 和数千个其他集成，它们以独立的提供商包形式存在:

### OpenAI

```bash
npm install @langchain/openai
```

### Anthropic (Claude)

```bash
npm install @langchain/anthropic
```

### Google Gemini

```bash
npm install @langchain/google-genai
```

### Azure OpenAI

```bash
npm install @langchain/azure
```

### AWS Bedrock

```bash
npm install @langchain/aws
```

## 配置环境变量

根据所使用的模型提供商，设置相应的 API Key:

```bash
# OpenAI
export OPENAI_API_KEY="your-api-key"

# Anthropic
export ANTHROPIC_API_KEY="your-api-key"

# Google
export GOOGLE_API_KEY="your-api-key"

# Azure
export AZURE_OPENAI_API_KEY="your-api-key"
export AZURE_OPENAI_ENDPOINT="your-endpoint"
export OPENAI_API_VERSION="your-api-version"
```

推荐使用 `.env` 文件管理环境变量:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_xxxxx
```

## 安装 LangGraph (可选)

如果需要使用 Agent 的持久化和记忆功能:

```bash
npm install @langchain/langgraph
```

## 安装 LangSmith (可选，推荐)

LangSmith 用于追踪请求、调试 Agent 行为和评估输出:

```bash
# 设置环境变量即可启用
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY="your-langsmith-api-key"
```

## 项目初始化模板

### TypeScript 项目

```bash
mkdir my-langchain-app && cd my-langchain-app
npm init -y
npm install langchain @langchain/core @langchain/openai typescript tsx
npx tsc --init
```

### package.json 示例

```json
{
  "name": "my-langchain-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "langchain": "^1.0.0",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.5.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

### tsconfig.json 示例

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

## 验证安装

创建 `src/index.ts`:

```typescript
import { initChatModel } from "langchain";

const model = await initChatModel("gpt-4.1");
const response = await model.invoke("Hello! Can you introduce yourself?");
console.log(response.text);
```

运行:

```bash
npx tsx src/index.ts
```

## 完整集成列表

访问 [Integrations](https://docs.langchain.com/oss/javascript/integrations/providers/overview) 查看所有可用的集成。
