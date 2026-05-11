import json
from typing import AsyncGenerator

import httpx

from app.services.app_settings import get_runtime_settings

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
        self._update_config()

    def _update_config(self) -> None:
        runtime = get_runtime_settings()
        self.llm_provider = runtime.llm_provider
        self.ollama_base_url = runtime.ollama_base_url.rstrip("/")
        self.ollama_model = runtime.ollama_model
        self.llm_api_base_url = runtime.llm_api_base_url.rstrip("/")
        self.llm_api_key = runtime.llm_api_key
        self.llm_model_name = runtime.llm_model_name

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
        self._update_config()
        prompt = self._build_prompt(query, contexts)

        messages = []
        if chat_history:
            for msg in chat_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })
        messages.append({"role": "user", "content": prompt})

        if self.llm_provider == "openai_compatible":
            async for chunk in self._chat_openai_compatible_stream(messages):
                yield chunk
        else:
            async for chunk in self._chat_ollama_stream(messages):
                yield chunk

    async def chat(
        self,
        query: str,
        contexts: list[dict],
        chat_history: list[dict] | None = None,
    ) -> str:
        self._update_config()
        prompt = self._build_prompt(query, contexts)

        messages = []
        if chat_history:
            for msg in chat_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })
        messages.append({"role": "user", "content": prompt})

        if self.llm_provider == "openai_compatible":
            return await self._chat_openai_compatible(messages)
        else:
            return await self._chat_ollama(messages)

    async def _chat_ollama_stream(
        self,
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self.ollama_base_url}/api/chat",
                json={
                    "model": self.ollama_model,
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

    async def _chat_ollama(
        self,
        messages: list[dict],
    ) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.ollama_base_url}/api/chat",
                json={
                    "model": self.ollama_model,
                    "messages": messages,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")

    async def _chat_openai_compatible_stream(
        self,
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        headers = {
            "Content-Type": "application/json",
        }
        if self.llm_api_key:
            headers["Authorization"] = f"Bearer {self.llm_api_key}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self.llm_api_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.llm_model_name,
                    "messages": messages,
                    "stream": True,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        json_data = json.loads(data)
                        delta = json_data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    async def _chat_openai_compatible(
        self,
        messages: list[dict],
    ) -> str:
        headers = {
            "Content-Type": "application/json",
        }
        if self.llm_api_key:
            headers["Authorization"] = f"Bearer {self.llm_api_key}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.llm_api_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.llm_model_name,
                    "messages": messages,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")


def get_rag_service() -> RAGService:
    return RAGService()
