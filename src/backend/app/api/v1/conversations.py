import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models import Conversation, Message
from app.schemas import (
    ChatRequest,
    ConversationResponse,
    ListResponse,
    MessageResponse,
    Reference,
)
from app.services.hybrid_search import get_hybrid_search_service
from app.services.rag import get_rag_service

router = APIRouter()


@router.get("", response_model=ListResponse[ConversationResponse])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc())
    )
    conversations = list(result.scalars().all())

    count_result = await db.execute(select(func.count(Conversation.id)))
    total = count_result.scalar() or 0

    return ListResponse(
        items=[
            ConversationResponse(
                id=c.id,
                title=c.title,
                knowledge_base_ids=json.loads(c.knowledge_base_ids) if c.knowledge_base_ids else None,
                created_at=c.created_at.isoformat(),
                updated_at=c.updated_at.isoformat(),
            )
            for c in conversations
        ],
        total=total,
    )


@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    request: ChatRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    kb_ids_json = json.dumps(request.kb_ids) if request and request.kb_ids else None
    conv = Conversation(
        title=request.message[:50] if request and request.message else "新对话",
        knowledge_base_ids=kb_ids_json,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        knowledge_base_ids=request.kb_ids if request and request.kb_ids else None,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


@router.get("/{conv_id}", response_model=ConversationResponse)
async def get_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        knowledge_base_ids=json.loads(conv.knowledge_base_ids) if conv.knowledge_base_ids else None,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


@router.get("/{conv_id}/messages", response_model=ListResponse[MessageResponse])
async def get_messages(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    result = await db.execute(
        select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)
    )
    messages = list(result.scalars().all())

    return ListResponse(
        items=[
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                content=m.content,
                references=json.loads(m.references) if m.references else None,
                created_at=m.created_at.isoformat(),
            )
            for m in messages
        ],
        total=len(messages),
    )


@router.delete("/{conv_id}", status_code=204)
async def delete_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    await db.delete(conv)
    await db.commit()


async def _get_chat_history(db: AsyncSession, conv_id: int, rounds: int) -> list[dict]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc())
        .limit(rounds * 2)
    )
    messages = list(result.scalars().all())
    messages.reverse()

    return [{"role": m.role, "content": m.content} for m in messages]


async def _format_references(contexts: list[dict]) -> list[dict]:
    seen = set()
    refs = []
    for ctx in contexts:
        key = f"{ctx.get('document_id')}_{ctx.get('chunk_index')}"
        if key in seen:
            continue
        seen.add(key)
        refs.append({
            "document_id": ctx.get("document_id"),
            "document_filename": ctx.get("document_filename"),
            "chunk_index": ctx.get("chunk_index"),
            "content": ctx.get("content"),
        })
    return refs


async def _chat_stream_generator(
    db: AsyncSession,
    conv_id: int,
    query: str,
    kb_ids: list[int] | None,
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    search_service = get_hybrid_search_service(db)
    rag_service = get_rag_service()

    chat_history = await _get_chat_history(db, conv_id, settings.CHAT_HISTORY_ROUNDS)

    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=query,
    )
    db.add(user_msg)

    conv.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(user_msg)

    references = []
    contexts = []

    try:
        contexts = await search_service.search(
            query=query,
            kb_ids=kb_ids,
            top_k=settings.SEARCH_TOP_K,
        )

        references = await _format_references(contexts)
        ref_event = json.dumps({
            "type": "references",
            "data": references,
        }, ensure_ascii=False)
        yield f"data: {ref_event}\n\n"
    except Exception as exc:
        error_event = json.dumps({
            "type": "error",
            "data": f"检索失败: {exc}",
        }, ensure_ascii=False)
        yield f"data: {error_event}\n\n"

        assistant_msg = Message(
            conversation_id=conv_id,
            role="assistant",
            content=f"检索失败，请检查知识库是否已正确加载文档。错误信息: {exc}",
            references=json.dumps(references) if references else None,
        )
        db.add(assistant_msg)
        await db.commit()

        done_event = json.dumps({"type": "done", "data": None})
        yield f"data: {done_event}\n\n"
        return

    full_content = ""
    try:
        async for chunk in rag_service.chat_stream(
            query=query,
            contexts=contexts,
            chat_history=chat_history,
        ):
            full_content += chunk
            event = json.dumps({
                "type": "content",
                "data": chunk,
            }, ensure_ascii=False)
            yield f"data: {event}\n\n"
    except Exception as exc:
        error_event = json.dumps({
            "type": "error",
            "data": f"生成回答失败: {exc}",
        }, ensure_ascii=False)
        yield f"data: {error_event}\n\n"

        if not full_content:
            full_content = f"生成回答失败，请检查 Ollama 服务是否正常运行。错误信息: {exc}"

    assistant_msg = Message(
        conversation_id=conv_id,
        role="assistant",
        content=full_content,
        references=json.dumps(references) if references else None,
    )
    db.add(assistant_msg)

    if not conv.title or conv.title == "新对话":
        conv.title = query[:50]

    await db.commit()

    done_event = json.dumps({"type": "done", "data": None})
    yield f"data: {done_event}\n\n"


@router.post("/{conv_id}/chat")
async def chat(
    conv_id: int,
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    return StreamingResponse(
        _chat_stream_generator(db, conv_id, request.message, request.kb_ids),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{conv_id}/chat/non-stream", response_model=MessageResponse)
async def chat_non_stream(
    conv_id: int,
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    search_service = get_hybrid_search_service(db)
    rag_service = get_rag_service()

    contexts = await search_service.search(
        query=request.message,
        kb_ids=request.kb_ids,
        top_k=settings.SEARCH_TOP_K,
    )

    chat_history = await _get_chat_history(db, conv_id, settings.CHAT_HISTORY_ROUNDS)

    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)

    conv.updated_at = datetime.utcnow()
    await db.commit()

    answer = await rag_service.chat(
        query=request.message,
        contexts=contexts,
        chat_history=chat_history,
    )

    references = await _format_references(contexts)

    assistant_msg = Message(
        conversation_id=conv_id,
        role="assistant",
        content=answer,
        references=json.dumps(references) if references else None,
    )
    db.add(assistant_msg)

    if not conv.title or conv.title == "新对话":
        conv.title = request.message[:50]

    await db.commit()
    await db.refresh(assistant_msg)

    return MessageResponse(
        id=assistant_msg.id,
        conversation_id=assistant_msg.conversation_id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        references=[Reference(**r) for r in references] if references else None,
        created_at=assistant_msg.created_at.isoformat(),
    )
