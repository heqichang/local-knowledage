# React + Vite + FastAPI Project Best Practices

## Project Structure

```
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── api/             # API client and request functions
│   │   ├── assets/          # Static assets (images, fonts, etc.)
│   │   ├── components/      # Reusable UI components
│   │   │   └── ui/          # Base UI components (Button, Input, Modal, etc.)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── layouts/         # Page layout components
│   │   ├── pages/           # Route-level page components
│   │   ├── routes/          # Route definitions
│   │   ├── stores/          # State management (Zustand / Context)
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Utility functions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/             # Route handlers
│   │   │   └── v1/          # API version namespace
│   │   ├── core/            # Config, security, dependencies
│   │   ├── db/              # Database connection and session
│   │   ├── models/          # SQLAlchemy / ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic layer
│   │   ├── middleware/       # Custom middleware
│   │   ├── utils/           # Utility functions
│   │   └── main.py          # FastAPI app entry point
│   ├── tests/
│   ├── alembic/             # Database migrations
│   ├── alembic.ini
│   ├── requirements.txt
│   └── pyproject.toml
├── docker-compose.yml
├── .env.example
├── AGENTS.md
└── CLAUDE.md
```

## Frontend (React + Vite + TypeScript)

### General Rules

- **TypeScript strict mode**: Always enable strict mode in `tsconfig.json`
- **Component naming**: Use PascalCase for components, kebab-case for files
- **File organization**: One component per file, co-locate tests and styles
- **Imports**: Use absolute imports with path aliases (`@/components`, `@/utils`)
- **Props**: Define explicit TypeScript interfaces for all component props
- **State management**: Use Zustand for global state, React Context for theme/auth only
- **Forms**: Use React Hook Form + Zod for validation
- **Data fetching**: Use TanStack Query (React Query) for server state
- **Styling**: Use Tailwind CSS with CSS modules for complex components

### Component Structure

```tsx
// components/UserProfile.tsx
import { FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUser } from '@/api/users'

interface UserProfileProps {
  userId: string
  onEdit?: () => void
}

export const UserProfile: FC<UserProfileProps> = ({ userId, onEdit }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId)
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  if (!data) return null

  return (
    <div className="user-profile">
      {/* Component content */}
    </div>
  )
}
```

### API Client Pattern

```typescript
// api/client.ts
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh or redirect to login
    }
    return Promise.reject(error)
  }
)
```

### Custom Hooks Pattern

```typescript
// hooks/useUser.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUser, updateUser } from '@/api/users'
import type { User, UpdateUserDto } from '@/types/user'

export const useUser = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
    staleTime: 5 * 60 * 1000,
  })
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) =>
      updateUser(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user', data.id] })
    },
  })
}
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

### Frontend Conventions

- **Package manager**: Use pnpm (not npm or yarn)
- Avoid `any` type; use `unknown` when type is truly unknown
- Use `const` assertions for literal types
- Prefer named exports over default exports
- Use `React.lazy()` + `Suspense` for route-level code splitting
- Environment variables must be prefixed with `VITE_`
- Use `ErrorBoundary` components to catch rendering errors
- All user-facing text should support i18n from the start

## Backend (FastAPI + Python)

### General Rules

- **Python version**: 3.11+
- **Type hints**: Required on all function signatures
- **Async**: Use `async def` for all route handlers and database operations
- **Dependency injection**: Use FastAPI's `Depends()` for shared logic
- **Configuration**: Use Pydantic `BaseSettings` for environment config
- **Database**: SQLAlchemy 2.0 async + Alembic for migrations
- **Validation**: Pydantic v2 for all request/response schemas
- **Testing**: pytest + pytest-asyncio + httpx for async test client

### App Entry Point

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import router as v1_router
from app.core.config import settings
from app.db.session import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")
```

### Configuration Pattern

```python
# app/core/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "MyApp"
    VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "case_sensitive": True}

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

### Route Handler Pattern

```python
# app/api/v1/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return user

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.create(payload)
```

### Pydantic Schema Pattern

```python
# app/schemas/user.py
from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: EmailStr | None = None
    username: str | None = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

### Service Layer Pattern

```python
# app/services/user.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create(self, data: UserCreate) -> User:
        user = User(
            email=data.email,
            username=data.username,
            hashed_password=hash_password(data.password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
```

### Database Session Pattern

```python
# app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

### Backend Conventions

- Use HTTP status codes correctly: 201 for creation, 204 for deletion, 422 for validation errors
- Always use `response_model` on route handlers to control serialization
- Keep route handlers thin — delegate logic to service layer
- Use `Depends()` for database sessions, auth, pagination, etc.
- Log structured JSON in production (`structlog` or `python-json-logger`)
- Use Alembic `--autogenerate` for migrations, but always review before applying
- Never expose internal errors to clients; use custom exception handlers

## Full-Stack Integration

### API Contract

- Frontend and backend share API types via OpenAPI schema
- Use `openapi-typescript` to generate TypeScript types from FastAPI's `/openapi.json`
- API versioning: prefix all routes with `/api/v1/`

### Authentication Flow

1. Frontend sends credentials to `/api/v1/auth/login`
2. Backend returns JWT access token + refresh token (httpOnly cookie)
3. Frontend stores access token in memory (not localStorage for sensitive apps)
4. API client attaches token via interceptor
5. Backend validates token via `Depends(get_current_user)`

### Error Handling

- Backend returns consistent error format:
  ```json
  { "detail": "Error message", "code": "ERROR_CODE" }
  ```
- Frontend maps error codes to user-friendly messages
- Use TanStack Query's `onError` for global error handling

### Development Workflow

- Frontend: `npm run dev` (Vite dev server on port 3000)
- Backend: `uvicorn app.main:app --reload --port 8000`
- Vite proxies `/api` requests to backend in development
- Use `docker-compose` for local services (PostgreSQL, Redis)

### Commands

```bash
# Frontend
cd frontend && pnpm install          # Install dependencies
cd frontend && pnpm dev              # Start dev server
cd frontend && pnpm build            # Production build
cd frontend && pnpm lint             # ESLint check
cd frontend && pnpm type-check       # TypeScript check

# Backend
cd backend && pip install -r requirements.txt   # Install dependencies
cd backend && uvicorn app.main:app --reload     # Start dev server
cd backend && pytest                             # Run tests
cd backend && alembic upgrade head               # Run migrations
cd backend && alembic revision --autogenerate -m "description"  # Create migration
```
