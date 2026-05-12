import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.db.session import async_session, engine
from app.models import Base

if settings.HF_ENDPOINT:
    os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)

if settings.HF_HOME:
    os.environ.setdefault("HF_HOME", settings.HF_HOME)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.services.app_settings import load_settings_from_db
    await load_settings_from_db()

    from app.services import get_embedding_service, init_fts5
    get_embedding_service().load_model_async()

    async with async_session() as session:
        await init_fts5(session)

    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

allow_origin_regex = None
if settings.CORS_ALLOW_LOCALHOST_ANY_PORT:
    allow_origin_regex = r"^https?://localhost(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok"}, status_code=200)


app.include_router(v1_router, prefix="/api/v1")
