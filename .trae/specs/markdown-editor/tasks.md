# Markdown 编辑器 - 实现计划

## 任务分解与优先级

### [x] 任务 1: 后端 API - 创建在线笔记
- **优先级**: P0
- **依赖**: None
- **描述**:
  - 在 `DocumentService` 中添加创建在线笔记的方法 `create_note(kb_id, filename, content)`
  - 新增 Pydantic Schema: `NoteCreate`（包含 filename 和 content）
  - 在 `knowledge_bases.py` 路由中添加 POST 端点 `/{kb_id}/notes`
  - 逻辑：创建文档记录 → 保存内容到文件 → 后台异步触发处理流程
- **验收标准**: AC-1
- **测试需求**:
  - `programmatic` TR-1.1: POST `/api/v1/knowledge-bases/{kb_id}/notes` 成功返回 201
  - `programmatic` TR-1.2: 创建的文档 `file_type` 为 "md"
  - `programmatic` TR-1.3: 空内容或全空白内容返回 400 错误
  - `programmatic` TR-1.4: 文档列表中能看到新创建的笔记
- **备注**: 复用现有的 `process_document_task` 后台处理逻辑

### [x] 任务 2: 后端 API - 获取/更新文档内容
- **优先级**: P0
- **依赖**: 任务 1
- **描述**:
  - 在 `DocumentService` 中添加获取文档内容的方法 `get_content(doc_id)`
  - 在 `DocumentService` 中添加更新文档内容的方法 `update_content(doc_id, content)`
  - 新增 Pydantic Schema: `NoteUpdate`（包含 content，可选 filename）
  - 在路由中添加:
    - GET `/{kb_id}/documents/{doc_id}/content` - 获取文档内容
    - PUT `/{kb_id}/documents/{doc_id}/content` - 更新文档内容
  - 更新内容后：更新 file_hash → 清除旧分段和向量 → 后台重新处理
- **验收标准**: AC-2
- **测试需求**:
  - `programmatic` TR-2.1: GET `/content` 能正确返回 md 文件的内容
  - `programmatic` TR-2.2: PUT `/content` 成功更新文件并返回 200
  - `programmatic` TR-2.3: 更新后 `file_hash` 发生变化
  - `programmatic` TR-2.4: 非 md 类型文档返回 400 错误
  - `programmatic` TR-2.5: 空内容更新返回 400 错误
- **备注**: 需要验证文档类型为 md 才允许编辑

### [x] 任务 3: 前端路由和页面基础结构
- **优先级**: P0
- **依赖**: 任务 1, 2
- **描述**:
  - 新增页面组件 `pages/NoteEditorPage.tsx`
  - 在 `routes/index.tsx` 中添加路由:
    - `/knowledge-bases/:kbId/notes/new` - 新建笔记
    - `/knowledge-bases/:kbId/notes/:docId/edit` - 编辑笔记
  - 在 `KnowledgeBasesPage.tsx` 中添加「新建笔记」按钮
  - 在文档列表中为 md 类型文档添加「编辑」按钮
- **验收标准**: AC-1, AC-2
- **测试需求**:
  - `human-judgement` TR-3.1: 知识库页面有「新建笔记」按钮
  - `human-judgement` TR-3.2: md 类型文档有「编辑」按钮
  - `programmatic` TR-3.3: 路由配置正确，能访问新建和编辑页面
- **备注**: 先完成页面骨架，编辑器组件在后续任务中实现

### [x] 任务 4: 前端 API 和状态管理
- **优先级**: P0
- **依赖**: 任务 3
- **描述**:
  - 在 `api/documents.ts` 中新增:
    - `createNote(kbId, { filename, content })`
    - `getDocumentContent(kbId, docId)`
    - `updateDocumentContent(kbId, docId, { content, filename? })`
  - 在 `hooks/useDocuments.ts` 中新增:
    - `useCreateNote()` mutation
    - `useDocumentContent(kbId, docId)` query
    - `useUpdateDocumentContent()` mutation
  - 在 `types/document.ts` 中新增类型定义
- **验收标准**: AC-1, AC-2
- **测试需求**:
  - `programmatic` TR-4.1: API 函数能正确调用后端端点
  - `programmatic` TR-4.2: React Query hooks 正确管理缓存和 invalidation
  - `programmatic` TR-4.3: TypeScript 类型定义完整
- **备注**: 遵循现有的 API 客户端和 hooks 模式

### [x] 任务 5: 前端依赖安装和基础组件
- **优先级**: P0
- **依赖**: 任务 4
- **描述**:
  - 安装依赖:
    - `@uiw/react-codemirror` 或 `codemirror` + `@codemirror/lang-markdown`
    - `react-markdown`
    - `remark-gfm` (GFM 支持)
    - `rehype-highlight` 或 `rehype-shiki` (代码高亮)
    - `rehype-katex` + `katex` (数学公式)
  - 创建编辑器基础组件:
    - `components/editor/MarkdownEditor.tsx` - CodeMirror 6 封装
    - `components/editor/MarkdownPreview.tsx` - react-markdown 封装
  - 配置 Tailwind 样式和主题
- **验收标准**: AC-3
- **测试需求**:
  - `human-judgement` TR-5.1: 编辑器能正常输入文本
  - `human-judgement` TR-5.2: 预览区能渲染基本 Markdown
  - `programmatic` TR-5.3: 所有依赖正确安装
- **备注**: 选择轻量级的依赖组合，确保性能

### [x] 任务 6: 编辑器工具栏和快捷键
- **优先级**: P1
- **依赖**: 任务 5
- **描述**:
  - 创建 `components/editor/EditorToolbar.tsx` 组件
  - 实现工具栏按钮:
    - 保存、撤销、重做
    - 格式按钮: 加粗、斜体、标题(H1/H2/H3)
    - 列表: 有序、无序
    - 插入: 链接、代码块
    - 公式: 行内公式、块级公式
    - 视图切换: 仅源码 / 仅预览 / 分屏
  - 实现快捷键支持 (可选)
  - 管理分屏视图状态
- **验收标准**: AC-4
- **测试需求**:
  - `human-judgement` TR-6.1: 所有工具栏按钮可见且样式正确
  - `human-judgement` TR-6.2: 点击按钮在正确位置插入 Markdown 语法
  - `human-judgement` TR-6.3: 视图切换功能正常
- **备注**: 参考主流 Markdown 编辑器的工具栏布局

### [x] 任务 7: 编辑器页面完整实现
- **优先级**: P0
- **依赖**: 任务 5, 6
- **描述**:
  - 在 `NoteEditorPage.tsx` 中整合:
    - 加载文档内容（编辑模式）
    - 保存逻辑（新建和编辑两种模式）
    - 处理状态显示（保存中、处理中）
    - 错误处理和用户提示
    - 未保存变更提示（可选）
  - 左栏编辑器 + 右栏预览的分屏布局
  - 响应式设计
- **验收标准**: AC-1, AC-2, AC-3
- **测试需求**:
  - `human-judgement` TR-7.1: 新建笔记页面正常工作
  - `human-judgement` TR-7.2: 编辑已有笔记页面正常工作
  - `human-judgement` TR-7.3: 保存成功后正确跳转或提示
  - `human-judgement` TR-7.4: 错误情况有友好提示
- **备注**: 确保保存后触发文档列表刷新

### [x] 任务 8: 代码高亮和数学公式
- **优先级**: P1
- **依赖**: 任务 7
- **描述**:
  - 配置 `rehype-highlight` 或 `rehype-shiki` 实现代码块高亮
  - 配置 `rehype-math` + `rehype-katex` 实现数学公式渲染
  - 添加 highlight.js 或 Shiki 的主题样式
  - 添加 KaTeX 的 CSS 样式
  - 测试各种语言的代码块和复杂公式
- **验收标准**: AC-3
- **测试需求**:
  - `human-judgement` TR-8.1: JavaScript/Python/TypeScript 等代码块正确高亮
  - `human-judgement` TR-8.2: 行内公式和块级公式正确渲染
  - `human-judgement` TR-8.3: 样式与整体 UI 协调
- **备注**: 优先选择轻量级方案，避免引入过大的依赖

### [x] 任务 9: 文档参与检索验证
- **优先级**: P0
- **依赖**: 任务 1-8
- **描述**:
  - 验证新建的笔记会被处理并生成向量
  - 验证编辑后的笔记会重新生成向量
  - 测试搜索功能能否找到新创建/编辑的笔记内容
  - 测试 RAG 问答能否引用笔记内容
- **验收标准**: AC-5
- **测试需求**:
  - `programmatic` TR-9.1: 新建笔记后文档状态变为 completed
  - `programmatic` TR-9.2: 编辑笔记后 chunk_count 更新
  - `programmatic` TR-9.3: 搜索 API 能返回匹配的笔记片段
- **备注**: 这是集成测试，需要完整的后端环境

## 依赖关系图

```
任务1 (后端: 创建笔记)
   ↓
任务2 (后端: 获取/更新内容) ──┐
   ↓                           ↓
任务3 (前端: 路由和页面骨架)   任务4 (前端: API 和 hooks)
   ↓                           ↓
   └───────────┬───────────────┘
               ↓
任务5 (依赖安装 + 基础组件)
   ↓
任务6 (工具栏) ──┐
   ↓             ↓
   └─────┬───────┘
         ↓
任务7 (编辑器页面完整实现)
   ↓
任务8 (代码高亮 + 公式)
   ↓
任务9 (检索验证)
```

## 技术实现细节

### 后端改动文件
- `app/services/document.py` - 新增 `create_note`, `get_content`, `update_content` 方法
- `app/schemas/document.py` - 新增 NoteCreate, NoteUpdate schema
- `app/api/v1/knowledge_bases.py` - 新增路由端点

### 前端改动文件
- `src/api/documents.ts` - 新增 API 函数
- `src/hooks/useDocuments.ts` - 新增 React Query hooks
- `src/types/document.ts` - 新增类型定义
- `src/routes/index.tsx` - 新增路由
- `src/pages/NoteEditorPage.tsx` - 新建页面
- `src/pages/KnowledgeBasesPage.tsx` - 添加按钮
- `src/components/editor/MarkdownEditor.tsx` - 新建
- `src/components/editor/MarkdownPreview.tsx` - 新建
- `src/components/editor/EditorToolbar.tsx` - 新建
- `package.json` - 新增依赖

### 建议的依赖版本
- CodeMirror: `@uiw/react-codemirror` (简化集成)
- Markdown 渲染: `react-markdown` + `remark-gfm`
- 代码高亮: `rehype-highlight` + `highlight.js` (轻量) 或 `rehype-shiki` (高质量)
- 数学公式: `remark-math` + `rehype-katex` + `katex`
