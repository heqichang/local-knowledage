"""ChromaDB 管理接口（仅开发环境）"""
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.services.chroma import get_chroma_service

router = APIRouter(prefix="/debug/chroma", tags=["Debug"])


@router.get("/collections")
async def list_collections():
    """列出所有 collection"""
    if not settings.DEBUG:
        raise HTTPException(403, "仅开发环境可用")

    chroma = get_chroma_service()
    collections = chroma.client.list_collections()

    return {
        "total": len(collections),
        "collections": [
            {
                "name": coll.name,
                "id": str(coll.id),
                "count": coll.count(),
            }
            for coll in collections
        ],
    }


@router.get("/collections/{kb_id}")
async def get_collection_data(kb_id: int, limit: int = 10):
    """查看 collection 数据"""
    if not settings.DEBUG:
        raise HTTPException(403, "仅开发环境可用")

    chroma = get_chroma_service()
    collection = chroma.get_collection(kb_id)

    result = collection.get(
        limit=limit,
        include=["documents", "metadatas"]
    )

    return {
        "kb_id": kb_id,
        "total": collection.count(),
        "data": [
            {
                "id": doc_id,
                "document": doc,
                "metadata": meta,
            }
            for doc_id, doc, meta in zip(
                result["ids"],
                result["documents"],
                result["metadatas"]
            )
        ],
    }
