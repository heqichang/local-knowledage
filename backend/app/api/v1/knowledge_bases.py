from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas import (
    DocumentListResponse,
    DocumentResponse,
    DocumentUploadResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseListResponse,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
)
from app.services import DocumentService, KnowledgeBaseService

router = APIRouter()


@router.get("/", response_model=KnowledgeBaseListResponse)
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    service = KnowledgeBaseService(db)
    return await service.get_all()


@router.post("/", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)

    existing = await service.get_by_name(payload.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"知识库名称 '{payload.name}' 已存在",
        )

    return await service.create(payload)


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)
    kb = await service.get_by_id(kb_id)
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识库不存在",
        )
    return kb


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: int,
    payload: KnowledgeBaseUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)

    if payload.name:
        existing = await service.get_by_name(payload.name)
        if existing and existing.id != kb_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"知识库名称 '{payload.name}' 已存在",
            )

    kb = await service.update(kb_id, payload)
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识库不存在",
        )
    return kb


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)
    success = await service.delete(kb_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识库不存在",
        )


@router.post("/{kb_id}/documents/upload", response_model=DocumentUploadResponse)
async def upload_documents(
    kb_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    uploaded: list[DocumentResponse] = []
    skipped: list[str] = []

    for file in files:
        content = await file.read()
        filename = file.filename or "unknown.txt"

        doc, error = await service.upload_file(kb_id, filename, content)

        if doc:
            uploaded.append(DocumentResponse.model_validate(doc))
        else:
            skipped.append(f"{filename}: {error}")

    return DocumentUploadResponse(uploaded=uploaded, skipped=skipped)


@router.get("/{kb_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    kb_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    return await service.get_by_kb_id(kb_id)


@router.get("/{kb_id}/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(
    kb_id: int,
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc = await service.get_by_id(doc_id)

    if not doc or doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在",
        )

    return doc


@router.delete("/{kb_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    kb_id: int,
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc = await service.get_by_id(doc_id)

    if not doc or doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在",
        )

    await service.delete(doc_id)


@router.get("/{kb_id}/documents/{doc_id}/status", response_model=dict)
async def get_document_status(
    kb_id: int,
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc = await service.get_by_id(doc_id)

    if not doc or doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在",
        )

    return {
        "id": doc.id,
        "status": doc.status,
        "error_message": doc.error_message,
    }
