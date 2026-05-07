from app.schemas.common import ListResponse, PaginatedResponse
from app.schemas.document_base import (
    DocumentResponse,
)


class DocumentListResponse(ListResponse[DocumentResponse]):
    pass


class DocumentPaginatedResponse(PaginatedResponse[DocumentResponse]):
    pass
