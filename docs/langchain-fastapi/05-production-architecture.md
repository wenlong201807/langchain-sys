# 生产级架构设计

> 参考: https://dev.to/hamluk/from-langchain-demos-to-a-production-ready-fastapi-backend-1c0a

## 设计原则

大多数 LangChain 示例停留在笔记本或 Streamlit 演示阶段。一旦 AI 成为 API 的一部分，它必须遵循与其他后端组件相同的规则:

1. **可预测的输出** — 可被验证和消费
2. **AI 逻辑封装** — 与 HTTP 关注点分离
3. **显式依赖编排** — 依赖注入而非硬编码
4. **清晰的请求/响应契约** — Pydantic 模型定义

## 架构层次

```
┌─────────────────────────────────────────────┐
│              API 层 (FastAPI Router)          │
│  - 请求验证 (Pydantic)                       │
│  - 响应序列化                                 │
│  - 错误处理                                   │
├─────────────────────────────────────────────┤
│              依赖注入层 (Depends)              │
│  - Settings 配置                              │
│  - LLM 实例化                                 │
│  - 数据库连接                                  │
├─────────────────────────────────────────────┤
│              业务逻辑层 (Service)              │
│  - Chain 编排                                 │
│  - Agent 逻辑                                 │
│  - Prompt 管理                                │
├─────────────────────────────────────────────┤
│              AI 核心层 (LangChain)            │
│  - 模型调用                                   │
│  - 工具执行                                   │
│  - 记忆管理                                   │
├─────────────────────────────────────────────┤
│              基础设施层                        │
│  - 数据库 / 向量存储 / 缓存                    │
└─────────────────────────────────────────────┘
```

## 1. 严格的 API 契约

```python
# app/api/schemas/insight.py
from pydantic import BaseModel, Field, field_validator


class InsightQuery(BaseModel):
    """请求模型 — 严格定义输入"""
    question: str = Field(..., min_length=1, max_length=5000)
    context: str = Field(..., min_length=1, max_length=50000)


class Insight(BaseModel):
    """响应模型 — 即使 AI 产生不完美值也确保一致性"""
    title: str
    summary: str
    confidence: float

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, v):
        if v is None:
            return 0.0
        return max(0.0, min(1.0, float(v)))
```

## 2. 依赖注入 LLM

```python
# app/dependencies.py
from fastapi import Depends
from langchain_openai import ChatOpenAI
from langchain_core.language_models import BaseChatModel
from app.config import Settings, get_settings


def get_chat_model(settings: Settings = Depends(get_settings)) -> BaseChatModel:
    """LLM 作为 FastAPI 依赖 — 与数据库连接无异"""
    return ChatOpenAI(
        model=settings.openai_model,
        temperature=settings.openai_temperature,
        api_key=settings.openai_api_key,
    )


def get_embedding_model(settings: Settings = Depends(get_settings)):
    """嵌入模型依赖"""
    from langchain_openai import OpenAIEmbeddings
    return OpenAIEmbeddings(api_key=settings.openai_api_key)
```

优势:
- 端点保持聚焦于编排
- 配置集中管理
- 测试时可轻松替换或 Mock

## 3. 封装 LangChain 逻辑

```python
# app/core/chains.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.language_models import BaseChatModel
from app.api.schemas.insight import Insight


def run_insight_chain(
    llm: BaseChatModel,
    question: str,
    context: str,
) -> Insight:
    """封装的 Chain 逻辑 — 端点无需知道 Chain 如何构建"""
    parser = PydanticOutputParser(pydantic_object=Insight)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert analyst. {format_instructions}"),
        ("human", "Analyze: {question}\n\nContext: {context}"),
    ])

    chain = prompt | llm | parser

    response = chain.invoke({
        "format_instructions": parser.get_format_instructions(),
        "question": question,
        "context": context,
    })

    return response
```

## 4. 薄编排层端点

```python
# app/api/routes/insight.py
from fastapi import APIRouter, Depends
from langchain_core.language_models import BaseChatModel
from app.dependencies import get_chat_model
from app.api.schemas.insight import InsightQuery, Insight
from app.core.chains import run_insight_chain

router = APIRouter()


@router.post("/query", response_model=Insight)
async def create_insight(
    request: InsightQuery,
    llm: BaseChatModel = Depends(get_chat_model),
):
    """端点仅负责编排 — 不包含业务逻辑"""
    response = run_insight_chain(
        llm=llm,
        question=request.question,
        context=request.context,
    )
    return response
```

## 5. Prompt 管理

### 外部化 Prompt

```python
# app/core/prompts.py
import json
from pathlib import Path
from dataclasses import dataclass


@dataclass
class PromptMessages:
    system: str
    human: str


def load_prompt(prompt_dir: str, name: str, version: str = "v1") -> PromptMessages:
    """从文件加载 Prompt 模板"""
    prompt_path = Path(prompt_dir) / name / f"{version}.json"
    with open(prompt_path) as f:
        data = json.load(f)
    return PromptMessages(system=data["system"], human=data["human"])
```

### Prompt 文件

```json
// prompts/insight/v1.json
{
  "system": "You are an expert analyst. Always provide structured analysis with a title, summary, and confidence score. {format_instructions}",
  "human": "Analyze the following question in the given context.\n\nQuestion: {question}\n\nContext: {context}"
}
```

## 6. 错误处理

```python
# app/middleware/error_handler.py
from fastapi import Request
from fastapi.responses import JSONResponse
from langchain_core.exceptions import OutputParserException
import logging

logger = logging.getLogger(__name__)


async def langchain_error_handler(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except OutputParserException as e:
        logger.warning(f"LLM output parsing failed: {e}")
        return JSONResponse(
            status_code=422,
            content={
                "error": "ai_output_parse_error",
                "detail": "AI generated an invalid response format. Please try again.",
            },
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "detail": "An internal error occurred.",
            },
        )
```

```python
# 在 main.py 中注册
from app.middleware.error_handler import langchain_error_handler

app.middleware("http")(langchain_error_handler)
```

## 7. 重试与降级

```python
# app/core/resilience.py
from langchain_openai import ChatOpenAI
from langchain_core.language_models import BaseChatModel
import asyncio
import logging

logger = logging.getLogger(__name__)


async def invoke_with_retry(
    llm: BaseChatModel,
    messages: list,
    max_retries: int = 3,
    backoff_factor: float = 1.0,
):
    """带重试和指数退避的 LLM 调用"""
    for attempt in range(max_retries):
        try:
            return await llm.ainvoke(messages)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait_time = backoff_factor * (2 ** attempt)
            logger.warning(
                f"LLM call failed (attempt {attempt + 1}/{max_retries}): {e}. "
                f"Retrying in {wait_time}s..."
            )
            await asyncio.sleep(wait_time)


def create_model_with_fallback(
    primary_model: str = "gpt-4.1",
    fallback_model: str = "gpt-4.1-mini",
) -> BaseChatModel:
    """创建带降级的模型"""
    primary = ChatOpenAI(model=primary_model)
    fallback = ChatOpenAI(model=fallback_model)
    return primary.with_fallbacks([fallback])
```

## 8. 测试策略

```python
# tests/test_insight.py
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from app.main import app

client = TestClient(app)


def test_insight_endpoint():
    """使用 Mock LLM 测试端点"""
    mock_response = MagicMock()
    mock_response.content = '{"title": "Test", "summary": "Test summary", "confidence": 0.9}'

    with patch("app.dependencies.get_chat_model") as mock_llm:
        mock_llm.return_value.invoke.return_value = mock_response

        response = client.post(
            "/api/v1/insight/query",
            json={
                "question": "What is AI?",
                "context": "AI is artificial intelligence.",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "summary" in data
        assert 0 <= data["confidence"] <= 1
```

## 架构扩展方向

这个基础架构可向以下方向扩展:

1. **RAG** — 添加检索器作为另一个依赖
2. **Agent** — 用 Agent 逻辑替换 Chain 函数，无需修改端点契约
3. **状态管理** — 在核心流程上分层添加
4. **错误管理** — 分层添加而无需重写核心流程
5. **缓存** — 添加 Redis 缓存层减少 LLM 调用
6. **监控** — 集成 LangSmith 追踪
