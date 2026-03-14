# FastAPI + LangChain 基础集成教程

## 1. 最简单的 Chat API

### 请求/响应模型定义

```python
# app/api/schemas/chat.py
from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    message: str = Field(..., description="用户输入消息")
    model: str = Field(default="gpt-4.1", description="模型名称")
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=2000, ge=1, le=100000)


class ChatResponse(BaseModel):
    response: str = Field(..., description="AI 回复内容")
    model: str = Field(..., description="使用的模型")
    usage: Optional[dict] = Field(None, description="Token 使用量")
```

### LLM 初始化（依赖注入）

```python
# app/dependencies.py
from fastapi import Depends
from langchain_openai import ChatOpenAI
from langchain_core.language_models import BaseChatModel
from app.config import Settings, get_settings


def get_llm(settings: Settings = Depends(get_settings)) -> BaseChatModel:
    """通过 FastAPI 依赖注入系统初始化 LLM"""
    return ChatOpenAI(
        model=settings.openai_model,
        temperature=settings.openai_temperature,
        max_tokens=settings.openai_max_tokens,
        api_key=settings.openai_api_key,
    )
```

### Chat 路由

```python
# app/api/routes/chat.py
from fastapi import APIRouter, Depends
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.dependencies import get_llm
from app.api.schemas.chat import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, llm: BaseChatModel = Depends(get_llm)):
    """基础聊天接口"""
    messages = [
        SystemMessage(content="You are a helpful AI assistant."),
        HumanMessage(content=request.message),
    ]
    response = await llm.ainvoke(messages)

    return ChatResponse(
        response=response.content,
        model=request.model,
        usage=response.usage_metadata if hasattr(response, "usage_metadata") else None,
    )
```

## 2. 带对话历史的 Chat API

### 请求模型

```python
# app/api/schemas/chat.py
from pydantic import BaseModel, Field
from typing import List, Literal


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ConversationRequest(BaseModel):
    messages: List[Message] = Field(..., description="对话消息列表")
    system_prompt: str = Field(
        default="You are a helpful AI assistant.",
        description="系统提示词"
    )


class ConversationResponse(BaseModel):
    response: str
    messages: List[Message]
```

### 路由实现

```python
# app/api/routes/chat.py
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


@router.post("/conversation", response_model=ConversationResponse)
async def conversation(
    request: ConversationRequest,
    llm: BaseChatModel = Depends(get_llm),
):
    """带对话历史的聊天接口"""
    lc_messages = [SystemMessage(content=request.system_prompt)]

    for msg in request.messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))

    response = await llm.ainvoke(lc_messages)

    updated_messages = request.messages + [
        Message(role="assistant", content=response.content)
    ]

    return ConversationResponse(
        response=response.content,
        messages=updated_messages,
    )
```

## 3. 使用 Chain (LCEL) 构建 API

LangChain Expression Language (LCEL) 用管道运算符 `|` 组合组件:

```python
# app/core/chains.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field


class InsightResponse(BaseModel):
    """结构化分析结果"""
    title: str = Field(description="分析标题")
    summary: str = Field(description="分析摘要")
    confidence: float = Field(description="置信度 0-1")


def create_analysis_chain(llm: ChatOpenAI):
    """创建分析 Chain"""
    parser = PydanticOutputParser(pydantic_object=InsightResponse)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert analyst. {format_instructions}"),
        ("human", "Analyze the following: {question}\n\nContext: {context}"),
    ])

    chain = prompt | llm | parser
    return chain, parser


def create_simple_chain(llm: ChatOpenAI):
    """创建简单问答 Chain"""
    prompt = ChatPromptTemplate.from_template(
        "Answer the following question concisely: {question}"
    )
    chain = prompt | llm | StrOutputParser()
    return chain
```

### Chain API 路由

```python
# app/api/routes/analysis.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.dependencies import get_llm
from app.core.chains import create_analysis_chain, InsightResponse

router = APIRouter()


class AnalysisRequest(BaseModel):
    question: str = Field(..., description="分析问题")
    context: str = Field(..., description="上下文信息")


@router.post("/analyze", response_model=InsightResponse)
async def analyze(
    request: AnalysisRequest,
    llm=Depends(get_llm),
):
    """结构化分析接口"""
    chain, parser = create_analysis_chain(llm)

    result = await chain.ainvoke({
        "format_instructions": parser.get_format_instructions(),
        "question": request.question,
        "context": request.context,
    })

    return result
```

## 4. Agent API

### 定义工具

```python
# app/core/tools.py
from langchain.tools import tool


@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    return f"Search results for: {query}"


@tool
def calculate(expression: str) -> str:
    """Evaluate a mathematical expression."""
    try:
        result = eval(expression)
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def get_current_time() -> str:
    """Get the current date and time."""
    from datetime import datetime
    return datetime.now().isoformat()
```

### Agent 路由

```python
# app/api/routes/agent.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from langchain.agents import create_agent
from app.dependencies import get_llm
from app.core.tools import search_web, calculate, get_current_time

router = APIRouter()


class AgentRequest(BaseModel):
    message: str = Field(..., description="用户消息")
    thread_id: str = Field(default="default", description="会话线程 ID")


class ToolCall(BaseModel):
    name: str
    args: dict


class AgentResponse(BaseModel):
    response: str
    tool_calls: Optional[List[ToolCall]] = None


@router.post("/invoke", response_model=AgentResponse)
async def invoke_agent(request: AgentRequest):
    """调用 Agent"""
    agent = create_agent(
        model="gpt-4.1",
        tools=[search_web, calculate, get_current_time],
        system_prompt="You are a helpful assistant with access to tools.",
    )

    result = agent.invoke(
        {"messages": [{"role": "user", "content": request.message}]},
        config={"configurable": {"thread_id": request.thread_id}},
    )

    last_message = result["messages"][-1]

    return AgentResponse(
        response=last_message.content,
        tool_calls=None,
    )
```

## 5. 结构化输出 API

使用 Pydantic 模型定义输出格式，让 LLM 返回结构化数据:

```python
# app/api/routes/structured.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from langchain_openai import ChatOpenAI
from app.dependencies import get_llm

router = APIRouter()


class ContactInfo(BaseModel):
    name: str = Field(description="Person's name")
    email: Optional[str] = Field(description="Email address")
    phone: Optional[str] = Field(description="Phone number")
    company: Optional[str] = Field(description="Company name")


class ExtractRequest(BaseModel):
    text: str = Field(..., description="Text to extract information from")


@router.post("/extract-contact", response_model=ContactInfo)
async def extract_contact(
    request: ExtractRequest,
    llm: ChatOpenAI = Depends(get_llm),
):
    """从文本中提取联系信息"""
    structured_llm = llm.with_structured_output(ContactInfo)
    result = await structured_llm.ainvoke(
        f"Extract contact information from: {request.text}"
    )
    return result
```

## 6. 完整 main.py 汇总

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api.routes import chat, agent, analysis, structured

settings = get_settings()

app = FastAPI(
    title="FastAPI + LangChain AI API",
    description="Production-ready AI API service",
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
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["Analysis"])
app.include_router(structured.router, prefix="/api/v1/structured", tags=["Structured"])


@app.get("/")
async def root():
    return {"message": "FastAPI + LangChain AI API", "docs": "/docs"}
```

## cURL 测试示例

```bash
# 基础聊天
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message": "What is machine learning?"}'

# 带对话历史
curl -X POST http://localhost:8000/api/v1/chat/conversation \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "My name is Alice"},
      {"role": "assistant", "content": "Hello Alice!"},
      {"role": "user", "content": "What is my name?"}
    ]
  }'

# Agent 调用
curl -X POST http://localhost:8000/api/v1/agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "What time is it?", "thread_id": "session-1"}'

# 结构化提取
curl -X POST http://localhost:8000/api/v1/structured/extract-contact \
  -H "Content-Type: application/json" \
  -d '{"text": "Contact John Doe at john@example.com or (555) 123-4567"}'
```
