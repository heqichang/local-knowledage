from functools import lru_cache
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings


class ChromaDBService:
    def __init__(self):
        persist_dir = Path(settings.CHROMA_PERSIST_DIR)
        persist_dir.mkdir(parents=True, exist_ok=True)

        self.client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def get_or_create_collection(self, kb_id: int):
        collection_name = f"kb_{kb_id}"
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"kb_id": kb_id},
        )

    def delete_collection(self, kb_id: int):
        collection_name = f"kb_{kb_id}"
        try:
            self.client.delete_collection(name=collection_name)
        except ValueError:
            pass

    def add_chunks(
        self,
        kb_id: int,
        chunk_ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict],
    ):
        collection = self.get_or_create_collection(kb_id)
        collection.add(
            ids=chunk_ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

    def delete_chunks(self, kb_id: int, chunk_ids: list[str]):
        collection = self.get_or_create_collection(kb_id)
        collection.delete(ids=chunk_ids)

    def query(
        self,
        kb_id: int,
        query_embedding: list[float],
        top_k: int = 5,
    ):
        collection = self.get_or_create_collection(kb_id)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )
        return results


@lru_cache
def get_chroma_service() -> ChromaDBService:
    return ChromaDBService()
