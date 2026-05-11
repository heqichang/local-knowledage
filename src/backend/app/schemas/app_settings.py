from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class LLMProvider(str, Enum):
    OLLAMA = "ollama"
    OPENAI_COMPATIBLE = "openai_compatible"


class EmbeddingProvider(str, Enum):
    LOCAL = "local"
    OPENAI_COMPATIBLE = "openai_compatible"


class SearchMode(str, Enum):
    HYBRID = "hybrid"
    SEMANTIC = "semantic"
    FULLTEXT = "fulltext"


class AppSettingsBase(BaseModel):
    llm_provider: LLMProvider = LLMProvider.OLLAMA
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    llm_api_base_url: str = ""
    llm_api_key: str = ""
    llm_model_name: str = ""

    embedding_provider: EmbeddingProvider = EmbeddingProvider.LOCAL
    embedding_model: str = "BAAI/bge-small-zh-v1.5"
    embedding_api_base_url: str = ""
    embedding_api_key: str = ""
    embedding_model_name: str = ""

    search_top_k: int = Field(5, ge=1, le=20)
    chunk_size: int = Field(500, ge=100, le=2000)
    chunk_overlap: int = Field(50, ge=0, le=500)
    search_mode: SearchMode = SearchMode.HYBRID
    semantic_weight: float = Field(0.5, ge=0.0, le=1.0)
    fulltext_weight: float = Field(0.5, ge=0.0, le=1.0)

    chat_history_rounds: int = Field(5, ge=1, le=20)

    hf_endpoint: str = "https://hf-mirror.com"


class AppSettingsUpdate(AppSettingsBase):
    pass


class AppSettingsResponse(AppSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    llm_api_key_masked: str = ""
    embedding_api_key_masked: str = ""
    needs_rebuild_index: bool = False


class ConnectionTestRequest(BaseModel):
    provider: LLMProvider | EmbeddingProvider
    base_url: str = ""
    api_key: str = ""
    model_name: str = ""


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: int | None = None


class RebuildIndexStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class RebuildIndexStatusResponse(BaseModel):
    status: RebuildIndexStatus
    progress: float = 0.0
    message: str = ""
