# LangChain.js 中间件系统

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/middleware

## 概述

中间件提供了更精细控制 Agent 内部行为的方式。它是一种强大的扩展机制，用于在执行的不同阶段自定义 Agent 行为。

## 适用场景

- 应用**速率限制**、**安全防护**和 **PII 检测**
- 添加**重试**、**降级**和**早期终止**逻辑
- 转换**提示词**、**工具选择**和**输出格式化**
- 使用**日志**、**分析**和**调试**追踪 Agent 行为
- 实现**动态模型选择**
- **内容过滤**和**安全检查**
- **消息裁剪**和**上下文注入**

## 基本使用

```typescript
import {
  createAgent,
  summarizationMiddleware,
  humanInTheLoopMiddleware,
} from "langchain";

const agent = createAgent({
  model: "gpt-4.1",
  tools: [...],
  middleware: [summarizationMiddleware, humanInTheLoopMiddleware],
});
```

## Agent 循环与钩子

Agent 核心循环: 调用模型 → 模型选择工具执行 → 无更多工具调用时结束

中间件在每个步骤前后暴露钩子:

```
beforeModel → Model → afterModel → wrapToolCall → Tool → (循环)
                                                         ↓
                                                     wrapModelCall
```

### 钩子类型

| 钩子 | 时机 | 用途 |
|------|------|------|
| `beforeModel` | 模型调用前 | 消息裁剪、上下文注入 |
| `afterModel` | 模型调用后 | 响应验证、内容过滤 |
| `wrapModelCall` | 包装模型调用 | 动态模型选择、工具过滤 |
| `wrapToolCall` | 包装工具调用 | 错误处理、日志记录 |

## 自定义中间件

### beforeModel — 模型调用前处理

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

const agent = createAgent({
  model: "gpt-5-nano",
  tools: [],
  middleware: [trimMessageHistory],
  checkpointer: new MemorySaver(),
});
```

### afterModel — 模型调用后验证

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

### wrapModelCall — 动态模型选择

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, createMiddleware } from "langchain";

const basicModel = new ChatOpenAI({ model: "gpt-4.1-mini" });
const advancedModel = new ChatOpenAI({ model: "gpt-4.1" });

const dynamicModelSelection = createMiddleware({
  name: "DynamicModelSelection",
  wrapModelCall: (request, handler) => {
    const messageCount = request.messages.length;
    return handler({
      ...request,
      model: messageCount > 10 ? advancedModel : basicModel,
    });
  },
});
```

### wrapToolCall — 工具错误处理

```typescript
import { createAgent, createMiddleware, ToolMessage } from "langchain";

const handleToolErrors = createMiddleware({
  name: "HandleToolErrors",
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request);
    } catch (error) {
      return new ToolMessage({
        content: `Tool error: ${error}`,
        tool_call_id: request.toolCall.id!,
      });
    }
  },
});
```

## 动态工具过滤

### 基于状态过滤

```typescript
const stateBasedTools = createMiddleware({
  name: "StateBasedTools",
  wrapModelCall: (request, handler) => {
    const state = request.state;
    const isAuthenticated = state.authenticated ?? false;
    let filteredTools = request.tools;

    if (!isAuthenticated) {
      filteredTools = request.tools.filter(
        (t) => t.name.startsWith("public_")
      );
    }

    return handler({ ...request, tools: filteredTools });
  },
});
```

### 基于角色过滤

```typescript
import * as z from "zod";
import { createMiddleware } from "langchain";

const contextSchema = z.object({
  userRole: z.string(),
});

const contextBasedTools = createMiddleware({
  name: "ContextBasedTools",
  contextSchema,
  wrapModelCall: (request, handler) => {
    const userRole = request.runtime.context.userRole;
    let filteredTools = request.tools;

    if (userRole === "admin") {
      // 管理员获取所有工具
    } else if (userRole === "editor") {
      filteredTools = request.tools.filter(t => t.name !== "delete_data");
    } else {
      filteredTools = request.tools.filter(
        (t) => t.name.startsWith("read_")
      );
    }

    return handler({ ...request, tools: filteredTools });
  },
});
```

## 动态系统提示词

```typescript
import * as z from "zod";
import { createAgent, dynamicSystemPromptMiddleware } from "langchain";

const contextSchema = z.object({
  userRole: z.enum(["expert", "beginner"]),
});

const agent = createAgent({
  model: "gpt-4.1",
  tools: [/* ... */],
  contextSchema,
  middleware: [
    dynamicSystemPromptMiddleware<z.infer<typeof contextSchema>>((state, runtime) => {
      const userRole = runtime.context.userRole || "user";
      const basePrompt = "You are a helpful assistant.";
      if (userRole === "expert") {
        return `${basePrompt} Provide detailed technical responses.`;
      } else if (userRole === "beginner") {
        return `${basePrompt} Explain concepts simply and avoid jargon.`;
      }
      return basePrompt;
    }),
  ],
});
```

## 内置中间件

### 总结中间件 (Summarization)

自动总结过长的对话历史:

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
```

### 人工介入中间件 (Human-in-the-Loop)

```typescript
import { createAgent, humanInTheLoopMiddleware } from "langchain";

const agent = createAgent({
  model: "gpt-4.1",
  tools: [...],
  middleware: [humanInTheLoopMiddleware],
});
```

## 运行时工具注册

动态添加在运行时才知道的工具:

```typescript
import { createAgent, createMiddleware, tool } from "langchain";
import * as z from "zod";

const calculateTip = tool(
  ({ billAmount, tipPercentage = 20 }) => {
    const tip = billAmount * (tipPercentage / 100);
    return `Tip: $${tip.toFixed(2)}, Total: $${(billAmount + tip).toFixed(2)}`;
  },
  {
    name: "calculate_tip",
    description: "Calculate the tip amount for a bill",
    schema: z.object({
      billAmount: z.number(),
      tipPercentage: z.number().default(20),
    }),
  }
);

const dynamicToolMiddleware = createMiddleware({
  name: "DynamicToolMiddleware",
  wrapModelCall: (request, handler) => {
    return handler({
      ...request,
      tools: [...request.tools, calculateTip],
    });
  },
  wrapToolCall: (request, handler) => {
    if (request.toolCall.name === "calculate_tip") {
      return handler({ ...request, tool: calculateTip });
    }
    return handler(request);
  },
});

const agent = createAgent({
  model: "gpt-4o",
  tools: [getWeather],
  middleware: [dynamicToolMiddleware],
});
```

## 中间件扩展状态

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

const agent = createAgent({
  model: "gpt-5",
  tools: [],
  middleware: [stateExtensionMiddleware],
  checkpointer: new MemorySaver(),
});
```

## 更多资源

- [内置中间件](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in) — 常见用例的预构建中间件
- [自定义中间件](https://docs.langchain.com/oss/javascript/langchain/middleware/custom) — 构建自定义钩子和装饰器
- [中间件 API 参考](https://reference.langchain.com/javascript/langchain/index/createMiddleware) — 完整 API 参考
