# LangServe 官方集成方案

> LangServe GitHub: https://github.com/langchain-ai/langserve (2,280+ stars)
> 注意: LangServe 已进入维护模式，新项目推荐使用 LangGraph Platform

## 什么是 LangServe?

LangServe 是 LangChain 官方的 Python 库，帮助开发者将 LangChain Runnable 和 Chain 部署为 REST API。基于 FastAPI 构建，内置 Pydantic 数据验证。

## 安装

```bash
# 安装服务端和客户端
pip install "langserve[all]"

# 仅安装服务端
pip install "langserve[server]"

# 仅安装客户端
pip install "langserve[client]"
```

## 快速开始

### 使用 LangChain CLI 创建项目

```bash
pip install -U langchain-cli
langchain app new my-langserve-app
cd my-langserve-app
```

生成的项目结构:

```
my-langserve-app/
├── app/
│   ├── __init__.py
│   └── server.py
├── packages/
├── .env
├── Dockerfile
├── pyproject.toml
└── README.md
```

### 基础示例

```python
# app/server.py
from fastapi import FastAPI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langserve import add_routes

app = FastAPI(
    title="LangServe Demo",
    version="1.0",
    description="LangChain Runnable exposed as REST API",
)

# 定义 Chain
model = ChatOpenAI(model="gpt-4.1")

# Chain 1: 讲笑话
joke_prompt = ChatPromptTemplate.from_template(
    "Tell me a funny joke about {topic}"
)
joke_chain = joke_prompt | model | StrOutputParser()

# Chain 2: 翻译
translate_prompt = ChatPromptTemplate.from_template(
    "Translate the following to {language}: {text}"
)
translate_chain = translate_prompt | model | StrOutputParser()

# Chain 3: 直接使用模型
chat_model = ChatOpenAI(model="gpt-4.1")

# 注册路由
add_routes(app, joke_chain, path="/joke")
add_routes(app, translate_chain, path="/translate")
add_routes(app, chat_model, path="/chat")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 启动

```bash
# 使用 LangChain CLI
langchain serve

# 或直接使用 uvicorn
uvicorn app.server:app --reload --port 8000
```

## 自动生成的端点

LangServe 为每个注册的 Chain 自动生成以下端点:

| 端点 | 方法 | 说明 |
|------|------|------|
| `/joke/invoke` | POST | 同步调用 |
| `/joke/batch` | POST | 批量调用 |
| `/joke/stream` | POST | 流式输出 |
| `/joke/stream_log` | POST | 流式日志 |
| `/joke/input_schema` | GET | 输入 Schema |
| `/joke/output_schema` | GET | 输出 Schema |
| `/joke/config_schema` | GET | 配置 Schema |
| `/joke/playground/` | GET | 交互式 Playground |

访问 `http://localhost:8000/docs` 查看完整 API 文档。

## 调用示例

### invoke（同步调用）

```bash
curl -X POST http://localhost:8000/joke/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"topic": "cats"}}'
```

### stream（流式输出）

```bash
curl -X POST http://localhost:8000/joke/stream \
  -H "Content-Type: application/json" \
  -d '{"input": {"topic": "dogs"}}'
```

### batch（批量调用）

```bash
curl -X POST http://localhost:8000/joke/batch \
  -H "Content-Type: application/json" \
  -d '{"inputs": [{"topic": "cats"}, {"topic": "dogs"}]}'
```

## 使用 Python 客户端

```python
from langserve import RemoteRunnable

joke_chain = RemoteRunnable("http://localhost:8000/joke")

# 同步调用
result = joke_chain.invoke({"topic": "cats"})
print(result)

# 流式调用
for chunk in joke_chain.stream({"topic": "dogs"}):
    print(chunk, end="", flush=True)

# 批量调用
results = joke_chain.batch([
    {"topic": "cats"},
    {"topic": "dogs"},
])
```

## 高级用法

### 自定义输入/输出类型

```python
from langserve import add_routes
from langserve.pydantic_v1 import BaseModel


class JokeInput(BaseModel):
    topic: str
    style: str = "funny"


class JokeOutput(BaseModel):
    joke: str


add_routes(
    app,
    joke_chain.with_types(input_type=JokeInput, output_type=JokeOutput),
    path="/joke",
)
```

### CORS 中间件

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
```

### 认证保护

```python
from fastapi import Depends, HTTPException, Header


async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != "your-secret-key":
        raise HTTPException(status_code=403, detail="Invalid API key")


add_routes(
    app,
    joke_chain,
    path="/joke",
    dependencies=[Depends(verify_api_key)],
)
```

### 可配置的 Chain

```python
from langchain_core.runnables import ConfigurableField

configurable_model = ChatOpenAI(model="gpt-4.1").configurable_fields(
    model_name=ConfigurableField(
        id="model_name",
        name="Model Name",
        description="The model to use",
    )
)

configurable_chain = joke_prompt | configurable_model | StrOutputParser()

add_routes(app, configurable_chain, path="/configurable-joke")
```

## RAG Chain 示例

```python
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

embeddings = OpenAIEmbeddings()
vectorstore = FAISS.from_texts(
    ["LangChain is a framework for LLM apps."],
    embedding=embeddings,
)
retriever = vectorstore.as_retriever()

rag_prompt = ChatPromptTemplate.from_template(
    "Answer based on context:\n{context}\n\nQuestion: {question}"
)

rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | rag_prompt
    | ChatOpenAI(model="gpt-4.1")
    | StrOutputParser()
)

add_routes(app, rag_chain, path="/rag")
```

## 官方示例项目

- **LangServe Launch Example**: https://github.com/langchain-ai/langserve-launch-example
- **LangServe 仓库示例**: https://github.com/langchain-ai/langserve/tree/main/examples

## 迁移建议

LangServe 已进入维护模式，官方推荐:
- 新项目使用 **LangGraph Platform** 部署
- 现有 LangServe 项目可继续使用，但不会有新功能
- 对于简单 API 需求，可直接使用 **原生 FastAPI + LangChain** 方案
