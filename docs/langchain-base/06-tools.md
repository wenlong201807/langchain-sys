# LangChain.js 工具开发指南

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/tools

## 概述

工具扩展了 Agent 的能力——让它们能够获取实时数据、执行代码、查询外部数据库以及在现实世界中采取行动。

工具本质上是具有明确定义的输入和输出的可调用函数，会传递给聊天模型。模型根据对话上下文决定何时调用工具以及提供什么参数。

## 创建工具

### 基础工具定义

```typescript
import * as z from "zod";
import { tool } from "langchain";

const searchDatabase = tool(
  ({ query, limit }) => `Found ${limit} results for '${query}'`,
  {
    name: "search_database",
    description: "Search the customer database for records matching the query.",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
      limit: z.number().describe("Maximum number of results to return"),
    }),
  }
);
```

> 工具名称建议使用 `snake_case`（如 `web_search`），避免空格和特殊字符。

## 访问上下文

### Context（不可变运行时配置）

用于用户 ID、会话详情等在对话期间不变的数据:

```typescript
import * as z from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

const getUserName = tool(
  (_, config) => {
    return config.context.user_name;
  },
  {
    name: "get_user_name",
    description: "Get the user's name.",
    schema: z.object({}),
  }
);

const contextSchema = z.object({
  user_name: z.string(),
});

const agent = createAgent({
  model: new ChatOpenAI({ model: "gpt-4.1" }),
  tools: [getUserName],
  contextSchema,
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "What is my name?" }] },
  { context: { user_name: "John Smith" } }
);
```

### 长期记忆 (Store)

跨对话持久化存储，使用命名空间/键模式组织数据:

```typescript
import * as z from "zod";
import { createAgent, tool } from "langchain";
import { InMemoryStore } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

const store = new InMemoryStore();

// 读取记忆
const getUserInfo = tool(
  async ({ user_id }) => {
    const value = await store.get(["users"], user_id);
    return value;
  },
  {
    name: "get_user_info",
    description: "Look up user info.",
    schema: z.object({ user_id: z.string() }),
  }
);

// 写入记忆
const saveUserInfo = tool(
  async ({ user_id, name, age, email }) => {
    await store.put(["users"], user_id, { name, age, email });
    return "Successfully saved user info.";
  },
  {
    name: "save_user_info",
    description: "Save user info.",
    schema: z.object({
      user_id: z.string(),
      name: z.string(),
      age: z.number(),
      email: z.string(),
    }),
  }
);

const agent = createAgent({
  model: new ChatOpenAI({ model: "gpt-4.1" }),
  tools: [getUserInfo, saveUserInfo],
  store,
});

// 第一次会话: 保存用户信息
await agent.invoke({
  messages: [{
    role: "user",
    content: "Save: userid: abc123, name: Foo, age: 25, email: foo@langchain.dev",
  }],
});

// 第二次会话: 读取用户信息
const result = await agent.invoke({
  messages: [{ role: "user", content: "Get user info for user 'abc123'" }],
});
```

### Stream Writer（流式更新）

在工具执行期间向用户推送实时更新:

```typescript
import * as z from "zod";
import { tool, ToolRuntime } from "langchain";

const getWeather = tool(
  ({ city }, config: ToolRuntime) => {
    const writer = config.writer;
    if (writer) {
      writer(`Looking up data for city: ${city}`);
      writer(`Acquired data for city: ${city}`);
    }
    return `It's always sunny in ${city}!`;
  },
  {
    name: "get_weather",
    description: "Get weather for a given city.",
    schema: z.object({ city: z.string() }),
  }
);
```

## ToolNode

`ToolNode` 是在 LangGraph 工作流中执行工具的预构建节点:

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

const search = tool(
  ({ query }) => `Results for: ${query}`,
  {
    name: "search",
    description: "Search for information.",
    schema: z.object({ query: z.string() }),
  }
);

const calculator = tool(
  ({ expression }) => String(eval(expression)),
  {
    name: "calculator",
    description: "Evaluate a math expression.",
    schema: z.object({ expression: z.string() }),
  }
);

const toolNode = new ToolNode([search, calculator]);
```

## 工具返回值类型

### 返回字符串

```typescript
const getWeather = tool(
  ({ city }) => `It is currently sunny in ${city}.`,
  {
    name: "get_weather",
    description: "Get weather for a city.",
    schema: z.object({ city: z.string() }),
  }
);
```

### 返回对象

```typescript
const getWeatherData = tool(
  ({ city }) => ({
    city,
    temperature_c: 22,
    conditions: "sunny",
  }),
  {
    name: "get_weather_data",
    description: "Get structured weather data for a city.",
    schema: z.object({ city: z.string() }),
  },
);
```

### 返回 Command（更新 Agent 状态）

```typescript
import { tool, ToolMessage, type ToolRuntime } from "langchain";
import { Command } from "@langchain/langgraph";
import * as z from "zod";

const setLanguage = tool(
  async ({ language }, config: ToolRuntime) => {
    return new Command({
      update: {
        preferredLanguage: language,
        messages: [
          new ToolMessage({
            content: `Language set to ${language}.`,
            tool_call_id: config.toolCallId,
          }),
        ],
      },
    });
  },
  {
    name: "set_language",
    description: "Set the preferred response language.",
    schema: z.object({ language: z.string() }),
  },
);
```

## 错误处理

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

// 默认行为
const toolNode = new ToolNode(tools);

// 捕获所有错误
const toolNode = new ToolNode(tools, { handleToolErrors: true });

// 自定义错误消息
const toolNode = new ToolNode(tools, {
  handleToolErrors: "Something went wrong, please try again."
});
```

## 条件路由

使用 `toolsCondition` 根据 LLM 是否调用工具进行条件路由:

```typescript
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

const builder = new StateGraph(MessagesAnnotation)
  .addNode("llm", callLlm)
  .addNode("tools", new ToolNode(tools))
  .addEdge("__start__", "llm")
  .addConditionalEdges("llm", toolsCondition)
  .addEdge("tools", "llm");

const graph = builder.compile();
```

## 预构建工具

LangChain 提供了大量预构建工具和工具包（网络搜索、代码解释器、数据库访问等），可直接集成到 Agent 中。

访问 [Tools and Toolkits](https://docs.langchain.com/oss/javascript/integrations/tools) 查看完整列表。

## 服务端工具

部分聊天模型内置了服务端执行的工具（如网络搜索和代码解释器），无需定义或托管工具逻辑。请参考对应的聊天模型集成页面了解详情。
