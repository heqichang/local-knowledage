from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.services.app_settings import get_runtime_settings


def split_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[str]:
    runtime = get_runtime_settings()
    size = chunk_size or runtime.chunk_size
    overlap = chunk_overlap or runtime.chunk_overlap

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=[
            "\n\n",
            "\n",
            "。",
            "！",
            "？",
            ".",
            "!",
            "?",
            " ",
            "",
        ],
    )

    return splitter.split_text(text)
