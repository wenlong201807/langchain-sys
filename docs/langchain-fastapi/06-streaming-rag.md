# 流式 API 与 RAG 应用开发

## 一、流式输出 (Streaming)

流式输出对 LLM 应用至关重要，能显著改善用户体验。

### 1. SSE (Server-Sent Events) 流式

```bash
pip install sse-starlette
```

```python
# app/api/routes/stream.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.dependencies import get_chat_model
import json

router = APIRouter()


class StreamRequest(BaseModel):
    message: str = Field(..., description="用户消息")
    system_prompt: str = Field(default="You are a helpful assistant.")


@router.post("/chat")
async def stream_chat(request: StreamRequest):
    """SSE 流式聊天接口"""
    llm = ChatOpenAI(model="gpt-4.1", streaming=True)

    messages = [
        SystemMessage(content=request.system_prompt),
        HumanMessage(content=request.message),
    ]

    async def event_generator():
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield {
                    "event": "message",
                    "data": json.dumps({"content": chunk.content}),
                }
        yield {"event": "done", "data": json.dumps({"status": "complete"})}

    return EventSourceResponse(event_generator())
```

### 2. 原生 StreamingResponse

```python
@router.post("/chat/raw")
async def stream_chat_raw(request: StreamRequest):
    """原生流式响应"""
    llm = ChatOpenAI(model="gpt-4.1", streaming=True)

    messages = [
        SystemMessage(content=request.system_prompt),
        HumanMessage(content=request.message),
    ]

    async def generate():
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield f"data: {json.dumps({'content': chunk.content})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
```

### 3. Chain 流式

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


@router.post("/chain/stream")
async def stream_chain(request: StreamRequest):
    """Chain 流式输出"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", "{system_prompt}"),
        ("human", "{message}"),
    ])
    llm = ChatOpenAI(model="gpt-4.1", streaming=True)
    chain = prompt | llm | StrOutputParser()

    async def event_generator():
        async for chunk in chain.astream({
            "system_prompt": request.system_prompt,
            "message": request.message,
        }):
            if chunk:
                yield {
                    "event": "message",
                    "data": json.dumps({"content": chunk}),
                }
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
```

### 4. Agent 流式

```python
from langchain.agents import create_agent
from langchain.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's sunny in {city}, 72°F"


@router.post("/agent/stream")
async def stream_agent(request: StreamRequest):
    """Agent 流式输出"""
    agent = create_agent(
        model="gpt-4.1",
        tools=[get_weather],
        system_prompt=request.system_prompt,
    )

    async def event_generator():
        async for event in agent.astream_events(
            {"messages": [{"role": "user", "content": request.message}]},
            version="v2",
        ):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    yield {
                        "event": "token",
                        "data": json.dumps({"content": content}),
                    }
            elif kind == "on_tool_start":
                yield {
                    "event": "tool_start",
                    "data": json.dumps({
                        "tool": event["name"],
                        "input": str(event["data"].get("input", "")),
                    }),
                }
            elif kind == "on_tool_end":
                yield {
                    "event": "tool_end",
                    "data": json.dumps({
                        "tool": event["name"],
                        "output": str(event["data"].get("output", "")),
                    }),
                }
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
```

### 5. 前端消费 SSE

```javascript
// JavaScript 前端示例
const eventSource = new EventSource('/api/v1/stream/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello!' }),
});

// 使用 fetch + ReadableStream (推荐)
async function streamChat(message) {
  const response = await fetch('/api/v1/stream/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.content) {
          process.stdout.write(data.content); // 逐步显示
        }
      }
    }
  }
}
```

## 二、RAG (检索增强生成) 应用

### 1. 基础 RAG 架构

```
用户查询 → 嵌入 → 向量检索 → 组合上下文 → LLM 生成 → 响应
```

### 2. 向量存储设置

```python
# app/rag/vectorstore.py
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma, FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    TextLoader,
    PyPDFLoader,
    DirectoryLoader,
)


class VectorStoreManager:
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.embeddings = OpenAIEmbeddings()
        self.persist_directory = persist_directory
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )

    def load_documents(self, file_path: str):
        """加载文档"""
        if file_path.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        elif file_path.endswith(".txt"):
            loader = TextLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_path}")

        documents = loader.load()
        chunks = self.text_splitter.split_documents(documents)
        return chunks

    def create_vectorstore(self, documents) -> Chroma:
        """创建向量存储"""
        vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=self.embeddings,
            persist_directory=self.persist_directory,
        )
        return vectorstore

    def load_vectorstore(self) -> Chroma:
        """加载已有向量存储"""
        return Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings,
        )

    def get_retriever(self, k: int = 4):
        """获取检索器"""
        vectorstore = self.load_vectorstore()
        return vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": k},
        )
```

### 3. RAG Chain

```python
# app/core/rag_chain.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain_openai import ChatOpenAI


RAG_PROMPT = """Answer the question based only on the following context.
If you cannot find the answer in the context, say "I don't have enough information."

Context:
{context}

Question: {question}

Answer:"""


def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


def create_rag_chain(retriever, model_name: str = "gpt-4.1"):
    """创建 RAG Chain"""
    prompt = ChatPromptTemplate.from_template(RAG_PROMPT)
    llm = ChatOpenAI(model=model_name, temperature=0)

    rag_chain = (
        RunnableParallel(
            context=retriever | format_docs,
            question=RunnablePassthrough(),
        )
        | prompt
        | llm
        | StrOutputParser()
    )

    return rag_chain
```

### 4. RAG API 路由

```python
# app/api/routes/rag.py
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from app.rag.vectorstore import VectorStoreManager
from app.core.rag_chain import create_rag_chain
import json
import tempfile
import os

router = APIRouter()

vs_manager = VectorStoreManager()


class RAGQuery(BaseModel):
    question: str = Field(..., description="查询问题")
    k: int = Field(default=4, description="检索文档数量")


class RAGResponse(BaseModel):
    answer: str
    sources: Optional[List[str]] = None


class UploadResponse(BaseModel):
    message: str
    document_count: int


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """上传文档并创建向量索引"""
    suffix = os.path.splitext(file.filename)[1]
    if suffix not in [".pdf", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF and TXT supported")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        documents = vs_manager.load_documents(tmp_path)
        vs_manager.create_vectorstore(documents)
        return UploadResponse(
            message=f"Successfully indexed {file.filename}",
            document_count=len(documents),
        )
    finally:
        os.unlink(tmp_path)


@router.post("/query", response_model=RAGResponse)
async def rag_query(request: RAGQuery):
    """RAG 查询接口"""
    retriever = vs_manager.get_retriever(k=request.k)
    rag_chain = create_rag_chain(retriever)

    answer = await rag_chain.ainvoke(request.question)

    docs = await retriever.ainvoke(request.question)
    sources = list(set(
        doc.metadata.get("source", "unknown") for doc in docs
    ))

    return RAGResponse(answer=answer, sources=sources)


@router.post("/query/stream")
async def rag_query_stream(request: RAGQuery):
    """RAG 流式查询"""
    retriever = vs_manager.get_retriever(k=request.k)
    rag_chain = create_rag_chain(retriever)

    async def event_generator():
        async for chunk in rag_chain.astream(request.question):
            if chunk:
                yield {
                    "event": "message",
                    "data": json.dumps({"content": chunk}),
                }
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
```

### 5. RAG Agent（带工具的检索 Agent）

```python
# app/core/rag_agent.py
from langchain.agents import create_agent
from langchain.tools import tool
from app.rag.vectorstore import VectorStoreManager

vs_manager = VectorStoreManager()


@tool
def search_knowledge_base(query: str) -> str:
    """Search the knowledge base for relevant information."""
    retriever = vs_manager.get_retriever(k=3)
    docs = retriever.invoke(query)
    if not docs:
        return "No relevant documents found."
    return "\n\n".join(doc.page_content for doc in docs)


@tool
def get_document_list() -> str:
    """Get the list of available documents in the knowledge base."""
    vectorstore = vs_manager.load_vectorstore()
    collection = vectorstore._collection
    return f"Knowledge base contains {collection.count()} document chunks."


def create_rag_agent():
    return create_agent(
        model="gpt-4.1",
        tools=[search_knowledge_base, get_document_list],
        system_prompt="""You are a helpful assistant with access to a knowledge base.
Use the search_knowledge_base tool to find relevant information before answering.
Always cite information from the knowledge base when available.""",
    )
```

## 三、WebSocket 流式（可选）

```python
# app/api/routes/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import json

router = APIRouter()


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()

    llm = ChatOpenAI(model="gpt-4.1", streaming=True)
    history = [SystemMessage(content="You are a helpful assistant.")]

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            history.append(HumanMessage(content=message["content"]))

            full_response = ""
            async for chunk in llm.astream(history):
                if chunk.content:
                    full_response += chunk.content
                    await websocket.send_json({
                        "type": "token",
                        "content": chunk.content,
                    })

            await websocket.send_json({
                "type": "done",
                "content": full_response,
            })

            from langchain_core.messages import AIMessage
            history.append(AIMessage(content=full_response))

    except WebSocketDisconnect:
        pass
```
