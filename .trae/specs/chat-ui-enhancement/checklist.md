# 对话 UI 增强 - Verification Checklist

## 组件结构
- [ ] ChatMessage 组件已正确提取或创建，代码结构清晰
- [ ] ChatPage.tsx 已重构，使用 ChatMessage 组件渲染消息

## 样式重构
- [ ] 用户消息以宽卡片形式显示在右侧，蓝色背景，无头像
- [ ] Agent 消息以宽卡片形式展示在左侧，无头像，包含内容、引用来源
- [ ] 已移除 IM 气泡风格的边角样式（如 rounded-tr-sm, rounded-tl-sm）
- [ ] 用户消息和 Agent 消息都不显示头像
- [ ] 整体间距和视觉层次符合 AI 助手卡片风格，简洁干净
- [ ] 引用来源展示与新布局协调

## Markdown 渲染
- [ ] 使用项目已有的 react-markdown 及其插件（remark-gfm, rehype-highlight, rehype-katex, remark-math）
- [ ] 未引入新的 Markdown 渲染依赖
- [ ] Agent 消息正确渲染标题（h1-h6）
- [ ] Agent 消息正确渲染有序/无序列表
- [ ] Agent 消息正确渲染代码块（带语法高亮）
- [ ] Agent 消息正确渲染行内代码
- [ ] Agent 消息正确渲染表格
- [ ] Agent 消息正确渲染引用块
- [ ] Agent 消息正确渲染链接（在新窗口打开）
- [ ] Agent 消息正确渲染数学公式（KaTeX）
- [ ] 用户消息也正确渲染 Markdown
- [ ] 所有链接点击后在新窗口打开（target="_blank"）
- [ ] Markdown 样式适配聊天消息宽度，确保可读性

## 流式响应
- [ ] 流式输出过程中 Markdown 内容逐步渲染
- [ ] 流式输出过程中光标指示器正常显示
- [ ] 复杂 Markdown 元素（代码块、表格）在流式输出中正确显示
- [ ] 不完整的 Markdown 语法不会导致渲染异常或页面崩溃
- [ ] 流式输出过程用户体验流畅

## 整体质量
- [ ] 整体视觉风格现代、专业，类似豆包/文心一言等 AI 助手
- [ ] 各种 Markdown 元素在对话中显示美观
- [ ] 响应式布局在不同屏幕尺寸下正常工作
- [ ] TypeScript 编译无错误
- [ ] ESLint 检查通过
