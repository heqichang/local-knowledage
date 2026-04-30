# 本地知识库

私有化本地知识库，支持文档导入、智能检索、AI 问答对话，所有数据本地存储。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: FastAPI + Python 3.11+ + SQLite + ChromaDB
- **Python 环境**: uv (快速 Python 包管理器)
- **LLM**: Ollama (本地部署)
- **Embedding**: sentence-transformers (BAAI/bge-small-zh-v1.5)

## 快速开始

### 方式一：Docker Compose（推荐）

1. 确保已安装 Docker 和 Docker Compose

2. 启动所有服务：
```bash
docker-compose up -d
```

3. 首次启动后，需要在 Ollama 中拉取模型：
```bash
docker exec -it kb-ollama ollama pull qwen2.5:7b
```

4. 访问应用：
   - 前端：http://localhost
   - 后端 API：http://localhost:8000
   - API 文档：http://localhost:8000/docs

### 方式二：本地开发

#### 前置要求
- Python 3.11+
- uv (Python 包管理器)
- Node.js 20+
- pnpm
- Ollama（需单独安装）

#### 安装 uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 或使用 pip
pip install uv
```

#### 后端启动

```bash
cd backend

# 安装依赖（自动创建虚拟环境）
uv sync

# 启动服务
uv run uvicorn app.main:app --reload --port 8000
```

#### 前端启动

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

#### Ollama 配置

1. 安装 Ollama：https://ollama.ai/
2. 拉取模型：
```bash
ollama pull qwen2.5:7b
```

## 项目结构

```
├── backend/              # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/      # API 路由
│   │   ├── core/        # 配置
│   │   ├── db/          # 数据库
│   │   ├── models/      # ORM 模型
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # 业务逻辑
│   │   └── main.py      # 入口
│   └── pyproject.toml
├── frontend/            # React 前端
│   ├── src/
│   │   ├── api/         # API 客户端
│   │   ├── components/  # 组件
│   │   ├── layouts/     # 布局
│   │   ├── pages/       # 页面
│   │   └── routes/      # 路由
│   └── package.json
├── docs/                # 文档
│   └── requirements.md  # 需求文档
├── docker-compose.yml
└── .env.example
```

## 配置

复制 `.env.example` 为 `.env` 并根据需要修改配置：

```bash
cp .env.example .env
```

主要配置项：
- `OLLAMA_BASE_URL`: Ollama 服务地址
- `OLLAMA_MODEL`: 使用的 LLM 模型
- `EMBEDDING_MODEL`: Embedding 模型
- `CHUNK_SIZE`: 文档分段大小
- `SEARCH_TOP_K`: 检索返回条数

## 开发

### 后端

```bash
# 安装依赖
cd backend && uv sync

# 添加新依赖
cd backend && uv add <package-name>

# 添加开发依赖
cd backend && uv add --dev <package-name>

# 类型检查
cd backend && uv run mypy .

# 代码格式化
cd backend && uv run ruff check . --fix

# 运行测试
cd backend && uv run pytest
```

### 前端

```bash
# 类型检查
cd frontend && pnpm type-check

# 代码检查
cd frontend && pnpm lint

# 构建
cd frontend && pnpm build
```

## MVP 开发计划

- [x] Phase 1: 基础骨架（项目初始化、Docker 配置）
- [ ] Phase 2: 知识库与文档管理
- [ ] Phase 3: 检索与 AI 问答
- [ ] Phase 4: 完善体验
- [ ] Phase 5: 打磨上线

详细需求文档见 [docs/requirements.md](docs/requirements.md)

## 许可证

MIT