import json
from typing import AsyncGenerator

import httpx

from app.core.config import settings


RAG_PROMPT = """你是一个专业的问答助手，请根据以下提供的参考资料回答用户的问题。

参考资料：
{context}

用户问题：{query}

请根据参考资料回答问题，注意：
1. 请严格基于提供的参考资料回答，不要编造信息
2. 如果参考资料中没有相关信息，请明确告知用户无法回答
3. 回答要清晰、准确、有条理
4. 可以引用参考资料中的原文，但请用自己的话重新组织语言
"""


class RAGService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.OLLAMA_MODEL

    def _build_prompt(self, query: str, contexts: list[dict]) -> str:
        context_texts = []
        for i, ctx in enumerate(contexts):
            source = ctx.get("document_filename", "未知来源")
            content = ctx.get("content", "")
            context_texts.append(f"[{i + 1}] 来源: {source}\n内容: {content}\n")

        context_str = "\n".join(context_texts)
        return RAG_PROMPT.format(context=context_str, query=query)

    async def chat_stream(
        self,
        query: str,
        contexts: list[dict],
        chat_history: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        prompt = self._build_prompt(query, contexts)

        messages = []
        if chat_history:
            for msg in chat_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if data.get("message", {}).get("content"):
                            yield data["message"]["content"]
                    except json.JSONDecodeError:
                        continue

    async def chat(
        self,
        query: str,
        contexts: list[dict],
        chat_history: list[dict] | None = None,
    ) -> str:
        prompt = self._build_prompt(query, contexts)

        messages = []
        if chat_history:
            for msg in chat_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")


def get_rag_service() -> RAGService:
    return RAGService()
