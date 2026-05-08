from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import KnowledgeBase
from app.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseListResponse,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
)
from app.services.chroma import get_chroma_service


class KnowledgeBaseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> KnowledgeBaseListResponse:
        result = await self.db.execute(
            select(KnowledgeBase).order_by(KnowledgeBase.updated_at.desc())
        )
        items = list(result.scalars().all())

        count_result = await self.db.execute(select(func.count()).select_from(KnowledgeBase))
        total = count_result.scalar() or 0

        return KnowledgeBaseListResponse(
            items=[KnowledgeBaseResponse.model_validate(item) for item in items],
            total=total,
        )

    async def get_by_id(self, kb_id: int) -> KnowledgeBase | None:
        result = await self.db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> KnowledgeBase | None:
        result = await self.db.execute(
            select(KnowledgeBase).where(KnowledgeBase.name == name)
        )
        return result.scalar_one_or_none()

    async def create(self, data: KnowledgeBaseCreate) -> KnowledgeBase:
        kb = KnowledgeBase(
            name=data.name,
            description=data.description,
        )
        self.db.add(kb)
        await self.db.commit()
        await self.db.refresh(kb)
        return kb

    async def update(self, kb_id: int, data: KnowledgeBaseUpdate) -> KnowledgeBase | None:
        kb = await self.get_by_id(kb_id)
        if not kb:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(kb, key, value)

        await self.db.commit()
        await self.db.refresh(kb)
        return kb

    async def delete(self, kb_id: int) -> bool:
        kb = await self.get_by_id(kb_id)
        if not kb:
            return False

        chroma_service = get_chroma_service()
        chroma_service.delete_collection(kb_id)

        await self.db.delete(kb)
        await self.db.commit()
        return True

    async def update_document_count(self, kb_id: int) -> None:
        from app.models import Document

        result = await self.db.execute(
            select(func.count()).where(Document.knowledge_base_id == kb_id)
        )
        count = result.scalar() or 0

        kb = await self.get_by_id(kb_id)
        if kb:
            kb.document_count = count
            await self.db.commit()
