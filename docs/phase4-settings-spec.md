# 设置页面 -- 详细需求文档

## 一、概述

设置页面用于管理系统运行时配置，包括 LLM 模型、Embedding 模型、检索参数等。支持本地 Ollama 和远程 OpenAI 兼容 API 两种模式。

### 设计原则

- 配置修改即时生效（无需重启服务）
- Embedding 模型切换需明确告知用户影响（向量重建）
- 远程 API 配置需提供连通性测试
- 敏感信息（API Key）不在前端明文展示

---

## 二、配置分组

### 2.1 LLM 模型配置

| 配置项 | 字段名 | 类型 | 默认值 | 说明 |
|--------|--------|------|--------|------|
| 推理模式 | `llm_provider` | enum | `ollama` | `ollama` / `openai_compatible` |
| Ollama 地址 | `ollama_base_url` | string | `http://localhost:11434` | Ollama 服务地址 |
| Ollama 模型 | `ollama_model` | string | `qwen2.5:7b` | 从 Ollama API 拉取可选列表 |
| 远程 API 地址 | `llm_api_base_url` | string | - | OpenAI 兼容 API 的 base URL |
| 远程 API Key | `llm_api_key` | string | - | Bearer token，存储加密/脱敏显示 |
| 远程模型名称 | `llm_model_name` | string | - | 如 `gpt-4o`、`deepseek-chat` 等 |

**交互逻辑：**
- 选择 `ollama` 模式时，显示 Ollama 地址 + 模型选择下拉框
- 选择 `openai_compatible` 模式时，显示 API 地址 + API Key + 模型名称输入框
- 两种模式均提供"测试连接"按钮

### 2.2 Embedding 模型配置

| 配置项 | 字段名 | 类型 | 默认值 | 说明 |
|--------|--------|------|--------|------|
| Embedding 模式 | `embedding_provider` | enum | `local` | `local` / `openai_compatible` |
| 本地模型名称 | `embedding_model` | string | `BAAI/bge-small-zh-v1.5` | HuggingFace 模型标识 |
| 远程 API 地址 | `embedding_api_base_url` | string | - | OpenAI 兼容 embedding API |
| 远程 API Key | `embedding_api_key` | string | - | Bearer token |
| 远程模型名称 | `embedding_model_name` | string | - | 如 `text-embedding-3-small` |

**索引重建警告机制：**

当用户修改以下任一配置时触发警告：
- Embedding 相关：`embedding_provider`、`embedding_model`、`embedding_model_name`、`embedding_api_base_url`
- 分段相关：`chunk_size`、`chunk_overlap`

1. 前端弹出警告对话框：
   ```
   ⚠️ 修改 Embedding 模型或分段参数后，已有文档的向量索引将失效。
   
   需要对所有知识库重新分段并重建索引才能正常检索。
   重建耗时取决于文档数量，期间检索功能不可用。
   
   [ 取消 ]  [ 保存配置并稍后重建 ]  [ 保存配置并立即重建 ]
   ```

2. 选择"保存配置并稍后重建"：
   - 保存新配置
   - 在设置页面和对话页面顶部显示持久警告条："Embedding/分段配置已变更，索引需要重建，检索结果可能不准确。[立即重建]"

3. 选择"保存配置并立即重建"：
   - 保存新配置
   - 触发全量重建任务（异步）
   - 跳转到重建进度页面或显示进度条

### 2.3 检索参数配置

| 配置项 | 字段名 | 类型 | 默认值 | 范围 | 说明 |
|--------|--------|------|--------|------|------|
| 检索返回条数 | `search_top_k` | int | `5` | 1-20 | 每次检索返回的分段数 |
| 分段大小 | `chunk_size` | int | `500` | 100-2000 | 文档分段字符数 |
| 分段重叠 | `chunk_overlap` | int | `50` | 0-500 | 相邻分段重叠字符数 |
| 默认检索模式 | `search_mode` | enum | `hybrid` | - | `hybrid` / `semantic` / `fulltext` |
| 语义权重 | `semantic_weight` | float | `0.5` | 0-1 | 混合检索中语义检索权重 |
| 全文权重 | `fulltext_weight` | float | `0.5` | 0-1 | 混合检索中全文检索权重 |

**注意：** 修改 `chunk_size` / `chunk_overlap` 会导致已有文档的分段失效，需要重新分段 + 重新 embedding + 重建索引。与 Embedding 模型变更共用同一套重建警告机制（见 2.2 节）。

### 2.4 对话参数配置

| 配置项 | 字段名 | 类型 | 默认值 | 范围 | 说明 |
|--------|--------|------|--------|------|------|
| 对话历史轮数 | `chat_history_rounds` | int | `5` | 1-20 | 携带最近 N 轮对话作为上下文 |

### 2.5 HuggingFace 镜像配置

| 配置项 | 字段名 | 类型 | 默认值 | 说明 |
|--------|--------|------|--------|------|
| HF 镜像地址 | `hf_endpoint` | string | `https://hf-mirror.com` | 国内加速镜像 |

---

## 三、后端 API 设计

### 3.1 数据存储

使用已有的 `app_settings` 表（key-value 结构）：

```python
# 存储格式
key: "llm_provider"       value: "ollama"
key: "ollama_base_url"    value: "http://localhost:11434"
key: "llm_api_key"        value: "sk-***"  # 加密存储
```

### 3.2 接口定义

#### GET /api/v1/settings

获取所有配置，合并默认值。API Key 类字段脱敏返回。

**Response:**
```json
{
  "llm_provider": "ollama",
  "ollama_base_url": "http://localhost:11434",
  "ollama_model": "qwen2.5:7b",
  "llm_api_base_url": "",
  "llm_api_key": "sk-****1234",
  "llm_model_name": "",
  "embedding_provider": "local",
  "embedding_model": "BAAI/bge-small-zh-v1.5",
  "embedding_api_base_url": "",
  "embedding_api_key": "sk-****5678",
  "embedding_model_name": "",
  "search_top_k": 5,
  "chunk_size": 500,
  "chunk_overlap": 50,
  "search_mode": "hybrid",
  "semantic_weight": 0.5,
  "fulltext_weight": 0.5,
  "chat_history_rounds": 5,
  "hf_endpoint": "https://hf-mirror.com",
  "index_rebuild_needed": false,
  "rebuild_reason": null
}
```

`index_rebuild_needed` 字段：标记是否需要重建索引。
`rebuild_reason` 字段：`"embedding_changed"` | `"chunk_params_changed"` | `"both"` | `null`

#### PUT /api/v1/settings

更新配置。

**Request:**
```json
{
  "llm_provider": "openai_compatible",
  "llm_api_base_url": "https://api.deepseek.com/v1",
  "llm_api_key": "sk-xxx",
  "llm_model_name": "deepseek-chat"
}
```

**逻辑：**
- 仅更新传入的字段
- 如果 embedding 或分段相关字段变更，设置 `index_rebuild_needed = true` 并记录 `rebuild_reason`
- 更新后热刷新运行时配置（不重启服务）
- API Key 为空字符串时表示清除，不传则不修改

**Response:**
```json
{
  "success": true,
  "index_rebuild_needed": true,
  "rebuild_reason": "chunk_params_changed",
  "message": "配置已保存。分段参数已变更，建议重建索引。"
}
```

#### GET /api/v1/settings/models

获取可用模型列表。

**Query Params:**
- `provider`: `ollama` | `openai_compatible`
- `base_url`: (可选) 覆盖当前配置的地址
- `api_key`: (可选) 覆盖当前配置的 key

**Response (ollama):**
```json
{
  "models": [
    {"name": "qwen2.5:7b", "size": "4.7 GB", "modified_at": "2025-01-01T00:00:00Z"},
    {"name": "llama3:8b", "size": "4.9 GB", "modified_at": "2025-01-01T00:00:00Z"}
  ]
}
```

**Response (openai_compatible):**
```json
{
  "models": [
    {"name": "deepseek-chat"},
    {"name": "deepseek-reasoner"}
  ]
}
```

#### POST /api/v1/settings/test-connection

测试连接（LLM 或 Embedding）。

**Request:**
```json
{
  "type": "llm",
  "provider": "ollama",
  "base_url": "http://localhost:11434",
  "api_key": "",
  "model": "qwen2.5:7b"
}
```

**Response (成功):**
```json
{
  "status": "ok",
  "message": "连接成功",
  "latency_ms": 120
}
```

**Response (失败):**
```json
{
  "status": "error",
  "message": "连接超时，请检查 Ollama 服务是否已启动"
}
```

#### POST /api/v1/settings/rebuild-index

触发全量向量索引重建。

**Response:**
```json
{
  "task_id": "rebuild_20260510_001",
  "total_documents": 42,
  "message": "重建任务已启动"
}
```

#### GET /api/v1/settings/rebuild-index/status

查询重建进度。

**Response:**
```json
{
  "status": "running",
  "total": 42,
  "completed": 15,
  "failed": 0,
  "current_document": "产品手册.pdf",
  "progress_percent": 35.7
}
```

重建完成后自动清除 `embedding_changed` 标记。

---

## 四、后端实现要点

### 4.1 配置热更新

```python
# 设置更新后刷新运行时对象
async def apply_settings(updated_keys: dict):
    if any(k in updated_keys for k in ["llm_provider", "ollama_base_url", "ollama_model", ...]):
        # 重新初始化 RAGService
        refresh_rag_service()
    
    if any(k in updated_keys for k in ["embedding_provider", "embedding_model", ...]):
        # 重新加载 Embedding 模型（本地模式）或切换到远程
        refresh_embedding_service()
```

### 4.2 远程 Embedding 适配

新增 `RemoteEmbeddingService`，与现有 `EmbeddingService` 实现相同接口：

```python
class RemoteEmbeddingService:
    """OpenAI 兼容的远程 Embedding 服务"""
    
    async def encode(self, texts: list[str]) -> list[list[float]]:
        # POST {base_url}/embeddings
        # body: {"input": texts, "model": model_name}
        ...
    
    async def encode_single(self, text: str) -> list[float]:
        ...
```

### 4.3 远程 LLM 适配

新增 OpenAI 兼容的 LLM 调用路径：

```python
class OpenAICompatibleRAGService:
    """OpenAI 兼容 API 的 RAG 服务"""
    
    async def chat_stream(self, ...):
        # POST {base_url}/chat/completions
        # headers: {"Authorization": "Bearer {api_key}"}
        # body: {"model": model_name, "messages": [...], "stream": true}
        # 解析 SSE: data: {"choices": [{"delta": {"content": "..."}}]}
        ...
```

### 4.4 索引重建流程

根据变更类型分两种重建路径：

**路径 A：仅 Embedding 模型变更（chunk_size/overlap 未变）**
```
1. 标记所有文档状态为 "reindexing"
2. 遍历所有知识库：
   a. 清空对应 ChromaDB collection
   b. 读取已有 document_chunk 表中的 content
   c. 使用新 Embedding 模型重新计算向量
   d. 写入 ChromaDB
   e. 更新文档状态为 "completed"
3. 清除 index_rebuild_needed 标记
4. 失败的文档标记为 "failed" 并记录错误
```

**路径 B：chunk_size / chunk_overlap 变更（需重新分段）**
```
1. 标记所有文档状态为 "reindexing"
2. 遍历所有知识库：
   a. 清空对应 ChromaDB collection
   b. 删除 document_chunk 表中该知识库的所有 chunks
   c. 清理 FTS5 索引中对应记录
   d. 重新读取原始文档文件，按新参数分段
   e. 写入 document_chunk 表 + FTS5 索引
   f. 使用 Embedding 模型计算向量
   g. 写入 ChromaDB
   h. 更新文档 chunk_count 和状态为 "completed"
3. 清除 index_rebuild_needed 标记
4. 失败的文档标记为 "failed" 并记录错误
```

**注意：** 路径 B 依赖原始文件仍存在于 `data/uploads` 目录。如果文件已被删除，该文档标记为 failed 并提示用户重新上传。

---

## 五、前端页面设计

### 5.1 页面布局

```
┌─────────────────────────────────────────────────────┐
│  系统设置                                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [⚠️ Embedding 模型已变更，索引需要重建] [立即重建]    │  ← 条件显示
│                                                     │
│  ┌─ LLM 模型配置 ─────────────────────────────────┐ │
│  │  推理模式:  (●) Ollama  ( ) OpenAI 兼容 API     │ │
│  │                                                 │ │
│  │  --- Ollama 模式 ---                            │ │
│  │  服务地址: [http://localhost:11434    ]          │ │
│  │  模型:     [qwen2.5:7b           ▼] [刷新]     │ │
│  │                                                 │ │
│  │  [测试连接]  ✅ 连接成功 (120ms)                  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Embedding 模型配置 ───────────────────────────┐ │
│  │  Embedding 模式:  (●) 本地模型  ( ) 远程 API    │ │
│  │                                                 │ │
│  │  --- 本地模式 ---                               │ │
│  │  模型: [BAAI/bge-small-zh-v1.5        ]         │ │
│  │  HF 镜像: [https://hf-mirror.com     ]         │ │
│  │                                                 │ │
│  │  [测试连接]                                     │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ 检索参数 ─────────────────────────────────────┐ │
│  │  检索返回条数 (top_k): [5    ]                  │ │
│  │  默认检索模式: [混合检索 ▼]                      │ │
│  │  语义权重: [====●=====] 0.5                     │ │
│  │  全文权重: [====●=====] 0.5                     │ │
│  │                                                 │ │
│  │  分段大小: [500  ] 字符                          │ │
│  │  分段重叠: [50   ] 字符                          │ │
│  │  ⚠️ 修改分段参数需要重建所有文档索引               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ 对话参数 ─────────────────────────────────────┐ │
│  │  对话历史轮数: [5    ]                           │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│              [恢复默认值]          [保存配置]         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 交互细节

**LLM 模式切换：**
- 切换 radio 后，对应配置区域以动画展开/收起
- Ollama 模式：模型下拉框从 `GET /settings/models?provider=ollama` 获取
- OpenAI 兼容模式：模型名称为手动输入（远程 API 不一定支持 list models）

**Embedding 模式切换：**
- 切换时如果已有知识库文档，立即弹出警告对话框
- 本地模型输入框带 placeholder 提示格式：`组织名/模型名`

**测试连接按钮：**
- 点击后显示 loading spinner
- 成功：绿色勾 + 延迟信息
- 失败：红色叉 + 错误原因

**保存配置：**
- 表单校验通过后提交
- 如果 embedding 配置变更，弹出确认对话框（见 2.2 节）
- 保存成功后 toast 提示

**恢复默认值：**
- 二次确认后重置所有配置为代码中的默认值
- 如果 embedding 模型被重置且与当前不同，同样触发警告

### 5.3 索引重建进度

点击"立即重建"后，在页面内显示进度区域：

```
┌─ 索引重建中 ──────────────────────────────────────┐
│  [████████░░░░░░░░░░░░] 35.7%                     │
│  正在处理: 产品手册.pdf (15/42)                     │
│  失败: 0                                           │
│                                                    │
│  [取消重建]                                        │
└────────────────────────────────────────────────────┘
```

前端每 2 秒轮询 `GET /settings/rebuild-index/status`，完成后自动停止。

---

## 六、校验规则

| 字段 | 校验 |
|------|------|
| `ollama_base_url` | 必填，合法 URL 格式 |
| `llm_api_base_url` | openai_compatible 模式下必填，合法 URL |
| `llm_api_key` | openai_compatible 模式下必填 |
| `llm_model_name` | openai_compatible 模式下必填 |
| `embedding_model` | local 模式下必填，格式 `org/model` |
| `embedding_api_base_url` | openai_compatible 模式下必填 |
| `embedding_api_key` | openai_compatible 模式下必填 |
| `search_top_k` | 整数，1-20 |
| `chunk_size` | 整数，100-2000 |
| `chunk_overlap` | 整数，0-500，且 < chunk_size |
| `chat_history_rounds` | 整数，1-20 |
| `semantic_weight` + `fulltext_weight` | 各自 0-1 |

---

## 七、后端文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/api/v1/app_settings.py` | 重写 | 实现完整的设置 CRUD + 测试连接 + 重建索引 |
| `app/schemas/settings.py` | 新建 | 设置相关的 Pydantic schemas |
| `app/services/settings.py` | 新建 | 配置读写、默认值合并、热更新逻辑 |
| `app/services/embedding.py` | 修改 | 抽象接口，支持本地/远程两种实现 |
| `app/services/remote_embedding.py` | 新建 | OpenAI 兼容远程 Embedding 服务 |
| `app/services/rag.py` | 修改 | 支持 OpenAI 兼容 API 调用路径 |
| `app/services/index_rebuild.py` | 新建 | 全量索引重建任务 |
| `app/core/config.py` | 修改 | 默认值常量提取，支持运行时覆盖 |

### 前端文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/SettingsPage.tsx` | 重写 | 完整设置表单 |
| `src/api/settings.ts` | 新建 | 设置相关 API 调用 |
| `src/types/settings.ts` | 新建 | 设置相关类型定义 |
| `src/components/RebuildProgress.tsx` | 新建 | 索引重建进度组件 |
| `src/components/ConnectionTest.tsx` | 新建 | 连接测试按钮组件 |
| `src/components/EmbeddingWarning.tsx` | 新建 | Embedding 变更警告条 |

---

## 八、注意事项

1. **API Key 安全**：存储时可简单 base64 编码（本地部署无需强加密），返回时仅显示末 4 位
2. **热更新边界**：Embedding 本地模型切换需要重新加载模型到内存，可能耗时数秒，需 loading 状态
3. **并发安全**：索引重建期间，新的文档上传应排队等待或拒绝
4. **向后兼容**：`app_settings` 表为空时，所有配置取 `config.py` 中的默认值，系统正常运行
5. **OpenAI 兼容范围**：支持标准 `/v1/chat/completions` 和 `/v1/embeddings` 接口的服务（DeepSeek、智谱、月之暗面、OpenRouter 等）
