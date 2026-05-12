# 桌面端支持 - 产品需求文档

## 概述
- **Summary**: 为现有的本地知识库 Web 应用增加桌面端支持，使用 Electron 框架将前端和 Python 后端打包为独立的桌面应用程序，实现开箱即用的用户体验。
- **Purpose**: 消除用户需要手动安装 Python、Node.js、配置环境的门槛，让普通用户可以直接下载安装包后即可使用本地知识库功能。
- **Target Users**: 需要私有化本地知识库、不想配置开发环境的普通用户；希望以桌面应用形式使用知识库的用户。

## 目标
- **Goal 1**: 使用 Electron 框架封装现有的 React 前端，提供原生桌面应用体验
- **Goal 2**: 将 Python FastAPI 后端打包为可执行文件，内嵌于桌面应用中
- **Goal 3**: 前端启动时自动启动后端服务，关闭时自动清理后端进程
- **Goal 4**: 提供 Windows 安装程序（.exe），实现双击安装、开箱即用
- **Goal 5**: 所有现有功能（知识库管理、文档导入、智能检索、AI 问答）在桌面端完全可用

## 非目标 (Out of Scope)
- 不支持 macOS/Linux 打包（后续可扩展）
- 不内嵌 Ollama 服务，仅提供配置入口
- 不新增功能，仅封装现有 Web 功能
- 不做应用商店发布
- 不做自动更新功能

## 背景与上下文
- **现有系统**: 项目已实现完整的本地知识库功能，包括：
  - 知识库管理（CRUD）
  - 文档导入（PDF/Word/Excel/TXT/MD）
  - 智能检索（混合检索：语义 + 全文）
  - AI 问答对话（RAG，支持 SSE 流式输出）
  - 在线 Markdown 编辑器
  - 设置页面（Ollama 配置、模型选择等）
- **技术栈**:
  - 前端: React 18 + TypeScript + Vite + Tailwind CSS
  - 后端: FastAPI + Python 3.11+ + SQLite + ChromaDB
  - LLM: Ollama（本地部署）
- **现有部署方式**:
  - 方式一: Docker Compose
  - 方式二: 本地开发模式（需要安装 Python/uv/Node.js/pnpm）
- **需求来源**: 现有部署方式对普通用户门槛较高，需要桌面端应用简化安装和使用

## 功能需求

### FR-1: Electron 主进程
- 创建 Electron 主进程，管理应用生命周期
- 创建和管理主窗口，加载前端页面
- 处理应用启动、关闭、窗口状态
- 配置窗口大小、标题、图标等

### FR-2: 后端进程管理
- Electron 主进程负责启动和管理 Python 后端子进程
- 前端加载前检查后端服务健康状态
- 后端启动失败时显示错误信息
- 应用关闭时优雅终止后端进程
- 后端异常退出时自动重启（可选）

### FR-3: 前端适配
- 现有 React 前端无需大改即可在 Electron 中运行
- API 基础 URL 适配桌面端场景（使用 localhost + 动态端口）
- 处理后端启动过程的加载状态展示
- 桌面端专属 UI（窗口控制、托盘图标等，可选）

### FR-4: Python 后端打包
- 使用 PyInstaller 将 FastAPI 后端打包为独立可执行文件
- 处理 Python 依赖打包（ChromaDB、sentence-transformers 等）
- 处理数据目录路径（使用用户应用数据目录）
- 动态端口配置（避免端口冲突）

### FR-5: 应用打包与分发
- 使用 electron-builder 打包 Windows 安装程序（.exe）
- 配置应用图标、名称、版本信息
- 打包产物包含前端资源、后端可执行文件
- 安装程序将应用安装到 Program Files 或用户目录

### FR-6: 数据存储
- 知识库数据（SQLite、ChromaDB、上传文件）存储在用户应用数据目录
- Windows: `%APPDATA%\LocalKnowledgeBase` 或 `%USERPROFILE%\.local-knowledge-base`
- 支持数据目录迁移或备份（可选）

## 非功能需求

### NFR-1: 启动时间
- 应用冷启动时间（从双击图标到界面可用）< 15 秒
- 后端服务启动时间 < 10 秒（含 Embedding 模型加载）
- 显示启动加载动画或进度提示

### NFR-2: 打包体积
- 安装包体积尽可能小（目标 < 500MB）
- 排除不必要的 Python 依赖和测试文件
- ChromaDB 和 sentence-transformers 模型可能需要单独处理

### NFR-3: 稳定性
- 后端进程崩溃时应用有优雅的错误处理
- 应用关闭时确保后端进程正确终止
- 避免端口冲突导致启动失败

### NFR-4: 用户体验
- 安装过程简单，无需用户配置
- 启动后自动进入应用主界面
- 错误信息友好，帮助用户定位问题
- 提供日志查看入口（可选）

### NFR-5: 代码规范
- 遵循项目现有的技术栈和编码风格
- Electron 相关代码组织清晰
- 最小化对现有前后端代码的侵入

## 约束
- **技术约束**: 必须使用 Electron 框架
- **平台约束**: 优先支持 Windows，不强制支持 macOS/Linux
- **后端打包**: 必须使用 PyInstaller 或类似工具打包 Python 后端
- **数据隔离**: 桌面端数据目录与开发环境数据隔离
- **Ollama**: 不内嵌 Ollama，用户需自行安装配置

## 假设
- 用户已安装或愿意安装 Ollama（用于 LLM 推理）
- 用户使用的是 Windows 操作系统
- PyInstaller 可以正确打包 ChromaDB 和 sentence-transformers
- sentence-transformers 模型可以在打包后正确加载
- 动态端口选择可以避免端口冲突

## 验收标准

### AC-1: Electron 应用可以正常启动
- **Given**: 用户已安装桌面应用
- **When**: 用户双击应用图标
- **Then**: 
  - 应用窗口打开
  - 显示启动加载界面
  - 后端服务启动
  - 前端页面成功加载
- **Verification**: `human-judgment`

### AC-2: 所有现有功能在桌面端可用
- **Given**: 桌面应用已启动
- **When**: 用户使用各项功能
- **Then**:
  - 知识库管理功能正常
  - 文档导入和处理正常
  - 智能检索功能正常
  - AI 问答对话功能正常（含 SSE 流式）
  - Markdown 编辑器功能正常
  - 设置页面功能正常
- **Verification**: `human-judgment`

### AC-3: 后端进程管理正确
- **Given**: 桌面应用正在运行
- **When**: 用户关闭应用窗口
- **Then**:
  - 后端进程被优雅终止
  - 无残留进程
  - 再次启动应用正常
- **Verification**: `programmatic`

### AC-4: 安装程序可以正常安装和卸载
- **Given**: 用户下载了安装包
- **When**: 用户运行安装程序
- **Then**:
  - 安装程序向导正常
  - 应用成功安装到目标目录
  - 桌面快捷方式创建
  - 可以从开始菜单启动
  - 可以通过控制面板正常卸载
- **Verification**: `human-judgment`

### AC-5: 数据存储在用户目录
- **Given**: 桌面应用已使用并创建了知识库
- **When**: 用户检查应用数据目录
- **Then**:
  - SQLite 数据库文件存在
  - ChromaDB 数据目录存在
  - 上传的文档文件存在
  - 数据不存储在应用安装目录
- **Verification**: `programmatic`

### AC-6: 错误处理友好
- **Given**: 后端启动失败或崩溃
- **When**: 用户遇到错误
- **Then**:
  - 显示友好的错误消息
  - 提供查看日志的入口
  - 应用不会无响应或崩溃
- **Verification**: `human-judgment`

## 开放问题
- [ ] sentence-transformers 模型是内嵌还是首次运行时下载？
- [ ] 是否需要系统托盘图标和后台运行支持？
- [ ] 是否需要支持多个实例运行？
- [ ] 是否需要数据导入/导出功能？
- [ ] 应用更新策略（手动下载 vs 自动检查）？
