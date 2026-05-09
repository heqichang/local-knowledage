from pydantic import BaseModel, ConfigDict


class SearchResult(BaseModel):
    chunk_id: int | None = None
    document_id: int
    document_filename: str | None = None
    knowledge_base_id: int
    chunk_index: int
    content: str
    score: float
    search_type: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SearchRequest(BaseModel):
    query: str
    kb_ids: list[int] | None = None
    top_k: int = 5
    search_type: str = "hybrid"
    semantic_weight: float = 0.5
    fulltext_weight: float = 0.5


class SearchResponse(BaseModel):
    items: list[SearchResult]
    total: int


class Reference(BaseModel):
    document_id: int
    document_filename: str
    chunk_index: int
    content: str

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    references: list[Reference] | None = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: int
    title: str | None = None
    knowledge_base_ids: list[int] | None = None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    message: str
    kb_ids: list[int] | None = None
