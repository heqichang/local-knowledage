
from app.schemas.common import ListResponse, PaginatedResponse
from app.schemas.knowledge_base_base import (
    KnowledgeBaseResponse,
)


class KnowledgeBaseListResponse(ListResponse[KnowledgeBaseResponse]):
    pass


class KnowledgeBasePaginatedResponse(PaginatedResponse[KnowledgeBaseResponse]):
    pass
