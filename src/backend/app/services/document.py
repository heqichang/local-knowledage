import hashlib
import re
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
    MAX_FILENAME_LENGTH = 200

    def __init__(self, db: AsyncSession):
        self.db = db
        self.upload_dir = Path(settings.DATA_DIR) / "uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_filename(self, filename: str) -> str:
        filename = filename.strip()
        if not filename:
            return ""

        name, ext = Path(filename).stem, Path(filename).suffix.lower()
        name = re.sub(r'[\\/:*?"<>|.\s]+', '_', name)
        name = re.sub(r'_+', '_', name).strip('_')

        if not ext or ext not in {'.md', '.txt'}:
            ext = '.md'
        if not name:
            name = 'untitled'

        if len(name) + len(ext) > self.MAX_FILENAME_LENGTH:
            max_name_len = self.MAX_FILENAME_LENGTH - len(ext)
            name = name[:max_name_len]

        return f"{name}{ext}"

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
        safe_filename = self._sanitize_filename(filename)
        safe_filename = safe_filename.replace('/', '_').replace('\\', '_')
        file_path = self.upload_dir / f"{doc_id}_{safe_filename}"
        resolved_path = file_path.resolve()
        upload_dir_resolved = self.upload_dir.resolve()
        if upload_dir_resolved not in resolved_path.parents and resolved_path != upload_dir_resolved:
            raise ValueError("无效的文件路径")
        return file_path

    async def create_note(
        self,
        kb_id: int,
        filename: str,
        content: str,
    ) -> tuple[Document | None, str]:
        if not content.strip():
            return None, "内容不能全为空或空白"

        safe_filename = self._sanitize_filename(filename)
        if not safe_filename:
            return None, "文件名不能为空"

        kb = await self.db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
        )
        if not kb.scalar_one_or_none():
            return None, "知识库不存在"

        content_bytes = content.encode("utf-8")
        file_hash = self._calculate_file_hash(content_bytes)

        existing_doc = await self.get_by_hash(kb_id, file_hash)
        if existing_doc:
            return None, f"文件已存在: {existing_doc.filename}"

        doc = Document(
            knowledge_base_id=kb_id,
            filename=safe_filename,
            file_type="md",
            file_size=len(content_bytes),
            file_hash=file_hash,
            status=DocumentStatus.PENDING,
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)

        try:
            file_path = self._get_file_path(doc.id, doc.filename)
            file_path.write_text(content, encoding="utf-8")
        except OSError as exc:
            await self.db.delete(doc)
            await self.db.commit()
            return None, f"文件保存失败: {exc}"

        return doc, ""

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
            await self._clear_old_chunks(doc_id)

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
                    "document_filename": doc.filename,
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

    async def _clear_old_chunks(self, doc_id: int) -> None:
        from sqlalchemy import delete

        doc = await self.get_by_id(doc_id)
        if not doc:
            return

        result = await self.db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == doc_id)
        )
        old_chunks = list(result.scalars().all())

        if not old_chunks:
            return

        chroma_service = get_chroma_service()
        chunk_ids = [chunk.chroma_id for chunk in old_chunks]

        if chunk_ids:
            chroma_service.delete_chunks(doc.knowledge_base_id, chunk_ids)

        await self.db.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == doc_id)
        )
        await self.db.commit()

    async def get_content(
        self, doc_id: int
    ) -> tuple[Document | None, str | None, str]:
        doc = await self.get_by_id(doc_id)
        if not doc:
            return None, None, "文档不存在"

        if doc.file_type != "md":
            return None, None, "仅支持 Markdown 文件"

        try:
            file_path = self._get_file_path(doc.id, doc.filename)
            if not file_path.exists():
                return None, None, "文件不存在"
            content = file_path.read_text(encoding="utf-8")
            return doc, content, ""
        except OSError as exc:
            return None, None, f"读取文件失败: {exc}"

    async def update_content(
        self,
        doc_id: int,
        content: str,
        filename: str | None = None,
    ) -> tuple[Document | None, str]:
        if not content.strip():
            return None, "内容不能全为空或空白"

        doc = await self.get_by_id(doc_id)
        if not doc:
            return None, "文档不存在"

        if doc.file_type != "md":
            return None, "仅支持 Markdown 文件"

        content_bytes = content.encode("utf-8")
        new_hash = self._calculate_file_hash(content_bytes)

        old_file_path = self._get_file_path(doc.id, doc.filename)

        if filename and filename != doc.filename:
            safe_new_filename = self._sanitize_filename(filename)
            if not safe_new_filename:
                return None, "文件名不能为空"
            new_filename = safe_new_filename
        else:
            new_filename = doc.filename

        new_file_path = self._get_file_path(doc.id, new_filename)

        try:
            new_file_path.write_text(content, encoding="utf-8")

            if old_file_path != new_file_path and old_file_path.exists():
                old_file_path.unlink()
        except OSError as exc:
            return None, f"文件保存失败: {exc}"

        doc.filename = new_filename
        doc.file_size = len(content_bytes)
        doc.file_hash = new_hash
        doc.status = DocumentStatus.PENDING
        doc.error_message = None

        await self._clear_old_chunks(doc_id)

        await self.db.commit()
        await self.db.refresh(doc)

        return doc, ""

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

        try:
            file_path = self._get_file_path(doc.id, doc.filename)
            if file_path.exists():
                file_path.unlink()
        except (OSError, ValueError):
            pass

        await self.db.delete(doc)
        await self.db.commit()

        from app.services.knowledge_base import KnowledgeBaseService
        kb_service = KnowledgeBaseService(self.db)
        await kb_service.update_document_count(kb_id)

        return True
