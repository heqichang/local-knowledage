from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import (
    AppSettingsResponse,
    AppSettingsUpdate,
    ConnectionTestRequest,
    ConnectionTestResponse,
    EmbeddingProvider,
    LLMProvider,
    RebuildIndexStatusResponse,
)
from app.services.app_settings import (
    AppSettingsService,
    get_rebuild_status,
)

router = APIRouter()


@router.get("/", response_model=AppSettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    service = AppSettingsService(db)
    return await service.get_all()


@router.put("/", response_model=AppSettingsResponse)
async def update_settings(
    data: AppSettingsUpdate,
    trigger_rebuild: bool = Query(False, description="是否立即触发索引重建"),
    db: AsyncSession = Depends(get_db),
):
    service = AppSettingsService(db)
    return await service.update(data, trigger_rebuild=trigger_rebuild)


@router.post("/reset", response_model=AppSettingsResponse)
async def reset_settings(db: AsyncSession = Depends(get_db)):
    service = AppSettingsService(db)
    return await service.reset_to_defaults()


@router.get("/models")
async def list_models(
    provider: LLMProvider | EmbeddingProvider = Query(..., description="Provider 类型"),
    base_url: str = Query("", description="API 地址"),
    api_key: str = Query("", description="API Key"),
    db: AsyncSession = Depends(get_db),
):
    if provider == LLMProvider.OLLAMA:
        service = AppSettingsService(db)
        models = await service.list_ollama_models(base_url)
        return {"models": models}
    return {"models": []}


@router.post("/test-connection", response_model=ConnectionTestResponse)
async def test_connection(
    data: ConnectionTestRequest,
    db: AsyncSession = Depends(get_db),
):
    service = AppSettingsService(db)
    return await service.test_connection(
        provider=data.provider,
        base_url=data.base_url,
        api_key=data.api_key,
        model_name=data.model_name,
    )


@router.post("/rebuild-index")
async def trigger_rebuild_index(db: AsyncSession = Depends(get_db)):
    service = AppSettingsService(db)
    service._start_rebuild_index()
    await service._set_to_db("needs_rebuild_index", "false")
    return {"message": "索引重建任务已启动"}


@router.get("/rebuild-status", response_model=RebuildIndexStatusResponse)
async def get_rebuild_index_status():
    return get_rebuild_status()
