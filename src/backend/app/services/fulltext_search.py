from sqlalchemy import select, text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


async def init_fts5(session: AsyncSession) -> None:
    await session.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS document_chunk_fts 
        USING fts5(
            content,
            content='document_chunk',
            content_rowid='id',
            tokenize='unicode61'
        )
    """))
    await session.execute(text("""
        CREATE TRIGGER IF NOT EXISTS document_chunk_ai 
        AFTER INSERT ON document_chunk BEGIN
            INSERT INTO document_chunk_fts(rowid, content) VALUES (new.id, new.content);
        END
    """))
    await session.execute(text("""
        CREATE TRIGGER IF NOT EXISTS document_chunk_ad 
        AFTER DELETE ON document_chunk BEGIN
            INSERT INTO document_chunk_fts(document_chunk_fts, rowid, content) 
            VALUES('delete', old.id, old.content);
        END
    """))
    await session.execute(text("""
        CREATE TRIGGER IF NOT EXISTS document_chunk_au 
        AFTER UPDATE ON document_chunk BEGIN
            INSERT INTO document_chunk_fts(document_chunk_fts, rowid, content) 
            VALUES('delete', old.id, old.content);
            INSERT INTO document_chunk_fts(rowid, content) VALUES (new.id, new.content);
        END
    """))
    await session.commit()


class FullTextSearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(
        self,
        query: str,
        kb_ids: list[int] | None = None,
        top_k: int = settings.SEARCH_TOP_K,
    ) -> list[dict]:
        sql = """
            SELECT
                dc.id as chunk_id,
                dc.document_id,
                dc.chunk_index,
                dc.content,
                d.filename as document_filename,
                d.knowledge_base_id,
                bm25(document_chunk_fts) as score
            FROM document_chunk_fts
            JOIN document_chunk dc ON dc.id = document_chunk_fts.rowid
            JOIN document d ON d.id = dc.document_id
            WHERE document_chunk_fts MATCH :query
        """

        if kb_ids:
            sql += " AND d.knowledge_base_id IN ({})".format(
                ','.join([':' + str(i) for i in range(len(kb_ids))])
            )

        sql += " ORDER BY score ASC LIMIT :top_k"

        params: dict = {"query": query, "top_k": top_k}
        if kb_ids:
            for i, kb_id in enumerate(kb_ids):
                params[str(i)] = kb_id

        result = await self.db.execute(text(sql), params)
        rows = result.mappings().all()

        results = []
        for row in rows:
            results.append({
                "chunk_id": row["chunk_id"],
                "document_id": row["document_id"],
                "document_filename": row["document_filename"],
                "knowledge_base_id": row["knowledge_base_id"],
                "chunk_index": row["chunk_index"],
                "content": row["content"],
                "score": float(row["score"]),
            })

        return results

    async def rebuild_index(self) -> None:
        await self.db.execute(text("DELETE FROM document_chunk_fts"))
        await self.db.execute(text("""
            INSERT INTO document_chunk_fts(rowid, content)
            SELECT id, content FROM document_chunk
        """))
        await self.db.commit()


def get_fulltext_search_service(db: AsyncSession) -> FullTextSearchService:
    return FullTextSearchService(db)
