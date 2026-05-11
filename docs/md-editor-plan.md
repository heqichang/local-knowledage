# MD 编辑器功能 -- 计划文档

## 一、需求概述

在现有「本地知识库」项目基础上，新增 Markdown 编辑器能力，让用户可以：

1. **在线创建笔记**：在 Web 端直接撰写 MD 笔记，作为知识库的一种文档来源，自动分段、Embedding 入库，参与检索与 RAG 问答。
2. **编辑已有 MD 文档**：对已上传 (`file_type = md`) 或在线创建的笔记进行查看与修改，保存后重新生成分段与向量。

### 形态约定
- **分屏所见即所得**：左侧 MD 源码（CodeMirror 6），右侧实时预览（react-markdown）。
- 支持代码块语法高亮（Shiki / highlight.js）和 KaTeX 数学公式。
- 顶部工具栏：保存、撤销/重做、加粗/斜体/标题/列表/链接/代码块/公式快捷插入、分屏切换。

### 非目标（本期不做）
- 自动保存草稿、版本历史、协作编辑
- 图片粘贴上传、附件管理
- 富文本 WYSIWYG 模式、Notion 式块编辑
- 多人协作 / 评论

---

## 二、与现有架构的关系

现有文档来源是「上传文件」，本期新增「在线笔记」作为同等的文档来源，**复用** Document / DocumentChunk 表与现有的分段/Embedding/检索/RAG 链路。

### 关键复用点
- `services/document.py`：分段、Embedding、ChromaDB 写入逻辑下沉为可复用方法，**笔记保存**与**文件上传**共用。
- `models/document.py` (`Document` 表)：新增字段标识「在线笔记」来源，content 直接落库。
- 检索 / RAG / 知识库统计：无需改动，自动覆盖笔记内容。

### 新增/调整
- `Document` 表：新增 `source_type` 字段（`upload` / `note`），`content` 字段（仅 note 落库，便于编辑回显）。
- 文件存储：note 不写入 `data/uploads/`，content 直接存 SQLite；file_hash 基于 content 计算。
- 前端新增「笔记编辑器」页面与工具栏组件。

---

## 三、数据模型变更

### 3.1 Document 表新增字段

```sql
ALTER TABLE document ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'upload';
  -- 'upload' | 'note'
ALTER TABLE document ADD COLUMN content TEXT;
  -- 仅 source_type='note' 时使用，存储 MD 原文；upload 类型保持 NULL
```

说明：
- 已有数据 `source_type` 默认 `upload`，向后兼容。
- `filename`：笔记使用「标题 + .md」，如 `我的笔记.md`。
- `file_size`：笔记按 content 字节长度计算。
- `file_hash`：笔记按 content SHA-256 计算（编辑保存前后比较，无变化则跳过重切分）。
- `file_type`：笔记固定为 `md`。

### 3.2 Alembic 迁移

新增一次 revision：`add_document_source_type_and_content`。

---

## 四、后端改造

### 4.1 新增 / 调整 schema (`schemas/document.py`)

```python
class NoteCreate(BaseModel):
    title: str          # 1~200
    content: str        # MD 原文

class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None

class DocumentResponse(...):
    # 新增字段
    source_type: Literal['upload', 'note']
    content: str | None = None   # 仅 note 返回
```

### 4.2 service 层 (`services/document.py`)

抽取通用方法（已有 upload 流程内联实现，需要重构）：

```python
async def _index_document(self, doc: Document, text: str) -> None:
    """分段 → Embedding → ChromaDB 写入 → DocumentChunk 落库 → FTS 同步。
    upload 与 note 公用。"""

async def _reindex_document(self, doc: Document, text: str) -> None:
    """先清理旧 chunk + 旧向量，再调用 _index_document。"""
```

新增方法：

```python
async def create_note(self, kb_id: int, payload: NoteCreate) -> tuple[Document | None, str]
async def update_note(self, doc_id: int, payload: NoteUpdate) -> tuple[Document | None, str]
```

规则：
- `create_note`：校验 kb 存在；按 content 计算 hash，重复则报错；写 Document（source_type=note, content=...）→ `_index_document`。
- `update_note`：仅允许 source_type=note；若 content 未变（hash 相同）则只更新 title；若变化则 `_reindex_document`。
- `delete`：现有逻辑通用（note 无文件需要删除，加判断跳过文件清理）。

### 4.3 API 路由 (`api/v1/knowledge_bases.py` 或新增 `notes.py`)

挂在文档子路由下，复用 kb_id 路径参数：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/knowledge-bases/{kb_id}/notes` | 创建笔记，body: `{title, content}` |
| GET  | `/api/v1/knowledge-bases/{kb_id}/documents/{doc_id}` | 已存在，确保 note 时返回 content |
| PUT  | `/api/v1/knowledge-bases/{kb_id}/notes/{doc_id}` | 更新笔记 |
| DELETE | 复用现有 `/documents/{doc_id}` | 删除 |

---

## 五、前端改造

### 5.1 新增依赖 (pnpm)

```
@uiw/react-codemirror              # 编辑器
@codemirror/lang-markdown
@codemirror/theme-one-dark
react-markdown                     # 预览
remark-gfm                         # GFM 表格/任务列表
remark-math + rehype-katex         # 公式
rehype-highlight                   # 代码高亮
katex                              # KaTeX 样式
```

### 5.2 路由新增

| 路由 | 页面 | 说明 |
|------|------|------|
| `/knowledge-bases/:kbId/notes/new` | NoteEditorPage | 新建笔记 |
| `/knowledge-bases/:kbId/notes/:docId` | NoteEditorPage | 编辑已有笔记 |

### 5.3 组件树

```
pages/NoteEditorPage.tsx
  ├── components/editor/EditorToolbar.tsx     // 标题输入 + 操作按钮
  ├── components/editor/MarkdownEditor.tsx    // CodeMirror 包装
  └── components/editor/MarkdownPreview.tsx   // react-markdown + 插件
```

### 5.4 关键交互

- 进入页面：`mode=new` 直接空白；`mode=edit` 调 GET 文档详情，回填 title + content。
- 分屏：左右 50/50，可拖拽分隔条调整比例（保留到 localStorage）。
- 保存按钮：禁用条件 = title 为空 或 内容未变。新建调 POST `/notes`，编辑调 PUT `/notes/{id}`。
- 保存成功后跳转编辑模式 URL（`/notes/:docId`）。
- 离开未保存提示：`beforeunload` + React Router blocker。

### 5.5 知识库详情页改造

- 文档列表项区分图标：`source_type=note` 显示笔记图标，点击直达编辑器；`upload` 维持现有展示。
- 「上传文档」按钮旁新增「新建笔记」按钮 → 跳转 `/notes/new`。

### 5.6 API 客户端 (`api/notes.ts`)

```ts
createNote(kbId, { title, content })
updateNote(kbId, docId, { title?, content? })
```

---

## 六、实施阶段拆分

### Phase A -- 后端能力（约 0.5 天）
1. Alembic 迁移：`source_type` + `content` 字段
2. 重构 DocumentService，抽取 `_index_document` / `_reindex_document`
3. 新增 `create_note` / `update_note`
4. 新增 API 路由 + schema
5. 手动 curl / Swagger 验证

### Phase B -- 前端编辑器（约 1 天）
1. 安装依赖，验证 CodeMirror + react-markdown 基础渲染
2. 抽取 `MarkdownEditor` / `MarkdownPreview` 组件
3. 实现 `EditorToolbar`（快捷格式插入：粗体 / 标题 / 列表 / 代码块 / 公式）
4. 完成 `NoteEditorPage`，对接 create / update API
5. 路由接入 + 知识库详情页「新建笔记」入口与列表跳转

### Phase C -- 联调与打磨（约 0.5 天）
1. 验证笔记入库后参与检索 / 问答（端到端走通）
2. 编辑保存重切分：旧 chunk / 向量被清理
3. 离开未保存提示、分屏拖拽体验
4. 代码高亮、KaTeX 公式渲染检查
5. 异常路径：标题重复、内容为空、超长内容

---

## 七、风险与确认项

| 项 | 说明 |
|----|------|
| 编辑大笔记重切分耗时 | content 超过几万字时同步 reindex 可能阻塞请求；本期采取同步处理，超长场景后续再优化为异步任务 |
| FTS 同步 | 当前 upload 流程是否已写 FTS 表需要确认（`fulltext_search.py`），note 须沿用同一路径 |
| 中文标题文件名 | filename 中的中文需保证 SQLite 与列表展示无编码问题 |
| ChromaDB 向量清理 | 重新索引前必须先按 doc_id 删除旧向量，避免脏数据污染检索结果 |

---

## 八、验收标准

1. 在知识库详情页可点击「新建笔记」，进入分屏编辑器，左写右预览实时更新。
2. 代码块、KaTeX 公式预览正确。
3. 保存后笔记出现在文档列表，`source_type=note`。
4. 在「智能检索」与「AI 问答」中可以命中笔记内容。
5. 重新进入编辑器可加载已有内容，修改并保存后旧分段/向量被替换，检索结果反映最新内容。
6. 删除笔记后，对应分段、向量被清理。
