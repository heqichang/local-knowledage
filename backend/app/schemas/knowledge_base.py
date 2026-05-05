from pydantic import ConfigDict
from datetime import datetime

from app.schemas.common import ListResponse, PaginatedResponse
from app.schemas.knowledge_base_base import (
    KnowledgeBaseBase,
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeBaseResponse,
)


class KnowledgeBaseListResponse(ListResponse[KnowledgeBaseResponse]):
    pass


class KnowledgeBasePaginatedResponse(PaginatedResponse[KnowledgeBaseResponse]):
    pass
