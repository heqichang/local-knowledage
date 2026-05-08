import logging
import threading
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self):
        self.model: SentenceTransformer | None = None
        self._lock = threading.Lock()
        self._load_error: str | None = None

    def load_model(self) -> bool:
        if self.model is not None:
            return True
        with self._lock:
            if self.model is not None:
                return True
            try:
                self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
                self._load_error = None
                return True
            except Exception as exc:
                self._load_error = str(exc)
                logger.warning("Embedding 模型加载失败: %s", exc)
                return False

    def load_model_async(self) -> None:
        thread = threading.Thread(target=self.load_model, daemon=True)
        thread.start()

    @property
    def ready(self) -> bool:
        return self.model is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def encode(self, texts: list[str]) -> list[list[float]]:
        if not self.load_model():
            raise RuntimeError(
                f"Embedding 模型尚未就绪: {self._load_error or '加载中或加载失败'}"
            )
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    def encode_single(self, text: str) -> list[float]:
        return self.encode([text])[0]


@lru_cache
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
