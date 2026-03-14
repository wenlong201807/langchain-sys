# 环境搭建与项目初始化

## 系统要求

- Python 3.10+
- pip / poetry / uv (包管理器)

## 方案一：使用 pip 搭建

### 1. 创建项目目录

```bash
mkdir fastapi-langchain-app && cd fastapi-langchain-app
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows
```

### 2. 安装核心依赖

```bash
# FastAPI 核心
pip install fastapi uvicorn[standard]

# LangChain 核心
pip install langchain langchain-core

# 模型提供商（选择需要的）
pip install langchain-openai        # OpenAI
pip install langchain-anthropic     # Anthropic (Claude)
pip install langchain-google-genai  # Google Gemini

# LangGraph（Agent 持久化和记忆）
pip install langgraph

# 可选：LangServe
pip install "langserve[all]"

# 可选：向量数据库
pip install chromadb        # ChromaDB
pip install faiss-cpu       # FAISS

# 可选：SSE 流式
pip install sse-starlette
```

### 3. 生成 requirements.txt

```bash
pip freeze > requirements.txt
```

## 方案二：使用 Poetry 搭建

```bash
mkdir fastapi-langchain-app && cd fastapi-langchain-app
poetry init
poetry add fastapi uvicorn[standard]
poetry add langchain langchain-core langchain-openai
poetry add langgraph
```

## 方案三：使用 LangChain CLI

```bash
pip install -U langchain-cli
langchain app new my-app
cd my-app
```

这会自动生成包含 LangServe 的项目结构。

## 项目结构

### 推荐的生产级项目结构

```
fastapi-langchain-app/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── config.py             # 配置管理
│   ├── dependencies.py       # 依赖注入
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py       # 聊天 API
│   │   │   ├── agent.py      # Agent API
│   │   │   └── rag.py        # RAG API
│   │   └── schemas/
│   │       ├── __init__.py
│   │       ├── chat.py       # 请求/响应模型
│   │       └── agent.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── llm.py            # LLM 初始化
│   │   ├── agent.py          # Agent 逻辑
│   │   ├── chains.py         # Chain 定义
│   │   └── tools.py          # 工具定义
│   ├── rag/
│   │   ├── __init__.py
│   │   ├── vectorstore.py    # 向量存储
│   │   ├── embeddings.py     # 嵌入模型
│   │   └── retriever.py      # 检索器
│   └── middleware/
│       ├── __init__.py
│       └── auth.py           # 认证中间件
├── tests/
│   ├── __init__.py
│   ├── test_chat.py
│   └── test_agent.py
├── .env                       # 环境变量
├── .env.example               # 环境变量示例
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## 环境变量配置

### .env 文件

```bash
# 应用配置
APP_NAME=FastAPI-LangChain-App
APP_ENV=development
APP_DEBUG=true
APP_PORT=8000

# OpenAI
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4.1

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx

# LangSmith (可选，推荐)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_xxxxx
LANGSMITH_PROJECT=my-fastapi-project

# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# 向量数据库
CHROMA_HOST=localhost
CHROMA_PORT=8001
```

### config.py

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "FastAPI-LangChain-App"
    app_env: str = "development"
    debug: bool = False

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1"
    openai_temperature: float = 0.7
    openai_max_tokens: int = 2000

    # Anthropic
    anthropic_api_key: str = ""

    # LangSmith
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

## main.py 入口文件

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api.routes import chat, agent

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="FastAPI + LangChain AI API Service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(agent.router, prefix="/api/v1/agent", tags=["Agent"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}
```

## 启动服务

```bash
# 开发模式（热重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

访问:
- API 文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health
