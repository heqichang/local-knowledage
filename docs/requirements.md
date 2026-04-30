# 本地知识库 -- 需求文档

## 一、项目概述

### 背景与目标
搭建私有化本地知识库，支持文档导入、智能检索、问答对话、本地离线使用。所有数据不上云，适配个人/小团队内部资料沉淀与快速查询。

### 约束
- 数据本地存储，不对外上传
- 轻量化部署，普通电脑即可运行
- 界面简洁，免复杂配置
- 无需用户登录

---

## 二、技术架构

```
用户浏览器 (React + Vite SPA)
    |
    | HTTP / SSE (流式输出)
    |
FastAPI 后端 (Python 3.11+)
    ├── 文档处理服务 (解析 PDF/Word/TXT/MD/Excel)
    ├── 分段与 Embedding 服务 (sentence-transformers, bge-small-zh)
    ├── 检索服务 (ChromaDB 语义检索 + SQLite FTS5 全文检索)
    ├── RAG 问答服务 (组装 prompt -> Ollama)
    └── 数据持久层
         ├── SQLite + aiosqlite (知识库/文档/对话元数据)
         └── ChromaDB 嵌入式 (向量存储)
    |
    | HTTP (本地回环)
    |
Ollama (本地 LLM 推理服务)
```

### 技术选型

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS, pnpm |
| 后端 | FastAPI + Python 3.11+ |
| LLM 推理 | Ollama (本地部署) |
| 向量数据库 | ChromaDB (嵌入式运行) |
| Embedding | sentence-transformers (BAAI/bge-small-zh) |
| 关系型数据库 | SQLite + aiosqlite |
| 全文检索 | SQLite FTS5 |
| 部署 | Docker Compose (同时支持本地直接运行) |

### 架构要点
- ChromaDB 以嵌入式模式运行在 FastAPI 进程内，无需独立部署
- Embedding 模型在 FastAPI lifespan startup 阶段加载到内存，常驻
- AI 问答使用 SSE (Server-Sent Events) 实现流式输出
- 每个知识库对应一个 ChromaDB collection (`kb_{id}`)
- 无需认证模块，去掉 JWT/auth 相关逻辑

---

## 三、功能需求

### 3.1 文档导入

**前端**：文件选择器（多选）、拖拽上传区域、上传进度条、格式校验、导入状态轮询

**后端**：
- 文件接收与存储
- 格式解析：PDF (pymupdf/pdfplumber), Word (python-docx), Excel (openpyxl), MD/TXT 直接读取
- 文本分段 (RecursiveCharacterTextSplitter, 可配置 chunk_size/overlap)
- Embedding 生成并写入 ChromaDB
- 元数据写入 SQLite

**业务规则**：
- 单文件上限 50MB
- 支持批量导入（文件夹多选）
- 导入为异步任务，前端轮询状态
- 重复文件检测（基于 SHA-256 文件哈希）
- 导入失败记录错误原因

### 3.2 知识库管理

**前端**：知识库列表页（卡片视图）、新建/编辑/删除弹窗、知识库详情页（文档列表）

**后端**：知识库 CRUD、文档 CRUD、删除时同步清理 ChromaDB 向量、知识库统计

**业务规则**：
- 知识库名称唯一
- 删除知识库需二次确认，级联删除所有文档和向量
- 支持知识库描述

### 3.3 智能检索

**前端**：搜索输入框（选择目标知识库）、检索结果列表（高亮关键词）、切换检索模式

**后端**：
- 关键词检索 (SQLite FTS5)
- 语义检索 (query embedding -> ChromaDB 相似度搜索)
- 混合检索 (两路结果合并去重, RRF 排序)
- 返回匹配分段及所属文档信息

**业务规则**：
- 默认混合检索模式
- 可配置返回条数 (top_k, 默认 5)
- 检索结果包含相似度分数和原文定位

### 3.4 AI 问答对话

**前端**：
- 对话界面（类 ChatGPT 布局）
- 消息气泡（用户/AI）、流式输出渲染 (SSE)
- 引用来源折叠展示
- 对话列表侧边栏、新建/删除/重命名对话
- 选择关联知识库

**后端**：
- 接收问题 -> 检索相关分段 -> 组装 RAG prompt -> 调用 Ollama (流式) -> SSE 推送
- 对话和消息持久化到 SQLite
- 引用来源关联

**业务规则**：
- 多轮对话（携带最近 N 轮历史，可配置）
- 每条 AI 回复附带引用来源
- 对话可关联一个或多个知识库
- 支持无知识库的纯对话模式
- 对话标题自动生成（首条消息摘要）

### 3.5 基础设置

**前端**：设置页面表单

**后端**：配置读写（SQLite）、Ollama 连通性检测、模型列表获取

**可配置项**：
- Ollama 服务地址
- LLM 模型选择（从 Ollama API 拉取可用列表）
- Embedding 模型路径
- 分段大小 / 重叠大小
- 检索返回条数 (top_k)
- 对话历史轮数
- 数据存储目录

---

## 四、数据模型

```sql
-- 知识库
knowledge_base (
    id          INTEGER PRIMARY KEY,
    name        VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    document_count INTEGER DEFAULT 0,
    created_at  DATETIME,
    updated_at  DATETIME
)

-- 文档
document (
    id               INTEGER PRIMARY KEY,
    knowledge_base_id INTEGER REFERENCES knowledge_base(id),
    filename         VARCHAR(500),
    file_type        VARCHAR(20),        -- pdf/docx/txt/md/xlsx
    file_size        INTEGER,
    file_hash        VARCHAR(64),        -- SHA-256 去重
    chunk_count      INTEGER DEFAULT 0,
    status           VARCHAR(20),        -- pending/processing/completed/failed
    error_message    TEXT,
    created_at       DATETIME,
    updated_at       DATETIME
)

-- 文档分段
document_chunk (
    id            INTEGER PRIMARY KEY,
    document_id   INTEGER REFERENCES document(id),
    chunk_index   INTEGER,
    content       TEXT,
    chroma_id     VARCHAR(100),          -- ChromaDB 向量 ID
    created_at    DATETIME
)
-- ChromaDB 中同步存储: chroma_id, embedding, metadata{document_id, chunk_index, kb_id}

-- FTS5 全文检索虚拟表
document_chunk_fts USING fts5(content, chunk_id UNINDEXED)

-- 对话
conversation (
    id                INTEGER PRIMARY KEY,
    title             VARCHAR(500),
    knowledge_base_ids JSON,             -- 关联知识库 ID 列表
    created_at        DATETIME,
    updated_at        DATETIME
)

-- 消息
message (
    id              INTEGER PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversation(id),
    role            VARCHAR(20),         -- user/assistant
    content         TEXT,
    references      JSON,                -- [{document_id, chunk_id, content, score}]
    created_at      DATETIME
)

-- 应用配置
app_settings (
    key   VARCHAR(100) PRIMARY KEY,
    value TEXT                            -- JSON 序列化
)
```

---

## 五、API 接口

### 知识库 `/api/v1/knowledge-bases`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 列表（分页） |
| POST | `/` | 创建 |
| GET | `/{id}` | 详情（含统计） |
| PUT | `/{id}` | 更新 |
| DELETE | `/{id}` | 删除（级联） |

### 文档 `/api/v1/knowledge-bases/{kb_id}/documents`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/upload` | 上传（multipart, 支持多文件） |
| GET | `/` | 文档列表 |
| GET | `/{doc_id}` | 文档详情（含分段） |
| DELETE | `/{doc_id}` | 删除文档 |
| GET | `/{doc_id}/status` | 导入状态查询 |

### 检索 `/api/v1/search`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 检索 body: {query, kb_ids[], mode, top_k} |

### 对话 `/api/v1/conversations`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 对话列表 |
| POST | `/` | 新建对话 |
| GET | `/{id}` | 对话详情（含消息历史） |
| PUT | `/{id}` | 更新（标题、关联知识库） |
| DELETE | `/{id}` | 删除对话 |
| POST | `/{id}/chat` | 发送消息 + AI 回复 (SSE 流式) |

### 设置 `/api/v1/settings`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取所有配置 |
| PUT | `/` | 更新配置 |
| GET | `/models` | Ollama 可用模型列表 |
| POST | `/ollama/check` | Ollama 连通性检测 |

---

## 六、页面与路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 对话页 | 默认进入，对话交互主界面 |
| `/chat/:conversationId?` | 对话详情 | 选中某个对话 |
| `/knowledge-bases` | 知识库列表 | 卡片展示所有知识库 |
| `/knowledge-bases/:id` | 知识库详情 | 文档列表、上传入口 |
| `/search` | 智能检索 | 独立检索页面 |
| `/settings` | 系统设置 | 配置项管理 |

**布局**：左侧固定侧边栏（导航 + 对话列表），右侧主内容区

---

## 七、MVP 阶段划分

### Phase 1 -- 基础骨架
- 前后端项目初始化 (Vite + FastAPI)
- Docker Compose 配置 (frontend + backend + ollama)
- SQLite 数据库初始化 + Alembic 迁移
- ChromaDB 嵌入式初始化
- Ollama 连通性验证
- 基础页面布局和路由

### Phase 2 -- 知识库与文档
- 知识库 CRUD 全流程
- 文档上传、解析（先支持 TXT 和 Markdown）
- 文本分段 + Embedding + ChromaDB 写入
- 文档管理界面
- 扩展 PDF、Word、Excel 解析

### Phase 3 -- 检索与问答
- 语义检索 (ChromaDB)
- 全文检索 (SQLite FTS5)
- 混合检索 + RRF 排序
- RAG 问答 (prompt 组装 -> Ollama -> SSE 流式)
- 对话界面 + 流式渲染
- 引用来源展示

### Phase 4 -- 完善体验
- 对话历史持久化 + 对话列表管理
- 多轮对话上下文
- 设置页面
- 批量导入
- 错误处理与边界情况

### Phase 5 -- 打磨上线
- Docker Compose 完整编排
- 生产环境配置
- 性能优化（Embedding 缓存、检索缓存）
- README 使用文档

---

## 八、关键实现文件

| 文件 | 职责 |
|------|------|
| `backend/app/services/rag.py` | RAG 问答核心：prompt 组装、Ollama 调用、流式输出 |
| `backend/app/services/document.py` | 文档解析、分段、Embedding、ChromaDB 写入 |
| `backend/app/services/search.py` | 混合检索：ChromaDB 语义 + SQLite FTS5 全文 |
| `backend/app/core/config.py` | 配置中心：SQLite、ChromaDB、Ollama 配置 |
| `backend/app/db/session.py` | SQLite async session (aiosqlite) |
| `frontend/src/pages/ChatPage.tsx` | 对话主界面：SSE 流式渲染、引用展示 |
| `frontend/src/api/client.ts` | API 客户端（无需 auth 拦截器） |

---

## 九、与 AGENTS.md 的差异说明

AGENTS.md 定义了通用的 React+Vite+FastAPI 最佳实践，本项目有以下调整：
1. **数据库**：SQLite + aiosqlite 替代 PostgreSQL，连接字符串 `sqlite+aiosqlite:///./data/app.db`
2. **认证**：无需登录，移除所有 JWT/auth 中间件
3. **前端 API Client**：去掉 token 拦截器和 401 处理
4. **新增依赖**：ChromaDB、sentence-transformers、文档解析库 (pymupdf, python-docx, openpyxl)
