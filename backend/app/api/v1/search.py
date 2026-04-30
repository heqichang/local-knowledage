from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.post("/")
async def search(db: AsyncSession = Depends(get_db)):
    return []
