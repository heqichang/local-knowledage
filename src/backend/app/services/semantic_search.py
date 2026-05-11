from app.services.app_settings import get_runtime_settings
from app.services.chroma import ChromaDBService, get_chroma_service
from app.services.embedding import EmbeddingService, get_embedding_service


class SemanticSearchService:
    def __init__(
        self,
        chroma_service: ChromaDBService | None = None,
        embedding_service: EmbeddingService | None = None,
    ):
        self.chroma = chroma_service or get_chroma_service()
        self.embedding = embedding_service or get_embedding_service()

    def search(
        self,
        query: str,
        kb_ids: list[int] | None = None,
        top_k: int | None = None,
    ) -> list[dict]:
        runtime = get_runtime_settings()
        actual_top_k = top_k or runtime.search_top_k
        query_embedding = self.embedding.encode_single(query)

        all_results: list[dict] = []

        if kb_ids:
            for kb_id in kb_ids:
                results = self._search_kb(kb_id, query_embedding, actual_top_k)
                all_results.extend(results)
        else:
            all_collections = self.chroma.client.list_collections()
            for collection in all_collections:
                kb_id = collection.metadata.get("kb_id") if collection.metadata else None
                if kb_id is not None:
                    results = self._search_kb(int(kb_id), query_embedding, actual_top_k)
                    all_results.extend(results)

        all_results.sort(key=lambda x: x["score"])
        return all_results[:actual_top_k]

    def _search_kb(
        self,
        kb_id: int,
        query_embedding: list[float],
        top_k: int,
    ) -> list[dict]:
        results = self.chroma.query(kb_id, query_embedding, top_k)

        if not results.get("ids") or not results["ids"][0]:
            return []

        formatted_results = []
        for i, chroma_id in enumerate(results["ids"][0]):
            metadata = results["metadatas"][0][i]
            document = results["documents"][0][i]
            distance = results["distances"][0][i] if results.get("distances") else 0.0

            formatted_results.append({
                "chroma_id": chroma_id,
                "document_id": metadata.get("document_id"),
                "document_filename": metadata.get("document_filename"),
                "chunk_index": metadata.get("chunk_index"),
                "knowledge_base_id": metadata.get("kb_id"),
                "content": document,
                "score": float(distance),
            })

        return formatted_results


def get_semantic_search_service() -> SemanticSearchService:
    return SemanticSearchService()
