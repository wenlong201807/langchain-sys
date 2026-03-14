# LangChain.js 完整开发指南 - 概述

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/overview
> GitHub: https://github.com/langchain-ai/langchainjs

## 什么是 LangChain?

LangChain 是一个开源框架，提供预构建的 Agent 架构和集成，支持任意模型或工具，帮助你快速构建由 LLM 驱动的 Agent 和应用程序。

只需不到 10 行代码，即可连接 OpenAI、Anthropic、Google 等模型提供商。

## 核心优势

### 1. 标准模型接口

不同提供商有各自的 API 交互方式（包括响应格式）。LangChain 标准化了与模型的交互方式，让你可以无缝切换提供商，避免供应商锁定。

### 2. 易用且高度灵活的 Agent

LangChain 的 Agent 抽象设计为易于上手，只需不到 10 行代码即可构建一个简单的 Agent，同时提供足够的灵活性进行自定义。

### 3. 基于 LangGraph 构建

LangChain 的 Agent 构建于 LangGraph 之上，可利用 LangGraph 的持久执行、人工介入支持、持久化等特性。

### 4. 使用 LangSmith 调试

通过可视化工具深入了解复杂的 Agent 行为，追踪执行路径、捕获状态转换并提供详细的运行时指标。

## LangChain vs LangGraph vs Deep Agents

| 框架 | 适用场景 | 特点 |
|------|---------|------|
| **LangChain** | 快速构建 Agent 和自主应用 | 预构建的 Agent 架构，简单易用 |
| **LangGraph** | 需要确定性和 Agent 工作流组合的高级需求 | 低级 Agent 编排框架和运行时 |
| **Deep Agents** | 需要"开箱即用"的现代特性 | 自动压缩长对话、虚拟文件系统、子 Agent 生成 |

## 快速示例：创建一个 Agent

```typescript
import * as z from "zod";
import { createAgent, tool } from "langchain";

const getWeather = tool(
  ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string(),
    }),
  },
);

const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [getWeather],
});

console.log(
  await agent.invoke({
    messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
  })
);
```

## 生态系统组成

```
langchain (核心包)
├── @langchain/core          - 核心抽象和运行时
├── @langchain/openai        - OpenAI 集成
├── @langchain/anthropic     - Anthropic 集成
├── @langchain/google-genai  - Google Gemini 集成
├── @langchain/aws           - AWS Bedrock 集成
├── @langchain/azure         - Azure 集成
├── @langchain/langgraph     - LangGraph 运行时
└── deepagents               - Deep Agents 实现
```

## 文档目录

| 文件 | 内容 |
|------|------|
| [02-installation.md](./02-installation.md) | 安装指南 |
| [03-quickstart.md](./03-quickstart.md) | 快速入门教程 |
| [04-models.md](./04-models.md) | 模型使用指南 |
| [05-agents.md](./05-agents.md) | Agent 开发指南 |
| [06-tools.md](./06-tools.md) | 工具开发指南 |
| [07-messages.md](./07-messages.md) | 消息系统 |
| [08-streaming.md](./08-streaming.md) | 流式输出指南 |
| [09-memory.md](./09-memory.md) | 记忆管理 |
| [10-structured-output.md](./10-structured-output.md) | 结构化输出 |
| [11-middleware.md](./11-middleware.md) | 中间件系统 |
| [12-open-source-projects.md](./12-open-source-projects.md) | 开源项目推荐 |
