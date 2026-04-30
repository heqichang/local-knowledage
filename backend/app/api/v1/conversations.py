from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.get("/")
async def list_conversations(db: AsyncSession = Depends(get_db)):
    return []


@router.post("/", status_code=201)
async def create_conversation(db: AsyncSession = Depends(get_db)):
    pass


@router.get("/{conv_id}")
async def get_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.put("/{conv_id}")
async def update_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.delete("/{conv_id}", status_code=204)
async def delete_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    pass


@router.post("/{conv_id}/chat")
async def chat(conv_id: int, db: AsyncSession = Depends(get_db)):
    pass
