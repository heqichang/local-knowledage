import hashlib
from pathlib import Path
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Document, KnowledgeBase
from app.schemas import DocumentStatus, DocumentResponse, DocumentListResponse


class DocumentService:
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

        saved_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
        file_path = self.upload_dir / saved_filename
        file_path.write_bytes(file_content)

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

        return doc, ""

    async def process_document(self, doc_id: int) -> Document:
        doc = await self.get_by_id(doc_id)
        if not doc:
            raise ValueError("文档不存在")

        doc.status = DocumentStatus.PROCESSING
        await self.db.commit()

        try:
            file_path = self.upload_dir / f"{doc.id}_{doc.filename}"

            from app.utils.file_parser import get_file_parser
            parser = get_file_parser(doc.file_type)
            text_content = parser.parse(file_path)

            from app.utils.text_splitter import split_text
            chunks = split_text(text_content)

            doc.chunk_count = len(chunks)
            doc.status = DocumentStatus.COMPLETED

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

        file_path = self.upload_dir / f"{doc.id}_{doc.filename}"
        if file_path.exists():
            file_path.unlink()

        await self.db.delete(doc)
        await self.db.commit()

        from app.services.knowledge_base import KnowledgeBaseService
        kb_service = KnowledgeBaseService(self.db)
        await kb_service.update_document_count(kb_id)

        return True
