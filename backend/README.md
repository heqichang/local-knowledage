# Backend - FastAPI + Python

本项目后端使用 FastAPI 框架，采用 **uv** 作为 Python 包管理工具。

## 环境要求

- Python 3.11+
- uv (推荐使用最新版本)

## 安装 uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 或使用 pip
pip install uv
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
uv sync              # 自动创建虚拟环境并安装所有依赖
```

### 2. 配置环境变量

```bash
cp ../.env.example ../.env
# 编辑 .env 文件，配置数据库连接等信息
```

### 3. 运行数据库迁移

```bash
uv run alembic upgrade head
```

### 4. 启动开发服务器

```bash
uv run uvicorn app.main:app --reload
```

服务器将在 http://localhost:8000 启动。

## 常用命令

### 依赖管理

```bash
# 添加新依赖
uv add <package-name>

# 添加开发依赖
uv add --dev <package-name>

# 移除依赖
uv remove <package-name>

# 更新锁文件
uv lock

# 查看已安装的包
uv pip list
```

### 开发命令

```bash
# 运行测试
uv run pytest

# 运行测试并显示覆盖率
uv run pytest --cov=app --cov-report=html

# 代码格式检查
uv run ruff check .

# 自动修复代码格式问题
uv run ruff check --fix .

# 类型检查
uv run mypy .
```

### 数据库迁移

```bash
# 创建新的迁移
uv run alembic revision --autogenerate -m "描述"

# 应用迁移
uv run alembic upgrade head

# 回滚迁移
uv run alembic downgrade -1

# 查看迁移历史
uv run alembic history
```

## 项目结构

```
backend/
├── app/
│   ├── api/v1/          # API 路由处理器
│   ├── core/            # 核心配置和安全
│   ├── db/              # 数据库会话管理
│   ├── models/          # SQLAlchemy ORM 模型
│   ├── schemas/         # Pydantic 请求/响应模式
│   ├── services/        # 业务逻辑层
│   └── main.py          # FastAPI 应用入口
├── tests/               # 测试文件
├── alembic/             # 数据库迁移
├── pyproject.toml       # 项目配置和依赖
└── uv.lock              # 依赖锁文件
```

## 为什么使用 uv？

- **快速**: 比 pip 快 10-100 倍
- **可靠**: 确定性依赖解析，使用锁文件
- **简单**: 自动管理虚拟环境
- **现代**: 支持 PEP 621 标准的 pyproject.toml

## API 文档

启动服务器后，访问以下地址查看 API 文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json
