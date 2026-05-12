# 对话 UI 增强 - Product Requirement Document

## Overview
- **Summary**: 为现有工程的对话页面增加 Agent 回复的 Markdown 格式支持，并将对话样式从 IM (即时消息) 风格改为类似豆包/文心一言等 AI 助手的卡片式对话风格。
- **Purpose**: 提升用户阅读体验，更好地展示结构化内容（代码、列表、表格等），使界面更加现代和专业。
- **Target Users**: 使用本地知识库助手进行问答的所有用户。

## Goals
- [Primary goal 1] Agent 回复支持 Markdown 格式渲染（包括代码高亮、数学公式、表格、列表等）
- [Primary goal 2] 对话布局从 IM 气泡样式改为 AI 助手卡片样式
- [Primary goal 3] 保持流式响应的流畅体验
- [Primary goal 4] 保持引用来源展示功能

## Non-Goals (Out of Scope)
- [Features intentionally excluded] 不改变现有的对话逻辑和数据结构
- [Features intentionally excluded] 不修改用户输入的内容格式
- [Features intentionally excluded] 不改变引用来源的展开/收起交互逻辑
- [Features intentionally excluded] 不修改侧边栏对话列表

## Background & Context
- [Relevant context] 项目已存在 `MarkdownPreview` 组件，用于文档编辑预览，使用 `react-markdown` + `remark-gfm` + `rehype-highlight` + `rehype-katex` 实现 Markdown 渲染
- [Technical landscape] 当前对话页面 (`ChatPage.tsx`) 使用简单的 `whitespace-pre-wrap` 渲染文本，不支持 Markdown
- [Technical landscape] 当前对话样式为 IM 气泡风格：用户消息右侧蓝色气泡，AI 消息左侧白色气泡带圆角和头像

## Functional Requirements
- **FR-1**: Agent 回复内容支持 Markdown 格式渲染
  - 支持标题（h1-h6）
  - 支持有序/无序列表
  - 支持代码块（带语法高亮）
  - 支持行内代码
  - 支持表格
  - 支持引用块
  - 支持链接（在新窗口打开）
  - 支持数学公式（KaTeX）
- **FR-1.1**: 用户消息也支持 Markdown 格式渲染
  - 与 Agent 消息使用相同的 Markdown 渲染能力
- **FR-2**: 对话样式改为类似豆包的卡片式布局
  - 用户消息在右侧，宽卡片形式，无头像
  - Agent 消息在左侧，宽卡片形式，无头像，包含内容区域、引用来源、时间
  - 移除 IM 气泡的对话风格（如 `rounded-tr-sm`、`rounded-tl-sm` 等）
  - 简洁、干净的卡片设计，提供良好的阅读体验
- **FR-3**: 流式响应保持流畅
  - Markdown 在流式输出过程中能够增量渲染
  - 光标指示器保持可见直到流式结束
- **FR-4**: 引用来源展示保持不变
  - 引用来源的展开/收起功能保持
  - 引用来源的样式保持与整体新风格协调

## Non-Functional Requirements
- **NFR-1**: 性能：Markdown 渲染不明显影响页面流畅度
- **NFR-2**: 兼容性：使用项目已有的 `react-markdown` 生态，不引入新的重大依赖
- **NFR-3**: 样式一致性：新样式与项目整体 Tailwind 风格一致
- **NFR-4**: 可读性：代码块、表格等内容在流式输出过程中保持良好的可读性

## Constraints
- **Technical**: 必须使用现有项目依赖（react-markdown, remark-gfm, rehype-highlight, rehype-katex 等已存在）
- **Technical**: 必须在现有的 `ChatPage.tsx` 组件中进行修改
- **Technical**: 样式必须使用 Tailwind CSS（项目已集成）
- **Dependencies**: 依赖现有的 `MarkdownPreview` 组件的实现模式，但需要调整为适合聊天消息的样式

## Assumptions
- [Assumption 1] 后端返回的 Agent 回复内容已经包含合理的 Markdown 格式（或至少可以被 Markdown 解析）
- [Assumption 2] 豆包样式的参考是：AI 回复和用户消息都以宽卡片形式展示，无头像，内容区域宽敞，界面简洁干净

## Acceptance Criteria

### AC-1: Agent 回复正确渲染 Markdown
- **Given**: Agent 回复包含 Markdown 格式内容
- **When**: 用户查看 Agent 回复
- **Then**: 内容以正确的 Markdown 格式展示（标题、列表、代码块等正确渲染）
- **Verification**: `human-judgment`
- **Notes**: 需要测试包含多种 Markdown 元素的回复

### AC-2: 对话样式为豆包式卡片布局
- **Given**: 用户打开对话页面
- **When**: 查看对话消息列表
- **Then**: 用户消息以宽卡片形式显示在右侧，Agent 消息以宽卡片形式展示在左侧，无头像，整体风格类似豆包而非 IM
- **Verification**: `human-judgment`
- **Notes**: 参考豆包/文心一言等 AI 助手的对话界面设计，卡片设计简洁干净

### AC-3: 流式响应正常工作
- **Given**: 用户发送消息并等待回复
- **When**: Agent 正在流式输出回复
- **Then**: Markdown 内容逐步渲染，光标指示器正常显示
- **Verification**: `human-judgment`
- **Notes**: 需要验证流式输出过程中代码块、表格等复杂元素的显示

### AC-4: 引用来源功能正常
- **Given**: Agent 回复包含引用来源
- **When**: 用户点击引用来源展开按钮
- **Then**: 引用来源正确展开/收起，样式与新布局协调
- **Verification**: `human-judgment`

### AC-5: 使用现有依赖
- **Given**: 项目需要渲染 Markdown
- **When**: 检查实现方式
- **Then**: 使用项目已有的 react-markdown 及其插件生态，不引入新的 Markdown 渲染库
- **Verification**: `programmatic`
- **Notes**: 检查 package.json 和导入语句

## Open Questions
- [ ] 无 - 已通过用户确认所有关键设计决策
