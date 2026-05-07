from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentBase(BaseModel):
    filename: str
    file_type: str
    file_size: int


class DocumentResponse(DocumentBase):
    id: int
    knowledge_base_id: int
    file_hash: str
    chunk_count: int
    status: DocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    uploaded: list[DocumentResponse]
    skipped: list[str]
