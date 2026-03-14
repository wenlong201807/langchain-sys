# LangChain.js Agent 开发指南

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/agents

## 概述

Agent 将语言模型与工具结合，创建能够推理任务、决定使用哪些工具并迭代工作以达成解决方案的系统。

`createAgent()` 提供了生产就绪的 Agent 实现，基于 LangGraph 构建图式 Agent 运行时。

Agent 遵循 **ReAct（推理 + 行动）** 模式运行:

```
输入 → 模型推理 → 调用工具 → 获取结果 → 模型推理 → ... → 输出
```

Agent 运行直到满足停止条件——即模型输出最终答案或达到迭代限制。

## 核心组件

### 1. 模型 (Model)

#### 静态模型

创建 Agent 时配置，整个执行过程不变:

```typescript
import { createAgent } from "langchain";

// 使用模型标识符字符串
const agent = createAgent({
  model: "openai:gpt-5",
  tools: []
});
```

```typescript
// 使用模型实例（完全控制配置）
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0.1,
  maxTokens: 1000,
  timeout: 30
});

const agent = createAgent({
  model,
  tools: []
});
```

#### 动态模型

根据运行时状态和上下文选择模型:

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

const agent = createAgent({
  model: "gpt-4.1-mini",
  tools,
  middleware: [dynamicModelSelection],
});
```

### 2. 工具 (Tools)

#### 静态工具

```typescript
import * as z from "zod";
import { createAgent, tool } from "langchain";

const search = tool(
  ({ query }) => `Results for: ${query}`,
  {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string().describe("The query to search for"),
    }),
  }
);

const getWeather = tool(
  ({ location }) => `Weather in ${location}: Sunny, 72°F`,
  {
    name: "get_weather",
    description: "Get weather information for a location",
    schema: z.object({
      location: z.string().describe("The location to get weather for"),
    }),
  }
);

const agent = createAgent({
  model: "gpt-4.1",
  tools: [search, getWeather],
});
```

#### 动态工具（运行时注册）

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

#### 工具错误处理

```typescript
import { createAgent, createMiddleware, ToolMessage } from "langchain";

const handleToolErrors = createMiddleware({
  name: "HandleToolErrors",
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request);
    } catch (error) {
      return new ToolMessage({
        content: `Tool error: Please check your input and try again. (${error})`,
        tool_call_id: request.toolCall.id!,
      });
    }
  },
});

const agent = createAgent({
  model: "gpt-4.1",
  tools: [/* ... */],
  middleware: [handleToolErrors],
});
```

### 3. 系统提示词 (System Prompt)

#### 静态提示词

```typescript
const agent = createAgent({
  model,
  tools,
  systemPrompt: "You are a helpful assistant. Be concise and accurate.",
});
```

#### 使用 SystemMessage（支持 Anthropic 缓存等高级特性）

```typescript
import { createAgent } from "langchain";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const literaryAgent = createAgent({
  model: "anthropic:claude-sonnet-4-5",
  systemPrompt: new SystemMessage({
    content: [
      {
        type: "text",
        text: "You are an AI assistant tasked with analyzing literary works.",
      },
      {
        type: "text",
        text: "<the entire contents of 'Pride and Prejudice'>",
        cache_control: { type: "ephemeral" }
      }
    ]
  })
});
```

#### 动态系统提示词

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
      if (userRole === "expert") {
        return "You are a helpful assistant. Provide detailed technical responses.";
      }
      return "You are a helpful assistant. Explain concepts simply and avoid jargon.";
    }),
  ],
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "Explain machine learning" }] },
  { context: { userRole: "expert" } }
);
```

### 4. Agent 名称

在多 Agent 系统中用作节点标识符:

```typescript
const agent = createAgent({
  model,
  tools,
  name: "research_assistant",
});
```

> 使用 `snake_case` 命名（如 `research_assistant`），避免空格和特殊字符。

## 调用 Agent

### invoke

```typescript
await agent.invoke({
  messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
});
```

### stream (流式)

```typescript
const stream = await agent.stream(
  {
    messages: [{
      role: "user",
      content: "Search for AI news and summarize the findings"
    }],
  },
  { streamMode: "values" }
);

for await (const chunk of stream) {
  const latestMessage = chunk.messages.at(-1);
  if (latestMessage?.content) {
    console.log(`Agent: ${latestMessage.content}`);
  } else if (latestMessage?.tool_calls) {
    const toolCallNames = latestMessage.tool_calls.map((tc) => tc.name);
    console.log(`Calling tools: ${toolCallNames.join(", ")}`);
  }
}
```

## 高级概念

### 结构化输出

```typescript
import * as z from "zod";
import { createAgent } from "langchain";

const ContactInfo = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
});

const agent = createAgent({
  model: "gpt-4.1",
  responseFormat: ContactInfo,
});

const result = await agent.invoke({
  messages: [{
    role: "user",
    content: "Extract contact info from: John Doe, john@example.com, (555) 123-4567",
  }],
});

console.log(result.structuredResponse);
// { name: 'John Doe', email: 'john@example.com', phone: '(555) 123-4567' }
```

### 自定义 Agent 状态

```typescript
import { z } from "zod/v4";
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import { createAgent } from "langchain";

const CustomAgentState = new StateSchema({
  messages: MessagesValue,
  userPreferences: z.record(z.string(), z.string()),
});

const customAgent = createAgent({
  model: "gpt-4.1",
  tools: [],
  stateSchema: CustomAgentState,
});
```

### 记忆

详见 [记忆管理](./09-memory.md)。

### 流式输出

详见 [流式输出指南](./08-streaming.md)。

### 中间件

详见 [中间件系统](./11-middleware.md)。

## ReAct 循环示例

```
用户: "Find the most popular wireless headphones and check if they're in stock"

→ AI 推理: "需要搜索产品"
→ 调用工具: search_products("wireless headphones")
→ 工具返回: "Found 5 products. Top: WH-1000XM5"

→ AI 推理: "需要确认库存"
→ 调用工具: check_inventory("WH-1000XM5")
→ 工具返回: "10 units in stock"

→ AI 输出: "I found WH-1000XM5 with 10 units in stock."
```
