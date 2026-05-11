from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.services.app_settings import get_runtime_settings
from app.services.fulltext_search import FullTextSearchService
from app.services.semantic_search import SemanticSearchService


class HybridSearchService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.fulltext = FullTextSearchService(db)
        self.semantic = SemanticSearchService()

    async def search(
        self,
        query: str,
        kb_ids: list[int] | None = None,
        top_k: int | None = None,
        semantic_weight: float | None = None,
        fulltext_weight: float | None = None,
        search_mode: str | None = None,
    ) -> list[dict]:
        runtime = get_runtime_settings()
        actual_top_k = top_k or runtime.search_top_k
        actual_semantic_weight = semantic_weight if semantic_weight is not None else runtime.semantic_weight
        actual_fulltext_weight = fulltext_weight if fulltext_weight is not None else runtime.fulltext_weight
        actual_mode = search_mode or runtime.search_mode

        semantic_top_k = min(actual_top_k * 3, 20)
        fulltext_top_k = min(actual_top_k * 3, 20)

        if actual_mode == "semantic":
            semantic_results = self.semantic.search(query, kb_ids, semantic_top_k)
            if semantic_results:
                semantic_results = await self._fill_filenames(semantic_results)
            return self._rank_semantic(semantic_results, actual_top_k)
        elif actual_mode == "fulltext":
            fulltext_results = await self.fulltext.search(query, kb_ids, fulltext_top_k)
            return self._rank_fulltext(fulltext_results, actual_top_k)
        else:
            semantic_results = self.semantic.search(query, kb_ids, semantic_top_k)
            fulltext_results = await self.fulltext.search(query, kb_ids, fulltext_top_k)

            if semantic_results:
                semantic_results = await self._fill_filenames(semantic_results)

            if not semantic_results and not fulltext_results:
                return []

            if not semantic_results:
                return self._rank_fulltext(fulltext_results, actual_top_k)
            if not fulltext_results:
                return self._rank_semantic(semantic_results, actual_top_k)

            return self._rrf_rank(
                semantic_results,
                fulltext_results,
                actual_top_k,
                actual_semantic_weight,
                actual_fulltext_weight,
            )

    async def _fill_filenames(self, results: list[dict]) -> list[dict]:
        doc_ids = {r.get("document_id") for r in results if r.get("document_id") and not r.get("document_filename")}
        if not doc_ids:
            return results

        result = await self.db.execute(
            select(Document.id, Document.filename).where(Document.id.in_(doc_ids))
        )
        rows = result.mappings().all()
        filename_map = {row["id"]: row["filename"] for row in rows}

        for r in results:
            if not r.get("document_filename"):
                doc_id = r.get("document_id")
                if doc_id and doc_id in filename_map:
                    r["document_filename"] = filename_map[doc_id]

        return results

    def _rrf_rank(
        self,
        semantic_results: list[dict],
        fulltext_results: list[dict],
        top_k: int,
        semantic_weight: float,
        fulltext_weight: float,
    ) -> list[dict]:
        k = 60
        scores: dict[str, dict] = {}

        for rank, item in enumerate(semantic_results):
            key = self._get_result_key(item)
            if key not in scores:
                scores[key] = {"item": item, "score": 0.0}
            scores[key]["score"] += semantic_weight / (k + rank + 1)

        for rank, item in enumerate(fulltext_results):
            key = self._get_result_key(item)
            if key not in scores:
                scores[key] = {"item": item, "score": 0.0}
            scores[key]["score"] += fulltext_weight / (k + rank + 1)

        ranked = sorted(scores.values(), key=lambda x: x["score"], reverse=True)

        results = []
        for entry in ranked[:top_k]:
            item = entry["item"]
            results.append({
                "chunk_id": item.get("chunk_id"),
                "document_id": item.get("document_id"),
                "document_filename": item.get("document_filename"),
                "knowledge_base_id": item.get("knowledge_base_id"),
                "chunk_index": item.get("chunk_index"),
                "content": item.get("content"),
                "score": entry["score"],
                "search_type": "hybrid",
            })

        return results

    def _get_result_key(self, item: dict) -> str:
        doc_id = item.get("document_id")
        chunk_idx = item.get("chunk_index")
        return f"{doc_id}_{chunk_idx}"

    def _rank_semantic(self, results: list[dict], top_k: int) -> list[dict]:
        return [
            {
                "chunk_id": item.get("chunk_id"),
                "document_id": item.get("document_id"),
                "document_filename": item.get("document_filename"),
                "knowledge_base_id": item.get("knowledge_base_id"),
                "chunk_index": item.get("chunk_index"),
                "content": item.get("content"),
                "score": item.get("score"),
                "search_type": "semantic",
            }
            for item in results[:top_k]
        ]

    def _rank_fulltext(self, results: list[dict], top_k: int) -> list[dict]:
        return [
            {
                "chunk_id": item.get("chunk_id"),
                "document_id": item.get("document_id"),
                "document_filename": item.get("document_filename"),
                "knowledge_base_id": item.get("knowledge_base_id"),
                "chunk_index": item.get("chunk_index"),
                "content": item.get("content"),
                "score": item.get("score"),
                "search_type": "fulltext",
            }
            for item in results[:top_k]
        ]


def get_hybrid_search_service(db: AsyncSession) -> HybridSearchService:
    return HybridSearchService(db)
