from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.get("/")
async def get_settings(db: AsyncSession = Depends(get_db)):
    return {}


@router.put("/")
async def update_settings(db: AsyncSession = Depends(get_db)):
    pass


@router.get("/models")
async def list_models():
    return []


@router.post("/ollama/check")
async def check_ollama():
    return {"status": "ok"}
