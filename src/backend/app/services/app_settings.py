import asyncio
import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.app_settings import AppSettings
from app.schemas.app_settings import (
    AppSettingsBase,
    AppSettingsResponse,
    ConnectionTestResponse,
    EmbeddingProvider,
    LLMProvider,
    RebuildIndexStatus,
    RebuildIndexStatusResponse,
    SearchMode,
)


@dataclass
class RuntimeSettings:
    llm_provider: str = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    llm_api_base_url: str = ""
    llm_api_key: str = ""
    llm_model_name: str = ""
    embedding_provider: str = "local"
    embedding_model: str = "BAAI/bge-small-zh-v1.5"
    embedding_api_base_url: str = ""
    embedding_api_key: str = ""
    embedding_model_name: str = ""
    search_top_k: int = 5
    chunk_size: int = 500
    chunk_overlap: int = 50
    search_mode: str = "hybrid"
    semantic_weight: float = 0.5
    fulltext_weight: float = 0.5
    chat_history_rounds: int = 5
    hf_endpoint: str = "https://hf-mirror.com"


_runtime_settings: RuntimeSettings = RuntimeSettings(
    llm_provider=getattr(settings, "LLM_PROVIDER", "ollama"),
    ollama_base_url=getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434"),
    ollama_model=getattr(settings, "OLLAMA_MODEL", "qwen2.5:7b"),
    llm_api_base_url=getattr(settings, "LLM_API_BASE_URL", ""),
    llm_api_key=getattr(settings, "LLM_API_KEY", ""),
    llm_model_name=getattr(settings, "LLM_MODEL_NAME", ""),
    embedding_provider=getattr(settings, "EMBEDDING_PROVIDER", "local"),
    embedding_model=getattr(settings, "EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5"),
    embedding_api_base_url=getattr(settings, "EMBEDDING_API_BASE_URL", ""),
    embedding_api_key=getattr(settings, "EMBEDDING_API_KEY", ""),
    embedding_model_name=getattr(settings, "EMBEDDING_MODEL_NAME", ""),
    search_top_k=getattr(settings, "SEARCH_TOP_K", 5),
    chunk_size=getattr(settings, "CHUNK_SIZE", 500),
    chunk_overlap=getattr(settings, "CHUNK_OVERLAP", 50),
    search_mode=getattr(settings, "SEARCH_MODE", "hybrid"),
    semantic_weight=getattr(settings, "SEMANTIC_WEIGHT", 0.5),
    fulltext_weight=getattr(settings, "FULLTEXT_WEIGHT", 0.5),
    chat_history_rounds=getattr(settings, "CHAT_HISTORY_ROUNDS", 5),
    hf_endpoint=getattr(settings, "HF_ENDPOINT", "https://hf-mirror.com"),
)

_rebuild_status = RebuildIndexStatusResponse(
    status=RebuildIndexStatus.IDLE,
    progress=0.0,
    message="",
)


def get_runtime_settings() -> RuntimeSettings:
    return _runtime_settings


def get_rebuild_status() -> RebuildIndexStatusResponse:
    return _rebuild_status


async def load_settings_from_db() -> None:
    from sqlalchemy import select

    from app.db.session import async_session
    from app.models.app_settings import AppSettings

    async with async_session() as session:
        result = await session.execute(select(AppSettings))
        settings_list = result.scalars().all()

        settings_map = {s.key: s.value for s in settings_list}

        def parse_int(value: str | None, default: int) -> int:
            if value is None:
                return default
            try:
                return int(value)
            except (ValueError, TypeError):
                return default

        def parse_float(value: str | None, default: float) -> float:
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        _runtime_settings.llm_provider = (
            settings_map.get("llm_provider", _runtime_settings.llm_provider)
        )
        _runtime_settings.ollama_base_url = (
            settings_map.get("ollama_base_url", _runtime_settings.ollama_base_url)
        )
        _runtime_settings.ollama_model = (
            settings_map.get("ollama_model", _runtime_settings.ollama_model)
        )
        _runtime_settings.llm_api_base_url = (
            settings_map.get("llm_api_base_url", _runtime_settings.llm_api_base_url)
        )
        _runtime_settings.llm_api_key = (
            settings_map.get("llm_api_key", _runtime_settings.llm_api_key)
        )
        _runtime_settings.llm_model_name = (
            settings_map.get("llm_model_name", _runtime_settings.llm_model_name)
        )
        _runtime_settings.embedding_provider = (
            settings_map.get("embedding_provider", _runtime_settings.embedding_provider)
        )
        _runtime_settings.embedding_model = (
            settings_map.get("embedding_model", _runtime_settings.embedding_model)
        )
        _runtime_settings.embedding_api_base_url = (
            settings_map.get(
                "embedding_api_base_url", _runtime_settings.embedding_api_base_url
            )
        )
        _runtime_settings.embedding_api_key = (
            settings_map.get("embedding_api_key", _runtime_settings.embedding_api_key)
        )
        _runtime_settings.embedding_model_name = (
            settings_map.get(
                "embedding_model_name", _runtime_settings.embedding_model_name
            )
        )
        _runtime_settings.search_top_k = parse_int(
            settings_map.get("search_top_k"), _runtime_settings.search_top_k
        )
        _runtime_settings.chunk_size = parse_int(
            settings_map.get("chunk_size"), _runtime_settings.chunk_size
        )
        _runtime_settings.chunk_overlap = parse_int(
            settings_map.get("chunk_overlap"), _runtime_settings.chunk_overlap
        )
        _runtime_settings.search_mode = (
            settings_map.get("search_mode", _runtime_settings.search_mode)
        )
        _runtime_settings.semantic_weight = parse_float(
            settings_map.get("semantic_weight"), _runtime_settings.semantic_weight
        )
        _runtime_settings.fulltext_weight = parse_float(
            settings_map.get("fulltext_weight"), _runtime_settings.fulltext_weight
        )
        _runtime_settings.chat_history_rounds = parse_int(
            settings_map.get("chat_history_rounds"),
            _runtime_settings.chat_history_rounds,
        )
        _runtime_settings.hf_endpoint = (
            settings_map.get("hf_endpoint", _runtime_settings.hf_endpoint)
        )


def _mask_api_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "..." + key[-4:]


class AppSettingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_from_db(self, key: str) -> str | None:
        result = await self.db.execute(
            select(AppSettings).where(AppSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        return setting.value if setting else None

    async def _set_to_db(self, key: str, value: Any) -> None:
        result = await self.db.execute(
            select(AppSettings).where(AppSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
        else:
            setting = AppSettings(key=key, value=str(value))
            self.db.add(setting)
        await self.db.commit()

    async def get_all(self) -> AppSettingsResponse:
        stored_llm_provider = await self._get_from_db("llm_provider")
        stored_embedding_provider = await self._get_from_db("embedding_provider")
        stored_search_mode = await self._get_from_db("search_mode")
        stored_ollama_base_url = await self._get_from_db("ollama_base_url")
        stored_ollama_model = await self._get_from_db("ollama_model")
        stored_llm_api_base_url = await self._get_from_db("llm_api_base_url")
        stored_llm_api_key = await self._get_from_db("llm_api_key")
        stored_llm_model_name = await self._get_from_db("llm_model_name")
        stored_embedding_model = await self._get_from_db("embedding_model")
        stored_embedding_api_base_url = await self._get_from_db("embedding_api_base_url")
        stored_embedding_api_key = await self._get_from_db("embedding_api_key")
        stored_embedding_model_name = await self._get_from_db("embedding_model_name")
        stored_search_top_k = await self._get_from_db("search_top_k")
        stored_chunk_size = await self._get_from_db("chunk_size")
        stored_chunk_overlap = await self._get_from_db("chunk_overlap")
        stored_semantic_weight = await self._get_from_db("semantic_weight")
        stored_fulltext_weight = await self._get_from_db("fulltext_weight")
        stored_chat_history_rounds = await self._get_from_db("chat_history_rounds")
        stored_hf_endpoint = await self._get_from_db("hf_endpoint")
        stored_needs_rebuild = await self._get_from_db("needs_rebuild_index")

        llm_api_key = stored_llm_api_key or _runtime_settings.llm_api_key
        embedding_api_key = stored_embedding_api_key or _runtime_settings.embedding_api_key

        def parse_int(value: str | None, default: int) -> int:
            if value is None:
                return default
            try:
                return int(value)
            except (ValueError, TypeError):
                return default

        def parse_float(value: str | None, default: float) -> float:
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        return AppSettingsResponse(
            llm_provider=LLMProvider(
                stored_llm_provider or _runtime_settings.llm_provider
            ),
            ollama_base_url=stored_ollama_base_url or _runtime_settings.ollama_base_url,
            ollama_model=stored_ollama_model or _runtime_settings.ollama_model,
            llm_api_base_url=stored_llm_api_base_url or _runtime_settings.llm_api_base_url,
            llm_api_key=llm_api_key,
            llm_model_name=stored_llm_model_name or _runtime_settings.llm_model_name,
            embedding_provider=EmbeddingProvider(
                stored_embedding_provider or _runtime_settings.embedding_provider
            ),
            embedding_model=stored_embedding_model or _runtime_settings.embedding_model,
            embedding_api_base_url=(
                stored_embedding_api_base_url or _runtime_settings.embedding_api_base_url
            ),
            embedding_api_key=embedding_api_key,
            embedding_model_name=(
                stored_embedding_model_name or _runtime_settings.embedding_model_name
            ),
            search_top_k=parse_int(stored_search_top_k, _runtime_settings.search_top_k),
            chunk_size=parse_int(stored_chunk_size, _runtime_settings.chunk_size),
            chunk_overlap=parse_int(stored_chunk_overlap, _runtime_settings.chunk_overlap),
            search_mode=SearchMode(stored_search_mode or _runtime_settings.search_mode),
            semantic_weight=parse_float(stored_semantic_weight, _runtime_settings.semantic_weight),
            fulltext_weight=parse_float(stored_fulltext_weight, _runtime_settings.fulltext_weight),
            chat_history_rounds=parse_int(
                stored_chat_history_rounds, _runtime_settings.chat_history_rounds
            ),
            hf_endpoint=stored_hf_endpoint or _runtime_settings.hf_endpoint,
            llm_api_key_masked=_mask_api_key(llm_api_key),
            embedding_api_key_masked=_mask_api_key(embedding_api_key),
            needs_rebuild_index=stored_needs_rebuild == "true",
        )

    def _check_rebuild_needed(self, old: RuntimeSettings, new: AppSettingsBase) -> bool:
        return (
            old.embedding_provider != new.embedding_provider.value
            or old.embedding_model != new.embedding_model
            or old.embedding_api_base_url != new.embedding_api_base_url
            or (new.embedding_model_name and old.embedding_model_name != new.embedding_model_name)
            or old.chunk_size != new.chunk_size
            or old.chunk_overlap != new.chunk_overlap
        )

    async def update(self, data: AppSettingsBase, trigger_rebuild: bool = False) -> AppSettingsResponse:
        old_settings = RuntimeSettings(
            llm_provider=_runtime_settings.llm_provider,
            ollama_base_url=_runtime_settings.ollama_base_url,
            ollama_model=_runtime_settings.ollama_model,
            llm_api_base_url=_runtime_settings.llm_api_base_url,
            llm_api_key=_runtime_settings.llm_api_key,
            llm_model_name=_runtime_settings.llm_model_name,
            embedding_provider=_runtime_settings.embedding_provider,
            embedding_model=_runtime_settings.embedding_model,
            embedding_api_base_url=_runtime_settings.embedding_api_base_url,
            embedding_api_key=_runtime_settings.embedding_api_key,
            embedding_model_name=_runtime_settings.embedding_model_name,
            search_top_k=_runtime_settings.search_top_k,
            chunk_size=_runtime_settings.chunk_size,
            chunk_overlap=_runtime_settings.chunk_overlap,
            search_mode=_runtime_settings.search_mode,
            semantic_weight=_runtime_settings.semantic_weight,
            fulltext_weight=_runtime_settings.fulltext_weight,
            chat_history_rounds=_runtime_settings.chat_history_rounds,
            hf_endpoint=_runtime_settings.hf_endpoint,
        )

        await self._set_to_db("llm_provider", data.llm_provider.value)
        await self._set_to_db("ollama_base_url", data.ollama_base_url)
        await self._set_to_db("ollama_model", data.ollama_model)
        await self._set_to_db("llm_api_base_url", data.llm_api_base_url)
        if data.llm_api_key:
            await self._set_to_db("llm_api_key", data.llm_api_key)
        await self._set_to_db("llm_model_name", data.llm_model_name)

        await self._set_to_db("embedding_provider", data.embedding_provider.value)
        await self._set_to_db("embedding_model", data.embedding_model)
        await self._set_to_db("embedding_api_base_url", data.embedding_api_base_url)
        if data.embedding_api_key:
            await self._set_to_db("embedding_api_key", data.embedding_api_key)
        await self._set_to_db("embedding_model_name", data.embedding_model_name)

        await self._set_to_db("search_top_k", data.search_top_k)
        await self._set_to_db("chunk_size", data.chunk_size)
        await self._set_to_db("chunk_overlap", data.chunk_overlap)
        await self._set_to_db("search_mode", data.search_mode.value)
        await self._set_to_db("semantic_weight", data.semantic_weight)
        await self._set_to_db("fulltext_weight", data.fulltext_weight)
        await self._set_to_db("chat_history_rounds", data.chat_history_rounds)
        await self._set_to_db("hf_endpoint", data.hf_endpoint)

        _runtime_settings.llm_provider = data.llm_provider.value
        _runtime_settings.ollama_base_url = data.ollama_base_url
        _runtime_settings.ollama_model = data.ollama_model
        _runtime_settings.llm_api_base_url = data.llm_api_base_url
        _runtime_settings.llm_api_key = (
            data.llm_api_key or _runtime_settings.llm_api_key
        )
        _runtime_settings.llm_model_name = data.llm_model_name
        _runtime_settings.embedding_provider = data.embedding_provider.value
        _runtime_settings.embedding_model = data.embedding_model
        _runtime_settings.embedding_api_base_url = data.embedding_api_base_url
        _runtime_settings.embedding_api_key = (
            data.embedding_api_key or _runtime_settings.embedding_api_key
        )
        _runtime_settings.embedding_model_name = data.embedding_model_name
        _runtime_settings.search_top_k = data.search_top_k
        _runtime_settings.chunk_size = data.chunk_size
        _runtime_settings.chunk_overlap = data.chunk_overlap
        _runtime_settings.search_mode = data.search_mode.value
        _runtime_settings.semantic_weight = data.semantic_weight
        _runtime_settings.fulltext_weight = data.fulltext_weight
        _runtime_settings.chat_history_rounds = data.chat_history_rounds
        _runtime_settings.hf_endpoint = data.hf_endpoint

        import os
        if data.hf_endpoint:
            os.environ["HF_ENDPOINT"] = data.hf_endpoint

        rebuild_needed = self._check_rebuild_needed(old_settings, data)

        if trigger_rebuild:
            await self._set_to_db("needs_rebuild_index", "false")
            self._start_rebuild_index()
        elif rebuild_needed:
            await self._set_to_db("needs_rebuild_index", "true")

        return await self.get_all()

    async def reset_to_defaults(self) -> AppSettingsResponse:
        defaults = AppSettingsBase()
        return await self.update(defaults, trigger_rebuild=False)

    async def test_connection(
        self,
        provider: LLMProvider | EmbeddingProvider,
        base_url: str,
        api_key: str,
        model_name: str,
    ) -> ConnectionTestResponse:
        start_time = time.time()

        try:
            if provider == LLMProvider.OLLAMA:
                url = base_url.rstrip("/")
                if not url:
                    return ConnectionTestResponse(
                        success=False, message="请提供 Ollama 服务地址"
                    )

                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{url}/api/tags")
                    response.raise_for_status()
                    latency_ms = int((time.time() - start_time) * 1000)
                    return ConnectionTestResponse(
                        success=True,
                        message=f"连接成功 ({latency_ms}ms)",
                        latency_ms=latency_ms,
                    )

            elif provider in [LLMProvider.OPENAI_COMPATIBLE, EmbeddingProvider.OPENAI_COMPATIBLE]:
                url = base_url.rstrip("/")
                if not url:
                    return ConnectionTestResponse(
                        success=False, message="请提供 API 地址"
                    )

                headers = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                async with httpx.AsyncClient(timeout=10.0) as client:
                    try:
                        response = await client.get(
                            f"{url}/models", headers=headers
                        )
                        response.raise_for_status()
                        latency_ms = int((time.time() - start_time) * 1000)
                        return ConnectionTestResponse(
                            success=True,
                            message=f"连接成功 ({latency_ms}ms)",
                            latency_ms=latency_ms,
                        )
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code == 401:
                            return ConnectionTestResponse(
                                success=False, message="API Key 无效"
                            )
                        elif e.response.status_code == 404:
                            return ConnectionTestResponse(
                                success=False, message="API 地址无效 (404)"
                            )
                        raise

            elif provider == EmbeddingProvider.LOCAL:
                from app.services.embedding import get_embedding_service

                service = get_embedding_service()
                if service.ready:
                    latency_ms = int((time.time() - start_time) * 1000)
                    return ConnectionTestResponse(
                        success=True,
                        message=f"本地模型已就绪 ({latency_ms}ms)",
                        latency_ms=latency_ms,
                    )
                else:
                    return ConnectionTestResponse(
                        success=False,
                        message=f"本地模型加载中或失败: {service.load_error or '请稍后重试'}",
                    )

            return ConnectionTestResponse(success=False, message="未知的 provider 类型")

        except httpx.ConnectError:
            return ConnectionTestResponse(
                success=False, message="无法连接到服务器，请检查网络或服务是否启动"
            )
        except httpx.TimeoutException:
            return ConnectionTestResponse(
                success=False, message="连接超时，请稍后重试"
            )
        except Exception as e:
            return ConnectionTestResponse(success=False, message=f"连接失败: {str(e)}")

    async def list_ollama_models(self, base_url: str) -> list[str]:
        try:
            url = base_url.rstrip("/")
            if not url:
                return []

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{url}/api/tags")
                response.raise_for_status()
                data = response.json()
                models = data.get("models", [])
                return [m.get("name", "") for m in models if m.get("name")]
        except Exception:
            return []

    def _start_rebuild_index(self) -> None:
        _rebuild_status.status = RebuildIndexStatus.RUNNING
        _rebuild_status.progress = 0.0
        _rebuild_status.message = "正在准备重建索引..."

        thread = threading.Thread(target=self._rebuild_index_thread, daemon=True)
        thread.start()

    def _rebuild_index_thread(self) -> None:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                loop.run_until_complete(self._rebuild_index_async())
            finally:
                loop.close()
        except Exception as e:
            _rebuild_status.status = RebuildIndexStatus.FAILED
            _rebuild_status.message = f"重建失败: {str(e)}"

    async def _rebuild_index_async(self) -> None:
        from sqlalchemy import func, select

        from app.db.session import async_session
        from app.models import Document
        from app.services.chroma import get_chroma_service

        _rebuild_status.progress = 0.0
        _rebuild_status.message = "正在清除旧索引..."

        chroma_service = get_chroma_service()

        async with async_session() as session:
            result = await session.execute(
                select(Document.knowledge_base_id).distinct()
            )
            kb_ids = [row[0] for row in result.fetchall()]

            for kb_id in kb_ids:
                chroma_service.delete_collection(kb_id)

            count_result = await session.execute(select(func.count(Document.id)))
            total_docs = count_result.scalar() or 0

            if total_docs == 0:
                _rebuild_status.status = RebuildIndexStatus.COMPLETED
                _rebuild_status.progress = 1.0
                _rebuild_status.message = "索引重建完成（无文档需要处理）"
                return

            _rebuild_status.message = f"正在重建索引: 0/{total_docs}"

            result = await session.execute(select(Document.id))
            doc_ids = [row[0] for row in result.fetchall()]

            from app.services.document import DocumentService

            for i, doc_id in enumerate(doc_ids):
                try:
                    doc_service = DocumentService(session)
                    await doc_service.process_document(doc_id)

                    progress = (i + 1) / total_docs
                    _rebuild_status.progress = progress
                    _rebuild_status.message = f"正在重建索引: {i + 1}/{total_docs}"
                except Exception as e:
                    _rebuild_status.message = f"处理文档 {doc_id} 时出错: {str(e)}"

            _rebuild_status.status = RebuildIndexStatus.COMPLETED
            _rebuild_status.progress = 1.0
            _rebuild_status.message = "索引重建完成"
