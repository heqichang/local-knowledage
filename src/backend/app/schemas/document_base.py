from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, field_validator


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


class NoteCreate(BaseModel):
    filename: str
    content: str

    @field_validator("filename")
    @classmethod
    def filename_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("文件名不能为空")
        return v

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("内容不能全为空或空白")
        return v


class NoteUpdate(BaseModel):
    content: str
    filename: str | None = None

    @field_validator("filename")
    @classmethod
    def filename_not_empty_if_provided(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("文件名不能为空")
        return v

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("内容不能全为空或空白")
        return v


class DocumentContentResponse(BaseModel):
    id: int
    filename: str
    content: str
