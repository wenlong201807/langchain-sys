# FastAPI + LangChain 完整开发指南

> 基于 [https://docs.langchain.com/oss/python/langchain/overview](https://docs.langchain.com/oss/python/langchain/overview) 及 GitHub / Gitee 开源项目整理

## 什么是 FastAPI + LangChain？

**FastAPI** 是 Python 生态中最流行的高性能异步 Web 框架，基于 Pydantic 和 Starlette 构建，天然支持类型校验、自动生成 OpenAPI 文档、异步请求处理。

**LangChain** 是开源 LLM 应用框架，提供预构建的 Agent 架构和模型集成，帮助快速构建由 LLM 驱动的应用。

两者结合，是构建 **生产级 AI API 服务** 的最佳实践方案。

## 为什么选择 FastAPI + LangChain？


| 特性       | FastAPI 提供         | LangChain 提供              |
| -------- | ------------------ | ------------------------- |
| 类型安全     | Pydantic 数据校验      | 结构化输出 Schema              |
| 异步支持     | 原生 async/await     | 异步模型调用                    |
| 流式输出     | SSE / WebSocket    | LLM Token 流式              |
| API 文档   | 自动 Swagger/OpenAPI | -                         |
| 依赖注入     | Depends 系统         | -                         |
| 模型集成     | -                  | OpenAI/Anthropic/Google 等 |
| Agent 架构 | -                  | 预构建 ReAct Agent           |
| 工具调用     | -                  | Tool Calling              |
| 记忆管理     | -                  | 短期/长期记忆                   |
| RAG      | -                  | 检索增强生成                    |


## 架构概览

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   前端/客户端 │────▶│  FastAPI 服务 │────▶│  LangChain  │
│  React/Vue  │◀────│   REST API   │◀────│   Agent     │
└─────────────┘     └──────────────┘     └─────────────┘
                          │                      │
                    ┌─────┴─────┐          ┌─────┴─────┐
                    │  中间件层   │          │  工具/模型  │
                    │ CORS/Auth  │          │ OpenAI等   │
                    └───────────┘          └───────────┘
                          │                      │
                    ┌─────┴─────┐          ┌─────┴─────┐
                    │   数据库   │          │  向量数据库 │
                    │ PostgreSQL│          │ ChromaDB  │
                    └───────────┘          └───────────┘
```

## 两种集成方案

### 方案一：原生 FastAPI + LangChain

直接使用 FastAPI 构建 API，手动集成 LangChain 组件：

```python
from fastapi import FastAPI, Depends
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

app = FastAPI(title="AI API")

@app.post("/chat")
async def chat(user_input: str):
    model = ChatOpenAI(model="gpt-4.1")
    messages = [
        SystemMessage(content="You are helpful."),
        HumanMessage(content=user_input)
    ]
    response = model.invoke(messages)
    return {"response": response.content}
```

**优点**: 完全控制、灵活度高、可深度定制
**适用**: 复杂业务逻辑、企业级应用

### 方案二：LangServe（官方方案）

LangChain 官方的 FastAPI 集成库，自动创建 REST 路由：

```python
from fastapi import FastAPI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langserve import add_routes

app = FastAPI()
prompt = ChatPromptTemplate.from_template("Tell me a joke about {topic}")
chain = prompt | ChatOpenAI(model="gpt-4.1")

add_routes(app, chain, path="/joke")
```

**优点**: 开箱即用、自动文档、内置 Playground
**适用**: 快速原型、简单 API

> 注意: LangServe 目前处于维护模式，新项目推荐使用 LangGraph Platform。

## 文档目录


| 文件                                                               | 内容                     |
| ---------------------------------------------------------------- | ---------------------- |
| [02-environment-setup.md](./02-environment-setup.md)             | 环境搭建与项目初始化             |
| [03-basic-integration.md](./03-basic-integration.md)             | 基础集成教程                 |
| [04-langserve.md](./04-langserve.md)                             | LangServe 官方集成方案       |
| [05-production-architecture.md](./05-production-architecture.md) | 生产级架构设计                |
| [06-streaming-rag.md](./06-streaming-rag.md)                     | 流式 API 与 RAG 开发        |
| [07-deployment.md](./07-deployment.md)                           | Docker/K8s 部署指南        |
| [08-open-source-projects.md](./08-open-source-projects.md)       | 开源项目推荐（GitHub + Gitee） |


## LangChain Python 核心概念

基于 LangChain Python 最新文档，核心 API:

```python
# 创建 Agent
from langchain.agents import create_agent

agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[get_weather],
    system_prompt="You are a helpful assistant",
)

# 运行 Agent
agent.invoke(
    {"messages": [{"role": "user", "content": "what is the weather in sf"}]}
)
```

```python
# 初始化聊天模型
from langchain.chat_models import init_chat_model

model = init_chat_model(
    "claude-sonnet-4-6",
    temperature=0.5,
    timeout=10,
    max_tokens=1000
)
```

```python
# 定义工具
from langchain.tools import tool

@tool
def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's sunny in {city}!"
```

