from pydantic import BaseModel, ConfigDict
from datetime import datetime


class KnowledgeBaseBase(BaseModel):
    name: str
    description: str | None = None


class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: int
    document_count: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
