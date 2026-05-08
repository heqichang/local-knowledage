import hashlib
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Document, DocumentChunk, KnowledgeBase
from app.schemas import DocumentListResponse, DocumentResponse, DocumentStatus
from app.services.chroma import get_chroma_service
from app.services.embedding import get_embedding_service


class DocumentService:
    MAX_FILE_SIZE = 50 * 1024 * 1024

    def __init__(self, db: AsyncSession):
        self.db = db
        self.upload_dir = Path(settings.DATA_DIR) / "uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def get_by_kb_id(self, kb_id: int) -> DocumentListResponse:
        result = await self.db.execute(
            select(Document)
            .where(Document.knowledge_base_id == kb_id)
            .order_by(Document.updated_at.desc())
        )
        items = list(result.scalars().all())

        count_result = await self.db.execute(
            select(func.count()).where(Document.knowledge_base_id == kb_id)
        )
        total = count_result.scalar() or 0

        return DocumentListResponse(
            items=[DocumentResponse.model_validate(item) for item in items],
            total=total,
        )

    async def get_by_id(self, doc_id: int) -> Document | None:
        result = await self.db.execute(
            select(Document).where(Document.id == doc_id)
        )
        return result.scalar_one_or_none()

    async def get_by_hash(self, kb_id: int, file_hash: str) -> Document | None:
        result = await self.db.execute(
            select(Document).where(
                Document.knowledge_base_id == kb_id,
                Document.file_hash == file_hash
            )
        )
        return result.scalar_one_or_none()

    def _calculate_file_hash(self, file_content: bytes) -> str:
        return hashlib.sha256(file_content).hexdigest()

    def _get_file_type(self, filename: str) -> str:
        ext = Path(filename).suffix.lower().lstrip(".")
        valid_types = {"txt", "md", "pdf", "docx", "doc", "xlsx", "xls"}
        return ext if ext in valid_types else "txt"

    def _get_file_path(self, doc_id: int, filename: str) -> Path:
        return self.upload_dir / f"{doc_id}_{filename}"

    async def upload_file(
        self,
        kb_id: int,
        filename: str,
        file_content: bytes,
    ) -> tuple[Document | None, str]:
        kb = await self.db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
        )
        if not kb.scalar_one_or_none():
            return None, "知识库不存在"

        file_hash = self._calculate_file_hash(file_content)

        existing_doc = await self.get_by_hash(kb_id, file_hash)
        if existing_doc:
            return None, f"文件已存在: {existing_doc.filename}"

        file_type = self._get_file_type(filename)
        file_size = len(file_content)
        if file_size > self.MAX_FILE_SIZE:
            return None, "文件大小不能超过 50MB"

        doc = Document(
            knowledge_base_id=kb_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            file_hash=file_hash,
            status=DocumentStatus.PENDING,
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)

        try:
            file_path = self._get_file_path(doc.id, doc.filename)
            file_path.write_bytes(file_content)
        except OSError as exc:
            await self.db.delete(doc)
            await self.db.commit()
            return None, f"文件保存失败: {exc}"

        return doc, ""

    async def process_document(self, doc_id: int) -> Document:
        doc = await self.get_by_id(doc_id)
        if not doc:
            raise ValueError("文档不存在")

        doc.status = DocumentStatus.PROCESSING
        await self.db.commit()

        try:
            file_path = self._get_file_path(doc.id, doc.filename)

            from app.utils.file_parser import get_file_parser
            parser = get_file_parser(doc.file_type)
            text_content = parser.parse(file_path)

            from app.utils.text_splitter import split_text
            chunks = [chunk.strip() for chunk in split_text(text_content) if chunk.strip()]
            if not chunks:
                raise ValueError("文档未解析出可用文本内容")

            embedding_service = get_embedding_service()
            embeddings = embedding_service.encode(chunks)

            chroma_service = get_chroma_service()
            chunk_ids = [f"doc_{doc.id}_chunk_{i}" for i in range(len(chunks))]
            metadatas = [
                {
                    "document_id": doc.id,
                    "chunk_index": i,
                    "kb_id": doc.knowledge_base_id,
                }
                for i in range(len(chunks))
            ]

            chroma_service.add_chunks(
                kb_id=doc.knowledge_base_id,
                chunk_ids=chunk_ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas,
            )

            for i, (chunk_text, chroma_id) in enumerate(zip(chunks, chunk_ids)):
                chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=i,
                    content=chunk_text,
                    chroma_id=chroma_id,
                )
                self.db.add(chunk)

            doc.chunk_count = len(chunks)
            doc.status = DocumentStatus.COMPLETED
            doc.error_message = None

        except Exception as e:
            doc.status = DocumentStatus.FAILED
            doc.error_message = str(e)

        await self.db.commit()
        await self.db.refresh(doc)

        from app.services.knowledge_base import KnowledgeBaseService
        kb_service = KnowledgeBaseService(self.db)
        await kb_service.update_document_count(doc.knowledge_base_id)

        return doc

    async def delete(self, doc_id: int) -> bool:
        doc = await self.get_by_id(doc_id)
        if not doc:
            return False

        kb_id = doc.knowledge_base_id

        result = await self.db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == doc_id)
        )
        chunks = list(result.scalars().all())

        if chunks:
            chroma_service = get_chroma_service()
            chunk_ids = [chunk.chroma_id for chunk in chunks]
            chroma_service.delete_chunks(kb_id, chunk_ids)

        file_path = self.upload_dir / f"{doc.id}_{doc.filename}"
        if file_path.exists():
            file_path.unlink()

        await self.db.delete(doc)
        await self.db.commit()

        from app.services.knowledge_base import KnowledgeBaseService
        kb_service = KnowledgeBaseService(self.db)
        await kb_service.update_document_count(kb_id)

        return True
