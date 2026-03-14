# LangChain.js 流式输出指南

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/streaming

## 概述

流式输出对于提升 LLM 应用的响应性至关重要。通过逐步显示输出（即使完整响应尚未就绪），流式输出显著改善了用户体验。

LangChain 的流式系统功能:
- **多模式流式** — 选择 `updates`（Agent 进度）、`messages`（LLM tokens + 元数据）或 `custom`（自定义数据）
- **自定义流式更新** — 发出用户定义的信号
- **推理/思考 token 流式** — 展示模型推理过程
- **LLM token 流式** — 逐 token 流式输出
- **Agent 进度流式** — 每步状态更新

## 支持的流式模式

| 模式 | 说明 |
|------|------|
| `updates` | 每个 Agent 步骤后流式输出状态更新 |
| `messages` | 从调用 LLM 的节点流式输出 `(token, metadata)` 元组 |
| `custom` | 从节点内部使用 stream writer 流式输出自定义数据 |

## Agent 进度流式

使用 `streamMode: "updates"`:

```typescript
import z from "zod";
import { createAgent, tool } from "langchain";

const getWeather = tool(
  async ({ city }) => {
    return `The weather in ${city} is always sunny!`;
  },
  {
    name: "get_weather",
    description: "Get weather for a given city.",
    schema: z.object({ city: z.string() }),
  }
);

const agent = createAgent({
  model: "gpt-5-nano",
  tools: [getWeather],
});

for await (const chunk of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: "updates" }
)) {
  const [step, content] = Object.entries(chunk)[0];
  console.log(`step: ${step}`);
  console.log(`content: ${JSON.stringify(content, null, 2)}`);
}
```

输出:
```
step: model      → AI 请求调用工具
step: tools      → 工具执行结果
step: model      → AI 最终响应
```

## LLM Token 流式

使用 `streamMode: "messages"`:

```typescript
const agent = createAgent({
  model: "gpt-4.1-mini",
  tools: [getWeather],
});

for await (const [token, metadata] of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: "messages" }
)) {
  console.log(`node: ${metadata.langgraph_node}`);
  console.log(`content: ${JSON.stringify(token.contentBlocks, null, 2)}`);
}
```

## 自定义流式更新

使用 `writer` 参数从工具内部发出自定义数据:

```typescript
import z from "zod";
import { tool, createAgent } from "langchain";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const getWeather = tool(
  async (input, config: LangGraphRunnableConfig) => {
    config.writer?.(`Looking up data for city: ${input.city}`);
    // ... 执行实际操作
    config.writer?.(`Acquired data for city: ${input.city}`);
    return `It's always sunny in ${input.city}!`;
  },
  {
    name: "get_weather",
    description: "Get weather for a given city.",
    schema: z.object({
      city: z.string().describe("The city to get weather for."),
    }),
  }
);

const agent = createAgent({
  model: "gpt-4.1-mini",
  tools: [getWeather],
});

for await (const chunk of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: "custom" }
)) {
  console.log(chunk);
}
// Looking up data for city: San Francisco
// Acquired data for city: San Francisco
```

## 多模式流式

同时使用多种流式模式:

```typescript
for await (const [streamMode, chunk] of await agent.stream(
  { messages: [{ role: "user", content: "what is the weather in sf" }] },
  { streamMode: ["updates", "messages", "custom"] }
)) {
  console.log(`${streamMode}: ${JSON.stringify(chunk, null, 2)}`);
}
```

## 流式推理/思考 Token

某些模型（如 Claude）支持在生成最终答案前进行内部推理:

```typescript
import z from "zod";
import { createAgent, tool } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";

const getWeather = tool(
  async ({ city }) => `It's always sunny in ${city}!`,
  {
    name: "get_weather",
    description: "Get weather for a given city.",
    schema: z.object({ city: z.string() }),
  },
);

const agent = createAgent({
  model: new ChatAnthropic({
    model: "claude-sonnet-4-6",
    thinking: { type: "enabled", budget_tokens: 5000 },
  }),
  tools: [getWeather],
});

for await (const [token, metadata] of await agent.stream(
  { messages: [{ role: "user", content: "What is the weather in SF?" }] },
  { streamMode: "messages" },
)) {
  if (!token.contentBlocks) continue;
  const reasoning = token.contentBlocks.filter((b) => b.type === "reasoning");
  const text = token.contentBlocks.filter((b) => b.type === "text");
  if (reasoning.length) {
    process.stdout.write(`[thinking] ${reasoning[0].reasoning}`);
  }
  if (text.length) {
    process.stdout.write(text[0].text);
  }
}
```

输出:
```
[thinking] The user is asking about the weather in San Francisco...
[thinking] Let me call the get_weather tool...
The weather in San Francisco is: It's always sunny in San Francisco!
```

## 禁用流式

在某些场景中需要禁用流式:

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4.1",
  streaming: false,
});
```

如果模型不支持 `streaming` 参数，使用 `disableStreaming: true`。

## 相关链接

- [LangGraph 流式](https://docs.langchain.com/oss/javascript/langgraph/streaming) — 高级流式选项
- [带人工介入的流式](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop#streaming-with-hil)
- [前端流式](https://docs.langchain.com/oss/javascript/langchain/streaming/frontend) — 使用 `useStream` 构建 React UI
