# 桌面端支持 - 实现计划

## 任务分解与优先级

### [x] 任务 1: 后端适配 - 动态端口和数据目录
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 修改 `app/core/config.py` 支持从环境变量或命令行参数读取端口和数据目录
  - 支持 `APP_PORT` 环境变量设置服务端口（默认 8000，桌面端使用动态端口）
  - 支持 `APP_DATA_DIR` 环境变量设置数据目录（桌面端使用用户应用数据目录）
  - 修改 CORS 配置，允许 localhost 任意端口或 Electron file:// 协议
  - 添加健康检查端点 `GET /health` 用于启动状态检测
- **Acceptance Criteria Addressed**: AC-1, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: 设置 `APP_PORT` 环境变量后，后端监听正确端口
  - `programmatic` TR-1.2: 设置 `APP_DATA_DIR` 环境变量后，数据存储在指定目录
  - `programmatic` TR-1.3: `GET /health` 端点返回 200 OK
  - `programmatic` TR-1.4: CORS 允许 localhost 任意端口访问
- **Notes**: 最小化改动，保持向后兼容开发环境

### [x] 任务 2: 前端适配 - 动态 API URL 和加载状态
- **Priority**: P0
- **Depends On**: 任务 1
- **Description**:
  - 修改 `src/api/client.ts` 支持动态 API URL（从 Electron IPC 获取或使用环境变量）
  - 添加启动加载页面，显示后端启动进度
  - 添加后端健康检查轮询逻辑
  - 添加错误状态页面（后端启动失败时显示）
  - 确保所有现有页面和组件无需修改即可正常工作
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-6
- **Test Requirements**:
  - `programmatic` TR-2.1: API 客户端能从 Electron IPC 或环境变量获取端口
  - `human-judgement` TR-2.2: 启动时显示加载页面，后端就绪后自动跳转
  - `human-judgement` TR-2.3: 后端启动失败时显示友好的错误页面
  - `programmatic` TR-2.4: 现有功能在开发模式下不受影响
- **Notes**: 保持 Web 模式的兼容性

### [x] 任务 3: Electron 项目骨架搭建
- **Priority**: P0
- **Depends On**: 任务 2
- **Description**:
  - 在项目根目录或 `src/desktop` 创建 Electron 项目
  - 安装 Electron 和 electron-builder 依赖
  - 创建主进程入口文件 `main.ts`
  - 创建预加载脚本 `preload.ts`（安全的 IPC 桥接）
  - 配置 Electron 构建脚本
  - 项目结构建议:
    ```
    src/desktop/
    ├── main.ts          # Electron 主进程
    ├── preload.ts       # 预加载脚本
    ├── tsconfig.json    # Electron TypeScript 配置
    └── package.json     # 或在根目录配置
    ```
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: 能启动 Electron 开发模式（`npm run electron:dev`）
  - `human-judgement` TR-3.2: Electron 窗口正常打开
  - `programmatic` TR-3.3: preload 脚本正确隔离主进程和渲染进程
- **Notes**: 使用 TypeScript 编写 Electron 代码，遵循项目类型安全规范

### [x] 任务 4: 后端进程管理（启动、健康检查、终止）
- **Priority**: P0
- **Depends On**: 任务 3
- **Description**:
  - 在 Electron 主进程中实现动态端口选择（从可用端口中选取）
  - 实现启动后端子进程逻辑（支持开发模式和打包模式两种路径）
  - 实现后端健康检查轮询（调用 `/health` 端点）
  - 通过 IPC 将后端端口和状态传递给渲染进程
  - 实现应用退出时优雅终止后端进程（SIGTERM/SIGINT）
  - 添加后端启动超时处理
- **Acceptance Criteria Addressed**: AC-1, AC-3, AC-6
- **Test Requirements**:
  - `programmatic` TR-4.1: 启动时能选择一个可用端口
  - `programmatic` TR-4.2: 后端进程启动后 `/health` 返回 200
  - `programmatic` TR-4.3: 关闭 Electron 窗口后后端进程被终止
  - `programmatic` TR-4.4: 后端启动超时后显示错误
  - `human-judgement` TR-4.5: 开发模式下使用 uv 运行，打包模式下使用可执行文件
- **Notes**: 后端进程管理是核心难点，需要充分测试

### [x] 任务 5: 前端构建适配 Electron
- **Priority**: P0
- **Depends On**: 任务 4
- **Description**:
  - 添加 Electron 专属的 Vite 构建配置
  - 配置构建输出到 Electron 资源目录
  - 处理 Electron 中的 file:// 协议路径问题
  - 确保路由使用 HashRouter 而非 BrowserRouter（避免 file:// 协议下的路由问题）
  - 验证现有所有页面在 Electron 中正常渲染
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-5.1: 前端能正确构建为 Electron 可用的静态资源
  - `human-judgement` TR-5.2: 所有页面路由正常工作（使用 HashRouter）
  - `human-judgement` TR-5.3: 静态资源（图片、字体等）正确加载
  - `programmatic` TR-5.4: Web 开发模式不受影响
- **Notes**: 可能需要根据 file:// 协议调整资源路径

### [x] 任务 6: Python 后端 PyInstaller 打包
- **Priority**: P0
- **Depends On**: 任务 1
- **Description**:
  - 在 `src/backend` 创建 PyInstaller 配置文件 `pyinstaller.spec`
  - 配置 FastAPI 应用入口（创建独立的启动脚本如 `run_app.py`）
  - 处理 ChromaDB 的动态库依赖
  - 处理 sentence-transformers 和 HuggingFace 模型
  - 配置数据文件和资源文件
  - 排除不必要的依赖减小体积
  - 添加 PyInstaller 构建脚本
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-6.1: PyInstaller 能成功构建可执行文件
  - `programmatic` TR-6.2: 生成的可执行文件能独立启动
  - `programmatic` TR-6.3: SQLite 和 ChromaDB 功能正常
  - `programmatic` TR-6.4: Embedding 模型能正确加载
  - `human-judgement` TR-6.5: 打包体积尽可能小
- **Notes**: PyInstaller 打包 AI 相关依赖（ChromaDB, sentence-transformers）是主要挑战，可能需要多次迭代

### [x] 任务 7: electron-builder 打包配置
- **Priority**: P1
- **Depends On**: 任务 5, 6
- **Description**:
  - 配置 electron-builder 的 `electron-builder.yml` 或 package.json 配置
  - 设置应用元数据（名称、版本、描述、作者）
  - 配置 Windows 目标（nsis 安装程序）
  - 配置 extraResources 包含后端可执行文件
  - 配置安装路径、快捷方式、开始菜单
  - 添加应用图标（后续可替换）
  - 配置构建脚本
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-7.1: electron-builder 能成功打包
  - `human-judgement` TR-7.2: 生成的 .exe 安装程序正常运行
  - `programmatic` TR-7.3: 后端可执行文件被正确包含在 resources 目录
  - `human-judgement` TR-7.4: 安装后有桌面快捷方式和开始菜单入口
- **Notes**: 需要确保后端可执行文件路径在打包后正确解析

### [ ] 任务 8: 端到端集成测试
- **Priority**: P0
- **Depends On**: 任务 7
- **Description**:
  - 测试完整启动流程：启动 Electron → 启动后端 → 加载前端
  - 测试所有现有功能：
    - 知识库 CRUD
    - 文档上传和处理
    - 智能检索
    - AI 问答（需要 Ollama）
    - Markdown 编辑器
    - 设置页面
  - 测试应用关闭后后端进程清理
  - 测试多次启动/关闭的稳定性
  - 测试数据持久化
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-5
- **Test Requirements**:
  - `human-judgement` TR-8.1: 所有现有功能在桌面端完全可用
  - `programmatic` TR-8.2: 应用关闭后无残留后端进程
  - `programmatic` TR-8.3: 数据存储在用户应用数据目录
  - `human-judgement` TR-8.4: 多次启动/关闭无异常
- **Notes**: 需要真实的 Ollama 环境测试 AI 问答功能

### [ ] 任务 9: 错误处理和用户体验优化
- **Priority**: P1
- **Depends On**: 任务 8
- **Description**:
  - 后端启动失败时显示友好的错误消息
  - 添加日志记录（主进程和后端日志）
  - 添加查看日志的入口
  - 添加应用图标（可选，可用临时图标）
  - 配置窗口最小大小和默认大小
  - 处理窗口关闭确认（可选）
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-9.1: 错误信息友好且有帮助
  - `programmatic` TR-9.2: 日志文件正确生成
  - `human-judgement` TR-9.3: 窗口大小和行为符合预期
- **Notes**: 关注用户遇到问题时如何排查

## 依赖关系图

```
任务1 (后端适配: 动态端口+数据目录)
   ↓
任务2 (前端适配: 动态API URL+加载状态)
   ↓
任务3 (Electron 项目骨架)
   ↓
任务4 (后端进程管理) ──────────────┐
   ↓                               ↓
任务5 (前端构建适配 Electron)   任务6 (PyInstaller 打包后端)
   ↓                               ↓
   └──────────────┬────────────────┘
                  ↓
         任务7 (electron-builder 打包)
                  ↓
         任务8 (端到端集成测试)
                  ↓
         任务9 (错误处理和 UX 优化)
```

## 技术实现细节

### 主要新增文件

```
src/desktop/
├── main.ts              # Electron 主进程
├── preload.ts           # 预加载脚本（IPC 桥接）
└── tsconfig.json        # Electron TypeScript 配置

src/backend/
├── run_app.py           # PyInstaller 入口脚本
└── pyinstaller.spec     # PyInstaller 配置

# 根目录或 src/desktop
├── electron-builder.yml # electron-builder 配置
```

### 需要修改的现有文件

**后端**:
- `src/backend/app/core/config.py` - 添加端口和数据目录的环境变量支持
- `src/backend/app/main.py` - 添加健康检查端点，可能需要调整 lifespan

**前端**:
- `src/frontend/src/api/client.ts` - 动态 API URL
- `src/frontend/src/App.tsx` - 添加加载状态和错误处理
- `src/frontend/src/routes/index.tsx` - 可能需要切换到 HashRouter
- `src/frontend/vite.config.ts` - Electron 构建配置

### 关键技术决策

1. **路由模式**: 使用 HashRouter，因为 file:// 协议下 BrowserRouter 的 history 模式会有问题
2. **IPC 通信**: 使用 contextBridge 在 preload 中暴露有限的 API，保持安全
3. **后端路径解析**: 开发模式使用 `uv run`，打包模式使用 `process.resourcesPath`
4. **数据目录**: 使用 `app.getPath('userData')` 获取用户数据目录
5. **端口选择**: 使用 `get-port` 或类似库选择可用端口

### 建议的依赖版本

**Electron**:
- `electron`: ^28.0.0 或 ^29.0.0
- `electron-builder`: ^24.9.1
- `electron-vite`: ^2.0.0（可选，简化构建）

**后端打包**:
- `pyinstaller`: ^6.0.0
- `uvicorn`: 已在依赖中

**工具库**:
- `get-port`: ^7.0.0（选择可用端口）
- `wait-port`: ^1.0.4（等待端口就绪）
