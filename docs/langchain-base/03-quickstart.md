# LangChain.js 快速入门

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/quickstart

本指南将带你从简单设置到构建一个功能完整的 AI Agent。

## 前置条件

1. 设置 `ANTHROPIC_API_KEY` 环境变量
2. 注册 [Anthropic](https://www.anthropic.com/) 账户并获取 API Key
3. [安装](./02-installation.md) LangChain 包

> 虽然示例使用 Claude，但你可以使用任何支持的模型。

## 第一步：构建基础 Agent

```typescript
import { createAgent, tool } from "langchain";
import * as z from "zod";

const getWeather = tool(
  (input) => `It's always sunny in ${input.city}!`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  }
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

## 第二步：构建生产级 Agent

接下来构建一个实用的天气预报 Agent，展示关键生产概念:

### 2.1 定义系统提示词

```typescript
const systemPrompt = `You are an expert weather forecaster, who speaks in puns.

You have access to two tools:

- get_weather_for_location: use this to get the weather for a specific location
- get_user_location: use this to get the user's location

If a user asks you for the weather, make sure you know the location.
If you can tell from the question that they mean wherever they are,
use the get_user_location tool to find their location.`;
```

### 2.2 创建工具

工具是 Agent 可以调用的函数，通常连接外部系统并依赖运行时配置:

```typescript
import { tool, type ToolRuntime } from "langchain";
import * as z from "zod";

const getWeather = tool(
  (input) => `It's always sunny in ${input.city}!`,
  {
    name: "get_weather_for_location",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  }
);

type AgentRuntime = ToolRuntime<unknown, { user_id: string }>;

const getUserLocation = tool(
  (_, config: AgentRuntime) => {
    const { user_id } = config.context;
    return user_id === "1" ? "Florida" : "SF";
  },
  {
    name: "get_user_location",
    description: "Retrieve user information based on user ID",
  }
);
```

### 2.3 配置模型

```typescript
import { initChatModel } from "langchain";

const model = await initChatModel(
  "claude-sonnet-4-6",
  { temperature: 0.5, timeout: 10, maxTokens: 1000 }
);
```

### 2.4 定义结构化响应格式

```typescript
const responseFormat = z.object({
  punny_response: z.string(),
  weather_conditions: z.string().optional(),
});
```

### 2.5 添加记忆

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
```

> 生产环境中，使用持久化 checkpointer 将消息历史保存到数据库。

### 2.6 组装并运行 Agent

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "claude-sonnet-4-6",
  systemPrompt: systemPrompt,
  tools: [getUserLocation, getWeather],
  responseFormat,
  checkpointer,
});

// thread_id 是给定对话的唯一标识符
const config = {
  configurable: { thread_id: "1" },
  context: { user_id: "1" },
};

const response = await agent.invoke(
  { messages: [{ role: "user", content: "what is the weather outside?" }] },
  config
);
console.log(response.structuredResponse);
// {
//   punny_response: "Florida is still having a 'sun-derful' day ...",
//   weather_conditions: "It's always sunny in Florida!"
// }

// 使用相同的 thread_id 继续对话
const thankYouResponse = await agent.invoke(
  { messages: [{ role: "user", content: "thank you!" }] },
  config
);
console.log(thankYouResponse.structuredResponse);
```

## 完整示例代码

```typescript
import { createAgent, tool, initChatModel, type ToolRuntime } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import * as z from "zod";

// 定义系统提示词
const systemPrompt = `You are an expert weather forecaster, who speaks in puns.

You have access to two tools:

- get_weather_for_location: use this to get the weather for a specific location
- get_user_location: use this to get the user's location

If a user asks you for the weather, make sure you know the location.
If you can tell from the question that they mean wherever they are,
use the get_user_location tool to find their location.`;

// 定义工具
const getWeather = tool(
  ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather_for_location",
    description: "Get the weather for a given city",
    schema: z.object({ city: z.string() }),
  }
);

type AgentRuntime = ToolRuntime<unknown, { user_id: string }>;

const getUserLocation = tool(
  (_, config: AgentRuntime) => {
    const { user_id } = config.context;
    return user_id === "1" ? "Florida" : "SF";
  },
  {
    name: "get_user_location",
    description: "Retrieve user information based on user ID",
    schema: z.object({}),
  }
);

// 配置模型
const model = await initChatModel("claude-sonnet-4-6", { temperature: 0 });

// 定义响应格式
const responseFormat = z.object({
  punny_response: z.string(),
  weather_conditions: z.string().optional(),
});

// 设置记忆
const checkpointer = new MemorySaver();

// 创建 Agent
const agent = createAgent({
  model,
  systemPrompt,
  responseFormat,
  checkpointer,
  tools: [getUserLocation, getWeather],
});

// 运行 Agent
const config = {
  configurable: { thread_id: "1" },
  context: { user_id: "1" },
};

const response = await agent.invoke(
  { messages: [{ role: "user", content: "what is the weather outside?" }] },
  config
);
console.log(response.structuredResponse);
```

## 完成后的 Agent 具备能力

- 跨交互维护对话状态
- 通过上下文处理用户特定信息
- 以一致的格式提供结构化响应
- 智能使用多个工具
- 理解上下文并记住对话
