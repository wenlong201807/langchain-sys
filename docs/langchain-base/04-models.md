# LangChain.js 模型使用指南

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/models

## 概述

LLM（大语言模型）是强大的 AI 工具，可以像人类一样理解和生成文本。除文本生成外，许多模型还支持:

- **推理 (Reasoning)** - 多步推理得出结论
- **多模态 (Multimodality)** - 处理和返回文本以外的数据（图像、音频、视频）
- **结构化输出 (Structured output)** - 响应受限于预定义格式
- **工具调用 (Tool calling)** - 调用外部工具并使用结果

模型是 Agent 的推理引擎，驱动决策过程，决定调用哪些工具、如何解释结果以及何时提供最终答案。

## 基本用法

### 使用 initChatModel 初始化

最简单的方式是使用 `initChatModel`:

#### OpenAI

```bash
npm install @langchain/openai
```

```typescript
import { initChatModel } from "langchain";

process.env.OPENAI_API_KEY = "your-api-key";
const model = await initChatModel("gpt-5.2");
```

```typescript
// 或直接使用提供商类
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-5.2",
  apiKey: "your-api-key"
});
```

#### Anthropic

```bash
npm install @langchain/anthropic
```

```typescript
import { initChatModel } from "langchain";

process.env.ANTHROPIC_API_KEY = "your-api-key";
const model = await initChatModel("claude-sonnet-4-6");
```

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  apiKey: "your-api-key"
});
```

#### Google Gemini

```bash
npm install @langchain/google-genai
```

```typescript
import { initChatModel } from "langchain";

process.env.GOOGLE_API_KEY = "your-api-key";
const model = await initChatModel("google-genai:gemini-2.5-flash-lite");
```

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
  apiKey: "your-api-key"
});
```

#### Azure OpenAI

```bash
npm install @langchain/azure
```

```typescript
import { initChatModel } from "langchain";

process.env.AZURE_OPENAI_API_KEY = "your-api-key";
process.env.AZURE_OPENAI_ENDPOINT = "your-endpoint";
process.env.OPENAI_API_VERSION = "your-api-version";

const model = await initChatModel("azure_openai:gpt-5.2");
```

#### AWS Bedrock

```bash
npm install @langchain/aws
```

```typescript
import { initChatModel } from "langchain";

const model = await initChatModel("bedrock:gpt-5.2");
```

## 模型参数

| 参数 | 说明 |
|------|------|
| `model` | 模型名称或标识符，支持 `provider:model` 格式 |
| `apiKey` | API 认证密钥 |
| `temperature` | 控制输出随机性（高=更有创意，低=更确定性） |
| `maxTokens` | 限制响应的最大 token 数 |
| `timeout` | 等待响应的最长时间（秒） |
| `maxRetries` | 请求失败时的最大重试次数 |

```typescript
const model = await initChatModel(
  "claude-sonnet-4-6",
  { temperature: 0.7, timeout: 30, maxTokens: 1000, maxRetries: 6 }
);
```

## 三种调用方式

### 1. Invoke（调用）

生成完整响应后返回:

```typescript
const response = await model.invoke("Why do parrots have colorful feathers?");
console.log(response);
```

使用消息列表（对话历史）:

```typescript
const conversation = [
  { role: "system", content: "You are a helpful assistant that translates English to French." },
  { role: "user", content: "Translate: I love programming." },
  { role: "assistant", content: "J'adore la programmation." },
  { role: "user", content: "Translate: I love building applications." },
];

const response = await model.invoke(conversation);
```

也可使用 LangChain 消息类:

```typescript
import { HumanMessage, AIMessage, SystemMessage } from "langchain";

const conversation = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("Translate: I love programming."),
  new AIMessage("J'adore la programmation."),
  new HumanMessage("Translate: I love building applications."),
];

const response = await model.invoke(conversation);
```

### 2. Stream（流式）

实时流式输出:

```typescript
const stream = await model.stream("Why do parrots have colorful feathers?");
for await (const chunk of stream) {
  console.log(chunk.text);
}
```

流式输出中聚合完整消息:

```typescript
let full: AIMessageChunk | null = null;
for await (const chunk of stream) {
  full = full ? full.concat(chunk) : chunk;
  console.log(full.text);
}
// The
// The sky
// The sky is
// The sky is typically blue...
```

使用 `streamEvents()` 获取语义事件:

```typescript
const stream = await model.streamEvents("Hello");
for await (const event of stream) {
  if (event.event === "on_chat_model_start") {
    console.log(`Input: ${event.data.input}`);
  }
  if (event.event === "on_chat_model_stream") {
    console.log(`Token: ${event.data.chunk.text}`);
  }
  if (event.event === "on_chat_model_end") {
    console.log(`Full message: ${event.data.output.text}`);
  }
}
```

### 3. Batch（批量）

并行处理多个请求:

```typescript
const responses = await model.batch([
  "Why do parrots have colorful feathers?",
  "How do airplanes fly?",
  "What is quantum computing?",
]);
for (const response of responses) {
  console.log(response);
}
```

控制并发数:

```typescript
model.batch(listOfInputs, { maxConcurrency: 5 });
```

## 工具调用 (Tool Calling)

### 绑定工具

```typescript
import { tool } from "langchain";
import * as z from "zod";
import { ChatOpenAI } from "@langchain/openai";

const getWeather = tool(
  (input) => `It's sunny in ${input.location}.`,
  {
    name: "get_weather",
    description: "Get the weather at a location.",
    schema: z.object({
      location: z.string().describe("The location to get the weather for"),
    }),
  },
);

const model = new ChatOpenAI({ model: "gpt-4.1" });
const modelWithTools = model.bindTools([getWeather]);

const response = await modelWithTools.invoke("What's the weather like in Boston?");
const toolCalls = response.tool_calls || [];
for (const tool_call of toolCalls) {
  console.log(`Tool: ${tool_call.name}`);
  console.log(`Args: ${tool_call.args}`);
}
```

### 工具执行循环

```typescript
const modelWithTools = model.bindTools([get_weather]);

// 步骤 1: 模型生成工具调用
const messages = [{ role: "user", content: "What's the weather in Boston?" }];
const ai_msg = await modelWithTools.invoke(messages);
messages.push(ai_msg);

// 步骤 2: 执行工具并收集结果
for (const tool_call of ai_msg.tool_calls) {
  const tool_result = await get_weather.invoke(tool_call);
  messages.push(tool_result);
}

// 步骤 3: 将结果传回模型获取最终响应
const final_response = await modelWithTools.invoke(messages);
console.log(final_response.text);
```

### 强制使用特定工具

```typescript
// 强制使用任意一个工具
const modelWithTools = model.bindTools([tool_1], { toolChoice: "any" });

// 强制使用指定工具
const modelWithTools = model.bindTools([tool_1], { toolChoice: "tool_1" });
```

### 并行工具调用

```typescript
const modelWithTools = model.bindTools([get_weather]);

const response = await modelWithTools.invoke(
  "What's the weather in Boston and Tokyo?"
);
// 模型可能生成多个工具调用
console.log(response.tool_calls);
// [
//   { name: 'get_weather', args: { location: 'Boston' }, id: 'call_1' },
//   { name: 'get_weather', args: { location: 'Tokyo' }, id: 'call_2' }
// ]
```

## 结构化输出

### 使用 Zod Schema

```typescript
import * as z from "zod";

const Movie = z.object({
  title: z.string().describe("The title of the movie"),
  year: z.number().describe("The year the movie was released"),
  director: z.string().describe("The director of the movie"),
  rating: z.number().describe("The movie's rating out of 10"),
});

const modelWithStructure = model.withStructuredOutput(Movie);

const response = await modelWithStructure.invoke("Provide details about the movie Inception");
console.log(response);
// { title: "Inception", year: 2010, director: "Christopher Nolan", rating: 8.8 }
```

### 使用 JSON Schema

```typescript
const jsonSchema = {
  title: "Movie",
  type: "object",
  properties: {
    title: { type: "string" },
    year: { type: "integer" },
    director: { type: "string" },
    rating: { type: "number" },
  },
  required: ["title", "year", "director", "rating"],
};

const modelWithStructure = model.withStructuredOutput(
  jsonSchema,
  { method: "jsonSchema" },
);
```

## 推理模式 (Reasoning)

某些模型支持在生成最终答案前进行内部推理:

```typescript
const stream = await model.stream("What color is the sky?");
for await (const chunk of stream) {
  for (const block of chunk.contentBlocks) {
    if (block.type === "reasoning") {
      console.log(`Reasoning: ${block.reasoning}`);
    } else if (block.type === "text") {
      console.log(block.text);
    }
  }
}
```

## 多模态支持

模型可以处理文本之外的多种数据类型（图像、音频、视频等），详见 [Messages 文档](./07-messages.md)。
