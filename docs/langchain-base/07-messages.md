# LangChain.js 消息系统

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/messages

## 概述

消息（Messages）是 LangChain 中模型上下文的基本单元。它们表示模型的输入和输出，携带与 LLM 交互时表示对话状态所需的内容和元数据。

消息包含:
- **内容 (Content)** - 消息的实际内容（文本、图像、音频等）
- **角色 (Role)** - 标识消息类型（如 `system`、`user`）
- **元数据 (Metadata)** - 可选字段如响应信息、消息 ID、token 使用量

## 基本用法

### 使用消息对象

```typescript
import { initChatModel, HumanMessage, SystemMessage } from "langchain";

const model = await initChatModel("gpt-5-nano");

const systemMsg = new SystemMessage("You are a helpful assistant.");
const humanMsg = new HumanMessage("Hello, how are you?");

const messages = [systemMsg, humanMsg];
const response = await model.invoke(messages); // 返回 AIMessage
```

### 文本提示

```typescript
const response = await model.invoke("Write a haiku about spring");
```

### 字典格式（OpenAI 风格）

```typescript
const messages = [
  { role: "system", content: "You are a poetry expert" },
  { role: "user", content: "Write a haiku about spring" },
  { role: "assistant", content: "Cherry blossoms bloom..." },
];
const response = await model.invoke(messages);
```

## 消息类型

### SystemMessage（系统消息）

设置模型行为、定义角色和建立交互指南:

```typescript
import { SystemMessage, HumanMessage } from "langchain";

const systemMsg = new SystemMessage(`
You are a senior TypeScript developer with expertise in web frameworks.
Always provide code examples and explain your reasoning.
Be concise but thorough in your explanations.
`);

const messages = [
  systemMsg,
  new HumanMessage("How do I create a REST API?"),
];
const response = await model.invoke(messages);
```

### HumanMessage（人类消息）

表示用户输入，可包含文本、图像、音频、文件等多模态内容:

```typescript
const response = await model.invoke([
  new HumanMessage("What is machine learning?"),
]);
```

```typescript
// 带元数据
const humanMsg = new HumanMessage({
  content: "Hello!",
  name: "alice",
  id: "msg_123",
});
```

### AIMessage（AI 消息）

表示模型调用的输出，可包含多模态数据、工具调用和提供商特定的元数据:

```typescript
const response = await model.invoke("Explain AI");
console.log(typeof response); // AIMessage
```

#### 关键属性

| 属性 | 说明 |
|------|------|
| `text` | 消息的文本内容 |
| `content` | 消息的原始内容 |
| `contentBlocks` | 标准化的内容块 |
| `tool_calls` | 模型发出的工具调用（无工具调用时为空） |
| `id` | 消息唯一标识符 |
| `usage_metadata` | 使用元数据（token 计数等） |
| `response_metadata` | 响应元数据 |

#### 工具调用

```typescript
const modelWithTools = model.bindTools([getWeather]);
const response = await modelWithTools.invoke("What's the weather in Paris?");

for (const toolCall of response.tool_calls) {
  console.log(`Tool: ${toolCall.name}`);
  console.log(`Args: ${toolCall.args}`);
  console.log(`ID: ${toolCall.id}`);
}
```

#### Token 使用量

```typescript
const response = await model.invoke("Hello!");
console.log(response.usage_metadata);
// {
//   "output_tokens": 304,
//   "input_tokens": 8,
//   "total_tokens": 312,
//   "input_token_details": { "cache_read": 0 },
//   "output_token_details": { "reasoning": 256 }
// }
```

#### 流式消息块

```typescript
import { AIMessageChunk } from "langchain";

let finalChunk: AIMessageChunk | undefined;
for (const chunk of chunks) {
  finalChunk = finalChunk ? finalChunk.concat(chunk) : chunk;
}
```

### ToolMessage（工具消息）

将工具执行结果传回模型:

```typescript
import { AIMessage, ToolMessage, HumanMessage } from "langchain";

const aiMessage = new AIMessage({
  content: [],
  tool_calls: [{
    name: "get_weather",
    args: { location: "San Francisco" },
    id: "call_123"
  }]
});

const toolMessage = new ToolMessage({
  content: "Sunny, 72°F",
  tool_call_id: "call_123"
});

const messages = [
  new HumanMessage("What's the weather in San Francisco?"),
  aiMessage,
  toolMessage,
];

const response = await model.invoke(messages);
```

#### 工件 (Artifact)

存储不发送给模型的补充数据:

```typescript
import { ToolMessage } from "langchain";

const toolMessage = new ToolMessage({
  content: "It was the best of times, it was the worst of times.",
  tool_call_id: "call_123",
  name: "search_books",
  artifact: { document_id: "doc_123", page: 0 }
});
```

## 标准内容块

LangChain 提供跨提供商的标准内容表示:

### 核心类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `text` | 标准文本输出 | `{ type: "text", text: "Hello" }` |
| `reasoning` | 模型推理步骤 | `{ type: "reasoning", reasoning: "..." }` |

### 多模态类型

| 类型 | 用途 |
|------|------|
| `image` | 图像数据（URL / base64 / file ID） |
| `audio` | 音频数据 |
| `video` | 视频数据 |
| `file` | 通用文件（PDF 等） |
| `text-plain` | 文档文本 |

### 工具调用类型

| 类型 | 用途 |
|------|------|
| `tool_call` | 函数调用 |
| `tool_call_chunk` | 流式工具调用片段 |
| `invalid_tool_call` | 格式错误的调用 |
| `server_tool_call` | 服务端执行的工具调用 |
| `server_tool_result` | 服务端工具结果 |

## 多模态输入

### 图像

```typescript
import { HumanMessage } from "langchain";

// 标准内容块格式
const message = new HumanMessage({
  content: [
    { type: "text", text: "Describe this image." },
    {
      type: "image",
      source_type: "url",
      url: "https://example.com/image.jpg"
    },
  ],
});

// base64 格式
const message = new HumanMessage({
  content: [
    { type: "text", text: "Describe this image." },
    {
      type: "image",
      source_type: "base64",
      data: "base64-encoded-data...",
    },
  ],
});
```

### 文件 (PDF)

```typescript
const message = new HumanMessage({
  content: [
    { type: "text", text: "Describe this document." },
    {
      type: "file",
      source_type: "url",
      url: "https://example.com/doc.pdf",
      mime_type: "application/pdf"
    },
  ],
});
```

### 音频

```typescript
const message = new HumanMessage({
  content: [
    { type: "text", text: "Describe this audio." },
    {
      type: "audio",
      source_type: "base64",
      data: "base64-encoded-data...",
    },
  ],
});
```

### 视频

```typescript
const message = new HumanMessage({
  content: [
    { type: "text", text: "Describe this video." },
    {
      type: "video",
      source_type: "base64",
      data: "base64-encoded-data...",
    },
  ],
});
```

## 使用类型导入

```typescript
import { ContentBlock } from "langchain";

const textBlock: ContentBlock.Text = {
  type: "text",
  text: "Hello world",
};

const imageBlock: ContentBlock.Multimodal.Image = {
  type: "image",
  url: "https://example.com/image.png",
  mimeType: "image/png",
};
```
