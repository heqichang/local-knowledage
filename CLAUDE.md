# Claude Code Project Instructions

This project follows the best practices and conventions defined in [AGENTS.md](./AGENTS.md).

## Project Type

This is a **React + Vite + FastAPI** full-stack application with:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + Python 3.11+ + SQLAlchemy 2.0 async
- **Python Environment**: uv (fast Python package manager)
- **State Management**: Zustand + TanStack Query (React Query)
- **Database**: PostgreSQL with Alembic migrations
- **Authentication**: JWT-based auth with httpOnly cookies

## Key Principles

When working on this project, always:

1. **Follow the architecture patterns** defined in AGENTS.md
2. **Use TypeScript strict mode** - no `any` types
3. **Keep route handlers thin** - business logic belongs in service layer
4. **Use async/await** consistently in both frontend and backend
5. **Validate all inputs** with Pydantic (backend) and Zod (frontend)
6. **Write tests** for new features and bug fixes
7. **Use dependency injection** via FastAPI's `Depends()`
8. **Handle errors gracefully** with proper HTTP status codes

## Code Organization

### Frontend Structure
```
frontend/src/
├── api/          # API client and request functions
├── components/   # Reusable UI components
├── hooks/        # Custom React hooks
├── pages/        # Route-level components
├── stores/       # Zustand stores
├── types/        # TypeScript types
└── utils/        # Utility functions
```

### Backend Structure
```
backend/app/
├── api/v1/       # Route handlers (thin layer)
├── services/     # Business logic (thick layer)
├── models/       # SQLAlchemy ORM models
├── schemas/      # Pydantic request/response schemas
├── core/         # Config, security, dependencies
└── db/           # Database session management
```

## Development Commands

### Frontend
```bash
cd frontend
pnpm install              # Install dependencies
pnpm dev                  # Start dev server (port 3000)
pnpm build                # Production build
pnpm lint                 # Run ESLint
pnpm type-check           # TypeScript check
```

### Backend
```bash
cd backend
uv sync                             # Install dependencies (creates venv automatically)
uv run uvicorn app.main:app --reload  # Start dev server (port 8000)
uv run pytest                       # Run tests
uv run alembic upgrade head         # Apply migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
```

## Important Conventions

### API Design
- All routes prefixed with `/api/v1/`
- Use proper HTTP status codes (200, 201, 204, 404, 422, etc.)
- Always define `response_model` on route handlers
- Return consistent error format: `{"detail": "message", "code": "ERROR_CODE"}`

### Type Safety
- Frontend: Generate TypeScript types from OpenAPI schema
- Backend: Type hints required on all function signatures
- Share types between frontend and backend via OpenAPI

### State Management
- **Server state**: TanStack Query (React Query)
- **Global client state**: Zustand
- **Local component state**: React useState/useReducer
- **Theme/Auth context**: React Context (sparingly)

### Database Operations
- Always use async SQLAlchemy sessions
- Use service layer for database operations
- Never expose raw SQLAlchemy models to API responses
- Use Pydantic schemas for serialization

### Security
- Never commit `.env` files
- Store secrets in environment variables
- Use parameterized queries (SQLAlchemy handles this)
- Validate and sanitize all user inputs
- Use httpOnly cookies for refresh tokens
- Implement rate limiting on auth endpoints

## Testing Strategy

### Frontend
- Unit tests: Vitest for hooks and utilities
- Component tests: React Testing Library
- E2E tests: Playwright (optional)

### Backend
- Unit tests: pytest for services and utilities
- Integration tests: pytest + httpx AsyncClient for API routes
- Database tests: Use test database with transactions

## Before Committing

1. Run linters: `pnpm lint` (frontend) and `uv run ruff check .` (backend)
2. Run type checks: `pnpm type-check` (frontend) and `uv run mypy .` (backend)
3. Run tests: `pnpm test` (frontend) and `uv run pytest` (backend)
4. Ensure migrations are up to date: `uv run alembic upgrade head`

## Python Environment Management with uv

This project uses **uv** for Python dependency management. Key benefits:
- **Fast**: 10-100x faster than pip
- **Reliable**: Deterministic dependency resolution with lock file
- **Simple**: Automatic virtual environment management

### Common uv Commands
```bash
uv sync              # Install all dependencies (creates .venv automatically)
uv sync --dev        # Install with dev dependencies
uv add <package>     # Add a new dependency
uv add --dev <package>  # Add a dev dependency
uv remove <package>  # Remove a dependency
uv lock              # Update uv.lock file
uv run <command>     # Run command in the virtual environment
uv pip list          # List installed packages
```

### First Time Setup
```bash
cd backend
uv sync              # Creates .venv and installs all dependencies
```

The virtual environment is automatically created in `backend/.venv` and activated when using `uv run`.

## Reference

For detailed code examples, patterns, and conventions, see [AGENTS.md](./AGENTS.md).
