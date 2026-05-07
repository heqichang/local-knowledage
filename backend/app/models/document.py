from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.knowledge_base import KnowledgeBase


class Document(Base):
    __tablename__ = "document"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    knowledge_base_id: Mapped[int] = mapped_column(ForeignKey("knowledge_base.id"))
    filename: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(20))
    file_size: Mapped[int] = mapped_column(Integer)
    file_hash: Mapped[str] = mapped_column(String(64))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    knowledge_base: Mapped[KnowledgeBase] = relationship(back_populates="documents")
    chunks: Mapped[list[DocumentChunk]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunk"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("document.id"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    chroma_id: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    document: Mapped["Document"] = relationship(back_populates="chunks")
