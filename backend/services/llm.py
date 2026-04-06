import json
from typing import Any

import httpx

from config import settings


class LLMError(Exception):
    pass


async def complete_chat(messages: list[dict[str, str]]) -> tuple[str, str]:
    """
    Retorna (texto_resposta, nome_do_modelo_usado).
    messages: [{"role": "user"|"assistant"|"system", "content": "..."}]
    """
    provider = (settings.ai_provider or "gemini").lower().strip()

    if provider == "gemini":
        return await _gemini_chat(messages)
    if provider == "openai":
        return await _openai_chat(messages)
    if provider == "ollama":
        return await _ollama_chat(messages)
    raise LLMError(
        f"AI_PROVIDER desconhecido: {settings.ai_provider}. Use gemini, ollama ou openai."
    )


def _messages_to_gemini_parts(messages: list[dict[str, str]]) -> tuple[str | None, list[dict]]:
    """Separa systemInstruction e contents (user/model) para a API Gemini."""
    system_chunks: list[str] = []
    contents: list[dict] = []
    for m in messages:
        role = (m.get("role") or "user").lower()
        content = m.get("content") or ""
        if role == "system":
            system_chunks.append(content)
            continue
        if role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
        else:
            contents.append({"role": "user", "parts": [{"text": content}]})
    system_instruction = "\n\n".join(system_chunks) if system_chunks else None
    return system_instruction, contents


async def _gemini_chat(messages: list[dict[str, str]]) -> tuple[str, str]:
    if not settings.gemini_api_key:
        raise LLMError("GEMINI_API_KEY não definido (AI_PROVIDER=gemini).")
    model = settings.gemini_model
    key = settings.gemini_api_key.strip()
    system_instruction, contents = _messages_to_gemini_parts(messages)
    if not contents:
        raise LLMError("Nenhuma mensagem user/assistant para enviar ao Gemini.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": key}
    body: dict = {
        "contents": contents,
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192},
    }
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(url, params=params, json=body)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        detail = ""
        try:
            detail = e.response.text[:800]
        except Exception:
            pass
        raise LLMError(f"Gemini HTTP {e.response.status_code}: {detail}") from e
    except httpx.HTTPError as e:
        raise LLMError(f"Falha de rede no Gemini: {e}") from e

    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict) and err.get("message"):
        raise LLMError(f"Gemini: {err['message']}")

    candidates = data.get("candidates") or []
    if not candidates:
        raise LLMError(f"Resposta sem candidates: {json.dumps(data)[:500]}")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join((p.get("text") or "") for p in parts if isinstance(p, dict)).strip()
    if not text:
        raise LLMError(f"Conteúdo vazio na resposta Gemini: {json.dumps(data)[:500]}")
    return text, model


async def _ollama_chat(messages: list[dict[str, str]]) -> tuple[str, str]:
    model = settings.ollama_model
    url = settings.ollama_base_url.rstrip("/") + "/api/chat"
    payload = {"model": model, "messages": messages, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        raise LLMError(
            f"Falha ao chamar Ollama em {url}. "
            f"Confira se o Ollama está rodando e o modelo '{model}' existe. Detalhe: {e}"
        ) from e
    msg = data.get("message") or {}
    content = (msg.get("content") or "").strip()
    if not content:
        raise LLMError(f"Resposta vazia do Ollama: {json.dumps(data)[:500]}")
    return content, model


async def _openai_chat(messages: list[dict[str, str]]) -> tuple[str, str]:
    if not settings.openai_api_key:
        raise LLMError("OPENAI_API_KEY não definido (AI_PROVIDER=openai).")
    model = settings.openai_model
    url = settings.openai_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        detail = ""
        try:
            detail = e.response.text[:500]
        except Exception:
            pass
        raise LLMError(f"OpenAI HTTP {e.response.status_code}: {detail}") from e
    except httpx.HTTPError as e:
        raise LLMError(f"Falha de rede na OpenAI: {e}") from e

    choices = data.get("choices") or []
    if not choices:
        raise LLMError(f"Resposta sem choices: {json.dumps(data)[:500]}")
    content = ((choices[0].get("message") or {}).get("content") or "").strip()
    if not content:
        raise LLMError("Conteúdo vazio na resposta OpenAI.")
    return content, model
