# FastAPI + LangChain 开源项目推荐

> 来源: GitHub + Gitee 综合搜索整理

---

## 一、GitHub 项目

### 高星项目（Stars > 100）

#### 1. Langchain-Chatchat

**基于 LangChain 的本地知识库问答应用（中文最佳实践）**

- **GitHub**: https://github.com/chatchat-space/Langchain-Chatchat
- **Gitee 镜像**: https://gitee.com/familyfan/Langchain-Chatchat
- **Stars**: 37,400+
- **Forks**: 6,100+
- **许可证**: Apache 2.0
- **技术栈**: Python + FastAPI + LangChain + ChatGLM/Qwen/Llama
- **特点**:
  - 离线可部署的 RAG 和 Agent 应用
  - 支持中文场景和开源模型
  - 本地知识库问答
  - Web UI + API Server
  - Docker 一键部署
  - 支持 Xinference、Ollama 等推理框架

---

#### 2. LangServe

**LangChain 官方 FastAPI REST API 部署库**

- **GitHub**: https://github.com/langchain-ai/langserve
- **Stars**: 2,280+
- **许可证**: 由 LangChain AI 维护
- **技术栈**: Python + FastAPI
- **特点**:
  - 自动将 LangChain Chain 转为 REST API
  - 内置 /invoke, /batch, /stream 端点
  - 自动生成 Swagger 文档
  - 内置 Playground
  - 注意: 已进入维护模式

---

#### 3. full-stack-ai-agent-template

**全栈 AI Agent 模板（622 Stars）**

- **GitHub**: https://github.com/vstorm-co/full-stack-ai-agent-template
- **Stars**: 622+
- **技术栈**: FastAPI + Next.js + PydanticAI + LangChain + LangGraph + CrewAI + DeepAgents
- **特点**:
  - 5 个 AI 框架集成
  - WebSocket 流式
  - 工具审批 UI
  - 认证系统
  - 多数据库支持
  - 20+ 集成
  - 完全类型安全 + 可观测性

---

#### 4. AgentChat

**多 Agent 协作平台**

- **GitHub**: https://github.com/shy2593666979/agentchat
- **Stars**: 446+
- **技术栈**: FastAPI + Vue 3 + LangChain + LangGraph + Milvus + ElasticSearch
- **特点**:
  - 多 Agent 协作
  - 知识库检索 (RAG)
  - MCP 协议支持
  - 工具调用
  - 任务规划

---

#### 5. LangChain-FastAPI-Streaming

**FastAPI + LangChain 流式 RAG Demo**

- **GitHub**: https://github.com/Coding-Crashkurse/LangChain-FastAPI-Streaming
- **Stars**: 59+
- **技术栈**: FastAPI + LangChain (LCEL) + 前端
- **特点**:
  - 流式 RAG 完整示例
  - LCEL (LangChain Expression Language) 使用
  - 包含前端界面

---

### 实用模板项目

#### 6. fastapi-langgraph-agent-production-ready-template

**生产就绪的 FastAPI + LangGraph Agent 模板**

- **GitHub**: https://github.com/luwhano/fastapi-langgraph-agent-production-ready-template
- **Stars**: 26+
- **技术栈**: FastAPI + LangGraph + Docker + PostgreSQL + Redis
- **特点**:
  - 生产级架构
  - 安全最佳实践
  - 可扩展设计

---

#### 7. fastapi-langchain-streaming

**FastAPI + LangChain 流式 RAG Demo（含前端）**

- **GitHub**: https://github.com/coding-crashkurse/fastapi-langchain-streaming
- **Stars**: 29+
- **技术栈**: FastAPI + LangChain + LCEL
- **特点**: 流式 + 前端界面

---

#### 8. FastAPI-LangChain

**流式聊天 API（SSE 实现）**

- **GitHub**: https://github.com/DmitryDubovikov/FastAPI-LangChain
- **技术栈**: FastAPI + LangChain + OpenAI GPT
- **特点**:
  - Server-Sent Events (SSE) 实时流式
  - CORS 支持
  - 环境变量配置

---

#### 9. fastapi-ai-backend

**从 LangChain Demo 到生产级 FastAPI 后端（系列教程）**

- **GitHub**: https://github.com/hamluk/fastapi-ai-backend
- **技术栈**: FastAPI + LangChain + Pydantic
- **特点**:
  - 完整系列教程博客配套代码
  - 生产级架构模式
  - 依赖注入最佳实践
  - RAG 向量数据库集成

---

#### 10. langserve-launch-example

**LangServe 官方示例应用**

- **GitHub**: https://github.com/langchain-ai/langserve-launch-example
- **技术栈**: LangChain CLI + LangServe + FastAPI
- **特点**: 官方示范项目，包含可部署示例

---

### RAG 应用项目

#### 11. multi-modal-rag-chatbot

**多模态 RAG 聊天机器人**

- **GitHub**: https://github.com/Raiyan27/multi-modal-rag-chatbot
- **技术栈**: LangChain + OpenAI GPT-4 + ChromaDB + FastAPI + Streamlit
- **特点**:
  - 多模态文档问答（文本 + 图像）
  - 语义搜索
  - Docker 容器化
  - 性能优化

---

#### 12. algo-ai (AlgoAI)

**数据结构与算法 RAG 聊天机器人**

- **GitHub**: https://github.com/nchalimba/algo-ai
- **技术栈**: FastAPI + LangChain + OpenAI/Cohere + Datastax Astra DB + Postgres
- **特点**:
  - 流式响应
  - 向量存储
  - 消息持久化

---

#### 13. RAG-LangChain-Start

**生产级 RAG 启动模板**

- **GitHub**: https://github.com/Zchary1106/RAG-LangChain-Start
- **技术栈**: FastAPI + LangChain + Streamlit
- **特点**: 支持多种向量存储

---

#### 14. RAG-Chatbot-with-FastAPI-and-Milvus

**FastAPI + Milvus 向量数据库 RAG 聊天机器人**

- **GitHub**: https://github.com/hollo-he/RAG-Chatbot-with-FastAPI-and-Milvus
- **技术栈**: FastAPI + LangChain + Milvus

---

#### 15. RAG-ChatBot

**全栈 RAG 聊天机器人**

- **GitHub**: https://github.com/reloadggg/chatbot_rag
- **技术栈**: FastAPI + LangChain + Next.js
- **特点**:
  - 文档向量化
  - SSE 流式回答
  - 权限鉴权
  - 支持 OpenAI + Gemini 多模态

---

### 企业级项目

#### 16. LangChain-Chatbot (法律文档)

**AI 法律文档微服务聊天机器人**

- **GitHub**: https://github.com/techspire0924/LangChain-Chatbot
- **技术栈**: React + FastAPI + LangChain + Redis + pgvector
- **特点**: 基于 RAG 的法律文档支持

---

#### 17. Production-Grade-Deployment-LLM-As-API

**生产级 LLM API 部署**

- **GitHub**: https://github.com/david080198/production-grade-deployment-llm-as-api-with-langchain-and-fastapi
- **技术栈**: FastAPI + LangChain
- **特点**: 高效 LLM API 部署方案

---

## 二、Gitee 项目

### 1. LangGraphChatBot

**LangGraph + DeepSeek + FastAPI + Gradio 智能客服**

- **Gitee**: https://gitee.com/heapstone_admin/LangGraphChatBot
- **技术栈**: LangGraph + DeepSeek-R1 + FastAPI + Gradio
- **特点**:
  - 带记忆功能的流量包推荐智能客服
  - 支持 GPT / 国产大模型(OneApi) / Ollama / 通义千问
  - 短期/长期记忆
  - PostgreSQL 持久化
  - RAG Agent + 工具调用
  - 动态路由意图识别

---

### 2. Langchain-Chatchat (Gitee 镜像)

**基于 LangChain 的离线知识库问答**

- **Gitee**: https://gitee.com/familyfan/Langchain-Chatchat
- **GitHub 原始**: https://github.com/chatchat-space/Langchain-Chatchat
- **特点**: 同上 GitHub 版本

---

### 3. openAgent

**企业级智能 Agent 平台**

- **Gitee**: https://gitee.com/masx200/openAgent
- **GitHub 原始**: https://github.com/lkpAgent/openAgent
- **技术栈**: Vue.js + FastAPI + PostgreSQL + LangChain/LangGraph
- **特点**:
  - 智能问答
  - 知识库管理
  - 工作流编排
  - Agent 编排
  - LangGraph 状态图 + 条件路由
  - Function Calling + MCP 协议
  - 用户级数据隔离
  - 自定义 DAG 工作流引擎

---

### 4. LangChat

**Java 生态 AI 大模型产品解决方案**

- **Gitee**: https://gitee.com/panwenze/langchat
- **技术栈**: Java + 多模型集成
- **特点**:
  - 企业级 AI 知识库 + AI 机器人
  - 支持: 智谱清言 / 通义 / 千帆 / DeepSeek / 豆包 / OpenAI / Gemini / Ollama / Claude
  - 知识库向量化
  - RAG 插件
  - 函数调用

---

### 5. langchain-ChatGLM

**LangChain + ChatGLM 本地知识库问答**

- **Gitee**: https://gitee.com/turbidsoul/langchain-ChatGLM
- **技术栈**: Python + LangChain + ChatGLM
- **特点**: 本地知识库问答、API 服务器、Web UI

---

## 三、项目选型指南

| 需求场景 | 推荐项目 | 理由 |
|---------|---------|------|
| **中文知识库问答** | Langchain-Chatchat | 37K+ Stars，中文最佳实践 |
| **全栈 AI Agent** | full-stack-ai-agent-template | 622 Stars，5 框架集成 |
| **快速 API 原型** | LangServe | 官方方案，开箱即用 |
| **流式 RAG** | LangChain-FastAPI-Streaming | 完整流式示例 |
| **生产级模板** | fastapi-langgraph-agent | Docker + PostgreSQL + Redis |
| **多 Agent 协作** | AgentChat | 446 Stars，MCP 支持 |
| **DeepSeek 国产模型** | LangGraphChatBot | Gitee，支持国产模型 |
| **企业级 Agent 平台** | openAgent | 完整工作流 + Agent 编排 |
| **架构学习** | fastapi-ai-backend | 配套系列教程博客 |
| **多模态 RAG** | multi-modal-rag-chatbot | 文本+图像问答 |

## 四、相关教程链接

| 教程 | 链接 |
|------|------|
| 从 Demo 到生产级 FastAPI 后端 | https://dev.to/hamluk/from-langchain-demos-to-a-production-ready-fastapi-backend-1c0a |
| LangServe 构建 REST API | https://koyeb.com/tutorials/using-langserve-to-build-rest-apis-for-langchain-applications |
| 部署 LangChain API 完整指南 | https://langchain-tutorials.github.io/deploy-langchain-api-production-guide-aws-azure-gcp/ |
| Docker + K8s 部署 LangChain | https://langchain-tutorials.github.io/deploy-langchain-api-docker-kubernetes-2026/ |
| LangChain 2026 生产部署 | https://langchain-tutorials.github.io/deploy-langchain-production-2026/ |
| LangServe 官方介绍 | https://blog.langchain.com/introducing-langserve |
