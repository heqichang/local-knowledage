import logging
import threading

import httpx
from sentence_transformers import SentenceTransformer

from app.services.app_settings import get_runtime_settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self):
        self._local_model: SentenceTransformer | None = None
        self._lock = threading.Lock()
        self._load_error: str | None = None
        self._update_config()

    def _update_config(self) -> None:
        runtime = get_runtime_settings()
        self.embedding_provider = runtime.embedding_provider
        self.local_model_name = runtime.embedding_model
        self.embedding_api_base_url = runtime.embedding_api_base_url.rstrip("/")
        self.embedding_api_key = runtime.embedding_api_key
        self.embedding_model_name = runtime.embedding_model_name
        self.hf_endpoint = runtime.hf_endpoint

    def _load_local_model(self) -> bool:
        if self._local_model is not None:
            return True
        with self._lock:
            if self._local_model is not None:
                return True
            try:
                import os
                if self.hf_endpoint:
                    os.environ["HF_ENDPOINT"] = self.hf_endpoint

                self._local_model = SentenceTransformer(self.local_model_name)
                self._load_error = None
                return True
            except Exception as exc:
                self._load_error = str(exc)
                logger.warning("Embedding 模型加载失败: %s", exc)
                return False

    def load_model_async(self) -> None:
        thread = threading.Thread(target=self._load_local_model, daemon=True)
        thread.start()

    @property
    def ready(self) -> bool:
        self._update_config()
        if self.embedding_provider == "openai_compatible":
            return bool(self.embedding_api_base_url and self.embedding_model_name)
        return self._local_model is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def encode(self, texts: list[str]) -> list[list[float]]:
        self._update_config()

        if self.embedding_provider == "openai_compatible":
            return self._encode_remote(texts)
        else:
            return self._encode_local(texts)

    def encode_single(self, text: str) -> list[float]:
        return self.encode([text])[0]

    def _encode_local(self, texts: list[str]) -> list[list[float]]:
        if not self._load_local_model():
            raise RuntimeError(
                f"Embedding 模型尚未就绪: {self._load_error or '加载中或加载失败'}"
            )
        assert self._local_model is not None
        embeddings = self._local_model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    def _encode_remote(self, texts: list[str]) -> list[list[float]]:
        if not self.embedding_api_base_url:
            raise RuntimeError("远程 Embedding API 地址未配置")
        if not self.embedding_model_name:
            raise RuntimeError("远程 Embedding 模型名称未配置")

        headers = {
            "Content-Type": "application/json",
        }
        if self.embedding_api_key:
            headers["Authorization"] = f"Bearer {self.embedding_api_key}"

        batch_size = _get_remote_batch_size()
        all_embeddings: list[list[float]] = []
        i = 0

        with httpx.Client(timeout=60.0) as client:
            while i < len(texts):
                current_batch_size = batch_size
                success = False
                last_error: Exception | None = None

                while current_batch_size >= 1 and not success:
                    batch_texts = texts[i : i + current_batch_size]

                    try:
                        response = client.post(
                            f"{self.embedding_api_base_url}/embeddings",
                            headers=headers,
                            json={
                                "model": self.embedding_model_name,
                                "input": batch_texts,
                            },
                        )
                        response.raise_for_status()
                        data = response.json()

                        batch_embeddings = []
                        for item in data.get("data", []):
                            embedding = item.get("embedding", [])
                            batch_embeddings.append(embedding)

                        if len(batch_embeddings) != len(batch_texts):
                            raise RuntimeError(
                                f"返回的 embedding 数量 ({len(batch_embeddings)}) "
                                f"与输入文本数量 ({len(batch_texts)}) 不匹配"
                            )

                        all_embeddings.extend(batch_embeddings)
                        success = True

                        if current_batch_size > batch_size:
                            _set_remote_batch_size(current_batch_size)

                    except httpx.HTTPStatusError as e:
                        last_error = e
                        if e.response.status_code in (400, 413, 429):
                            current_batch_size = current_batch_size // 2
                            _set_remote_batch_size(current_batch_size)
                            continue
                        raise
                    except Exception as e:
                        last_error = e
                        current_batch_size = current_batch_size // 2
                        continue

                if not success:
                    raise RuntimeError(
                        f"远程 Embedding API 调用失败: {last_error}"
                    ) from last_error

                i += current_batch_size

        return all_embeddings


_embedding_service: EmbeddingService | None = None

_remote_batch_size: int = 128


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


def _get_remote_batch_size() -> int:
    global _remote_batch_size
    return _remote_batch_size


def _set_remote_batch_size(size: int) -> None:
    global _remote_batch_size
    _remote_batch_size = max(1, min(size, 2048))
