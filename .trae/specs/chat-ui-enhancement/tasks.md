# 对话 UI 增强 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 提取或创建 ChatMessage 组件
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 从 ChatPage.tsx 中提取消息渲染逻辑，或创建新的 ChatMessage 组件
  - 组件需要支持区分用户消息和 Agent 消息
  - 为后续的样式重构和 Markdown 渲染奠定基础
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `human-judgement` TR-1.1: 组件能够正确渲染用户消息和 Agent 消息
  - `human-judgement` TR-1.2: 组件结构清晰，便于后续修改
- **Notes**: 可以先保持现有样式，只做组件提取，便于后续增量修改

## [x] Task 2: 重构对话样式为豆包式卡片布局
- **Priority**: P0
- **Depends On**: [Task 1]
- **Description**: 
  - 修改 ChatMessage 组件的样式，从 IM 气泡样式改为豆包/AI 助手卡片样式
  - 用户消息：宽卡片形式显示在右侧，蓝色背景，无头像
  - Agent 消息：宽卡片形式显示在左侧，无头像，内容区域宽敞，白色背景，带边框或阴影
  - 移除 IM 风格的边角样式（如 rounded-tr-sm, rounded-tl-sm）
  - 移除所有头像显示（用户和 Agent 消息都不显示头像）
  - 调整整体间距和视觉层次，保持简洁干净的设计
- **Acceptance Criteria Addressed**: [AC-2, AC-4]
- **Test Requirements**:
  - `human-judgement` TR-2.1: 用户消息和 Agent 消息布局符合豆包式设计（无头像，宽卡片）
  - `human-judgement` TR-2.2: 引用来源展示与新布局协调
  - `human-judgement` TR-2.3: 整体视觉风格现代、专业，简洁干净
- **Notes**: 参考豆包、文心一言等 AI 助手的对话界面，采用简洁的卡片设计

## [x] Task 3: 集成 Markdown 渲染到消息
- **Priority**: P0
- **Depends On**: [Task 2]
- **Description**: 
  - 参考 MarkdownPreview.tsx 的实现，为 Agent 消息和用户消息集成 react-markdown 渲染
  - 导入必要的插件：remark-gfm, rehype-highlight, rehype-katex, remark-math
  - 导入样式：highlight.js 和 katex 的 CSS
  - 为聊天消息场景定制 Markdown 样式（更紧凑，适合对话展示）
  - 确保链接在新窗口打开（target="_blank", rel="noopener noreferrer"）
  - 针对用户消息和 Agent 消息可能需要不同的 Markdown 样式（如文字颜色）
- **Acceptance Criteria Addressed**: [AC-1, AC-5]
- **Test Requirements**:
  - `programmatic` TR-3.1: 导入的依赖都是项目已有的，package.json 无新增 Markdown 相关依赖
  - `human-judgement` TR-3.2: Agent 消息正确渲染标题、列表、代码块、表格等 Markdown 元素
  - `human-judgement` TR-3.3: 代码高亮和数学公式正常显示
  - `human-judgement` TR-3.4: 用户消息也正确渲染 Markdown
  - `human-judgement` TR-3.5: 链接点击后在新窗口打开
- **Notes**: Markdown 样式需要适配聊天消息的宽度，确保可读性；用户消息和 Agent 消息的 Markdown 样式可能需要区分（如文字颜色）

## [/] Task 4: 确保流式响应与 Markdown 渲染兼容
- **Priority**: P0
- **Depends On**: [Task 3]
- **Description**: 
  - 验证流式输出过程中 Markdown 的增量渲染效果
  - 确保光标指示器在流式输出过程中正常显示
  - 处理流式输出中的不完整 Markdown 语法（如未闭合的代码块）的显示问题
  - 确保流式输出过程中的用户体验流畅
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `human-judgement` TR-4.1: 流式输出过程中内容逐步渲染，光标指示器正常显示
  - `human-judgement` TR-4.2: 复杂 Markdown 元素（如代码块、表格）在流式输出中能够正确显示
  - `human-judgement` TR-4.3: 不完整的 Markdown 语法不会导致渲染异常或页面崩溃
- **Notes**: 可能需要对流式输出的内容进行一些预处理，或接受中间状态的不完美渲染

## [ ] Task 5: 测试和优化整体效果
- **Priority**: P1
- **Depends On**: [Task 4]
- **Description**: 
  - 进行端到端测试，验证所有功能正常工作
  - 优化 Markdown 样式，确保在对话场景下的最佳可读性
  - 调整间距、字体大小等细节
  - 检查响应式表现
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4]
- **Test Requirements**:
  - `human-judgement` TR-5.1: 整体效果符合预期，用户体验良好
  - `human-judgement` TR-5.2: 各种 Markdown 元素在对话中显示美观
  - `human-judgement` TR-5.3: 响应式布局正常工作
- **Notes**: 可以考虑在不同屏幕尺寸下测试
