from fastapi import APIRouter

from app.api.v1.knowledge_bases import router as kb_router
from app.api.v1.conversations import router as conv_router
from app.api.v1.search import router as search_router
from app.api.v1.app_settings import router as settings_router

router = APIRouter()
router.include_router(kb_router, prefix="/knowledge-bases", tags=["knowledge-bases"])
router.include_router(conv_router, prefix="/conversations", tags=["conversations"])
router.include_router(search_router, prefix="/search", tags=["search"])
router.include_router(settings_router, prefix="/settings", tags=["settings"])
