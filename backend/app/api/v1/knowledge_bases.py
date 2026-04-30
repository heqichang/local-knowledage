from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.get("/")
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    return []


@router.post("/", status_code=201)
async def create_knowledge_base(db: AsyncSession = Depends(get_db)):
    pass


@router.get("/{kb_id}")
async def get_knowledge_base(kb_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.put("/{kb_id}")
async def update_knowledge_base(kb_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.delete("/{kb_id}", status_code=204)
async def delete_knowledge_base(kb_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.post("/{kb_id}/documents/upload")
async def upload_documents(kb_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.get("/{kb_id}/documents")
async def list_documents(kb_id: int, db: AsyncSession = Depends(get_db)):
    return []


@router.get("/{kb_id}/documents/{doc_id}")
async def get_document(kb_id: int, doc_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.delete("/{kb_id}/documents/{doc_id}", status_code=204)
async def delete_document(kb_id: int, doc_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.get("/{kb_id}/documents/{doc_id}/status")
async def get_document_status(kb_id: int, doc_id: int, db: AsyncSession = Depends(get_db)):
    pass
