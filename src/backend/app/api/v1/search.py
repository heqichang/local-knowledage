from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import SearchRequest, SearchResponse, SearchResult
from app.services.fulltext_search import get_fulltext_search_service
from app.services.hybrid_search import get_hybrid_search_service
from app.services.semantic_search import get_semantic_search_service

router = APIRouter()


@router.post("", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    if request.search_type == "semantic":
        semantic_service = get_semantic_search_service()
        results = semantic_service.search(
            query=request.query,
            kb_ids=request.kb_ids,
            top_k=request.top_k,
        )
    elif request.search_type == "fulltext":
        fulltext_service = get_fulltext_search_service(db)
        results = await fulltext_service.search(
            query=request.query,
            kb_ids=request.kb_ids,
            top_k=request.top_k,
        )
    else:
        hybrid_service = get_hybrid_search_service(db)
        results = await hybrid_service.search(
            query=request.query,
            kb_ids=request.kb_ids,
            top_k=request.top_k,
            semantic_weight=request.semantic_weight,
            fulltext_weight=request.fulltext_weight,
        )

    return SearchResponse(
        items=[SearchResult(**r) for r in results],
        total=len(results),
    )
