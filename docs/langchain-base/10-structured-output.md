# LangChain.js 结构化输出

> 官方文档: https://docs.langchain.com/oss/javascript/langchain/structured-output

## 概述

结构化输出让 Agent 返回特定的、可预测格式的数据。相比解析自然语言响应，你可以直接获得类型化的结构数据。

LangChain 的 `createAgent` 自动处理结构化输出：用户设置期望的 schema，当模型生成结构化数据时，会被自动捕获、验证并返回在 `structuredResponse` 键中。

## 使用方式

```typescript
const agent = createAgent({
  // ...
  responseFormat: schema // Zod schema | Standard Schema | JSON Schema
});
```

结构化响应在 Agent 最终状态的 `structuredResponse` 键中返回。

## 两种策略

### Provider Strategy（提供商原生策略）

利用模型提供商的原生结构化输出 API（如 OpenAI、Anthropic、Gemini），最可靠:

```typescript
import * as z from "zod";
import { createAgent, providerStrategy } from "langchain";

const ContactInfo = z.object({
  name: z.string().describe("The name of the person"),
  email: z.string().describe("The email address"),
  phone: z.string().describe("The phone number"),
});

const agent = createAgent({
  model: "gpt-5",
  tools: [],
  responseFormat: providerStrategy(ContactInfo)
});

const result = await agent.invoke({
  messages: [{
    role: "user",
    content: "Extract contact info from: John Doe, john@example.com, (555) 123-4567"
  }]
});

console.log(result.structuredResponse);
// { name: "John Doe", email: "john@example.com", phone: "(555) 123-4567" }
```

#### 使用 JSON Schema

```typescript
import { createAgent, providerStrategy } from "langchain";

const contactInfoSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "The name of the person" },
    email: { type: "string", description: "The email address" },
    phone: { type: "string", description: "The phone number" }
  },
  required: ["name", "email", "phone"]
};

const agent = createAgent({
  model: "gpt-5",
  tools: [],
  responseFormat: providerStrategy(contactInfoSchema)
});
```

### Tool Calling Strategy（工具调用策略）

对不支持原生结构化输出的模型，通过工具调用实现（适用于所有支持工具调用的模型）:

```typescript
import * as z from "zod";
import { createAgent, toolStrategy } from "langchain";

const ProductReview = z.object({
  rating: z.number().min(1).max(5).optional(),
  sentiment: z.enum(["positive", "negative"]),
  keyPoints: z.array(z.string()).describe("Key points, lowercase, 1-3 words each."),
});

const agent = createAgent({
  model: "gpt-5",
  tools: [],
  responseFormat: toolStrategy(ProductReview)
});

const result = await agent.invoke({
  messages: [{
    role: "user",
    content: "Analyze this review: 'Great product: 5/5 stars. Fast shipping, but expensive'"
  }]
});

console.log(result.structuredResponse);
// { rating: 5, sentiment: "positive", keyPoints: ["fast shipping", "expensive"] }
```

#### 多 Schema 选择

```typescript
import * as z from "zod";
import { createAgent, toolStrategy } from "langchain";

const ProductReview = z.object({
  rating: z.number().min(1).max(5).optional(),
  sentiment: z.enum(["positive", "negative"]),
  keyPoints: z.array(z.string()),
});

const CustomerComplaint = z.object({
  issueType: z.enum(["product", "service", "shipping", "billing"]),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
});

const agent = createAgent({
  model: "gpt-5",
  tools: [],
  responseFormat: toolStrategy([ProductReview, CustomerComplaint])
});
```

#### 自定义工具消息内容

```typescript
import * as z from "zod";
import { createAgent, toolStrategy } from "langchain";

const MeetingAction = z.object({
  task: z.string().describe("The specific task to be completed"),
  assignee: z.string().describe("Person responsible"),
  priority: z.enum(["low", "medium", "high"]),
});

const agent = createAgent({
  model: "gpt-5",
  tools: [],
  responseFormat: toolStrategy(MeetingAction, {
    toolMessageContent: "Action item captured and added to meeting notes!"
  })
});
```

## 错误处理

### 自动重试

模型生成结构化输出时可能出错，LangChain 提供智能重试机制:

#### 多结构化输出错误

当模型错误地调用多个结构化输出工具时，Agent 自动反馈错误并要求重试:

```
错误消息: "Error: Model incorrectly returned multiple structured responses
when only one is expected. Please fix your mistakes."
→ 模型重试，只返回一个结构化输出
```

#### Schema 验证错误

当输出不匹配预期 schema 时，提供具体错误反馈:

```
例如: rating 值为 10，但 schema 要求 max=5
→ 错误消息: "Input should be less than or equal to 5"
→ 模型自动修正为 rating: 5
```

### 自定义错误处理策略

```typescript
// 自定义错误消息
const responseFormat = toolStrategy(ProductRating, {
  handleError: "Please provide a valid rating between 1-5 and include a comment."
});

// 按异常类型处理
import { ToolInputParsingException } from "@langchain/core/tools";

const responseFormat = toolStrategy(ProductRating, {
  handleError: (error) => {
    if (error instanceof ToolInputParsingException) {
      return "Please provide a valid rating between 1-5.";
    }
    return error.message;
  }
});

// 禁用错误处理
const responseFormat = toolStrategy(ProductRating, {
  handleError: false
});
```

## 使用 Standard Schema

任何实现 [Standard Schema](https://standardschema.dev/) 规范的库都支持:

```typescript
import * as v from "valibot";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { createAgent, providerStrategy } from "langchain";

const ContactInfo = toStandardJsonSchema(
  v.object({
    name: v.pipe(v.string(), v.description("The name of the person")),
    email: v.pipe(v.string(), v.description("The email address")),
    phone: v.pipe(v.string(), v.description("The phone number")),
  })
);

const agent = createAgent({
  model: "gpt-5",
  tools: [],
  responseFormat: providerStrategy(ContactInfo)
});
```

## 在模型上直接使用

在 Agent 之外也可以使用结构化输出:

```typescript
import * as z from "zod";

const Movie = z.object({
  title: z.string(),
  year: z.number(),
  director: z.string(),
  rating: z.number(),
});

const modelWithStructure = model.withStructuredOutput(Movie);

const response = await modelWithStructure.invoke("Provide details about Inception");
// { title: "Inception", year: 2010, director: "Christopher Nolan", rating: 8.8 }
```
