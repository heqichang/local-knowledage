from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "本地知识库"
    VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATA_DIR: Path = Path("./data")
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/app.db"

    CHROMA_PERSIST_DIR: str = "./data/chroma"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"

    EMBEDDING_MODEL: str = "BAAI/bge-small-zh-v1.5"

    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    SEARCH_TOP_K: int = 5
    CHAT_HISTORY_ROUNDS: int = 5

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "case_sensitive": True}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
