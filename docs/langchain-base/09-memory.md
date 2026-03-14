# LangChain.js 记忆管理

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/short-term-memory

## 概述

记忆是记住先前交互信息的系统。对于 AI Agent 来说，记忆至关重要，因为它让 Agent 能够记住先前的交互、从反馈中学习并适应用户偏好。

- **短期记忆** — 记住单个线程或对话中的先前交互
- **长期记忆** — 跨会话持久化

## 短期记忆

### 添加短期记忆

通过指定 `checkpointer` 添加:

```typescript
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [],
  checkpointer,
});

await agent.invoke(
  { messages: [{ role: "user", content: "hi! i am Bob" }] },
  { configurable: { thread_id: "1" } }
);
```

### 生产环境 Checkpointer

使用数据库支持的 checkpointer:

```typescript
// PostgreSQL
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const DB_URI = "postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable";
const checkpointer = PostgresSaver.fromConnString(DB_URI);
```

支持的 checkpointer:
- `MemorySaver` — 内存（开发用）
- `PostgresSaver` — PostgreSQL
- SQLite
- Azure Cosmos DB

### 自定义 Agent 状态

```typescript
import { createAgent, createMiddleware } from "langchain";
import { StateSchema, MemorySaver } from "@langchain/langgraph";
import * as z from "zod";

const CustomState = new StateSchema({
  userId: z.string(),
  preferences: z.record(z.string(), z.any()),
});

const stateExtensionMiddleware = createMiddleware({
  name: "StateExtension",
  stateSchema: CustomState,
});

const checkpointer = new MemorySaver();
const agent = createAgent({
  model: "gpt-5",
  tools: [],
  middleware: [stateExtensionMiddleware],
  checkpointer,
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Hello" }],
  userId: "user_123",
  preferences: { theme: "dark" },
});
```

## 消息管理策略

长对话可能超出 LLM 的上下文窗口，常见解决方案:

### 1. 裁剪消息 (Trim)

移除最早的消息，保留最近的:

```typescript
import { RemoveMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware } from "langchain";
import { MemorySaver, REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

const trimMessages = createMiddleware({
  name: "TrimMessages",
  beforeModel: (state) => {
    const messages = state.messages;
    if (messages.length <= 3) return;

    const firstMsg = messages[0];
    const recentMessages =
      messages.length % 2 === 0 ? messages.slice(-3) : messages.slice(-4);
    const newMessages = [firstMsg, ...recentMessages];

    return {
      messages: [
        new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
        ...newMessages,
      ],
    };
  },
});

const agent = createAgent({
  model: "gpt-4.1",
  tools: [],
  middleware: [trimMessages],
  checkpointer: new MemorySaver(),
});
```

### 2. 删除消息 (Delete)

永久删除特定消息:

```typescript
import { RemoveMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const deleteOldMessages = createMiddleware({
  name: "DeleteOldMessages",
  afterModel: (state) => {
    const messages = state.messages;
    if (messages.length > 2) {
      return {
        messages: messages
          .slice(0, 2)
          .map((m) => new RemoveMessage({ id: m.id! })),
      };
    }
    return;
  },
});

const agent = createAgent({
  model: "gpt-4.1",
  tools: [],
  systemPrompt: "Please be concise and to the point.",
  middleware: [deleteOldMessages],
  checkpointer: new MemorySaver(),
});
```

> 删除消息时确保结果消息历史有效。大多数提供商要求带工具调用的 `assistant` 消息后跟对应的 `tool` 结果消息。

### 3. 总结消息 (Summarize)

使用 LLM 总结较早的消息并替换为摘要:

```typescript
import { createAgent, summarizationMiddleware } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const agent = createAgent({
  model: "gpt-4.1",
  tools: [],
  middleware: [
    summarizationMiddleware({
      model: "gpt-4.1-mini",
      trigger: { tokens: 4000 },
      keep: { messages: 20 },
    }),
  ],
  checkpointer: new MemorySaver(),
});

const config = { configurable: { thread_id: "1" } };
await agent.invoke({ messages: "hi, my name is bob" }, config);
await agent.invoke({ messages: "write a short poem about cats" }, config);
await agent.invoke({ messages: "now do the same but for dogs" }, config);
const finalResponse = await agent.invoke({ messages: "what's my name?" }, config);

console.log(finalResponse.messages.at(-1)?.content);
// Your name is Bob!
```

## 在工具中访问记忆

### 读取短期记忆

```typescript
import { createAgent, tool, type ToolRuntime } from "langchain";
import { StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const CustomState = new StateSchema({
  userId: z.string(),
});

const getUserInfo = tool(
  async (_, config: ToolRuntime<typeof CustomState.State>) => {
    const userId = config.state.userId;
    return userId === "user_123" ? "John Doe" : "Unknown User";
  },
  {
    name: "get_user_info",
    description: "Get user info",
    schema: z.object({}),
  }
);

const agent = createAgent({
  model: "gpt-5-nano",
  tools: [getUserInfo],
  stateSchema: CustomState,
});
```

### 从工具写入短期记忆

```typescript
import { tool, createAgent, ToolMessage, type ToolRuntime } from "langchain";
import { Command, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const updateUserInfo = tool(
  async (_, config: ToolRuntime) => {
    const userId = config.state.userId;
    const name = userId === "user_123" ? "John Smith" : "Unknown user";
    return new Command({
      update: {
        userName: name,
        messages: [
          new ToolMessage({
            content: "Successfully looked up user information",
            tool_call_id: config.toolCall?.id ?? "",
          }),
        ],
      },
    });
  },
  {
    name: "update_user_info",
    description: "Look up and update user info.",
    schema: z.object({}),
  }
);
```

## 动态系统提示词

基于对话历史或自定义状态字段创建动态提示:

```typescript
import * as z from "zod";
import { createAgent, tool, dynamicSystemPromptMiddleware } from "langchain";

const contextSchema = z.object({
  userName: z.string(),
});

const agent = createAgent({
  model: "gpt-5-nano",
  tools: [getWeather],
  contextSchema,
  middleware: [
    dynamicSystemPromptMiddleware<z.infer<typeof contextSchema>>((_, config) => {
      return `You are a helpful assistant. Address the user as ${config.context?.userName}.`;
    }),
  ],
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "What is the weather in SF?" }] },
  { context: { userName: "John Smith" } }
);
```

## beforeModel / afterModel 钩子

### beforeModel

在模型调用前处理状态:

```typescript
import { RemoveMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware, trimMessages } from "langchain";
import { MemorySaver, REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

const trimMessageHistory = createMiddleware({
  name: "TrimMessages",
  beforeModel: async (state) => {
    const trimmed = await trimMessages(state.messages, {
      maxTokens: 384,
      strategy: "last",
      startOn: "human",
      endOn: ["human", "tool"],
      tokenCounter: (msgs) => msgs.length,
    });
    return {
      messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES }), ...trimmed],
    };
  },
});
```

### afterModel

在模型调用后验证/修改响应:

```typescript
import { RemoveMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware } from "langchain";
import { REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

const validateResponse = createMiddleware({
  name: "ValidateResponse",
  afterModel: (state) => {
    const lastMessage = state.messages.at(-1)?.content;
    if (
      typeof lastMessage === "string" &&
      lastMessage.toLowerCase().includes("confidential")
    ) {
      return {
        messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES })],
      };
    }
    return;
  },
});
```
