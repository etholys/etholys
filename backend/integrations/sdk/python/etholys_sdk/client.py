from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests


@dataclass
class EtholysApiError(Exception):
    status_code: int
    message: str
    payload: Any | None = None

    def __str__(self) -> str:
        return f"Etholys API error {self.status_code}: {self.message}"


class EtholysClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout_seconds: float = 30.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._session = requests.Session()
        self._session.headers.update({"X-API-Key": api_key})

    def _request(self, method: str, path: str, json_body: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        response = self._session.request(
            method=method,
            url=url,
            json=json_body,
            timeout=self.timeout_seconds,
        )

        if response.status_code >= 400:
            payload = None
            message = response.text
            try:
                payload = response.json()
                if isinstance(payload, dict) and "detail" in payload:
                    message = str(payload["detail"])
            except ValueError:
                pass
            raise EtholysApiError(status_code=response.status_code, message=message, payload=payload)

        if not response.content:
            return None
        return response.json()

    def get_me(self) -> dict[str, Any]:
        return self._request("GET", "/api-product/me")

    def get_usage_current(self) -> dict[str, Any]:
        return self._request("GET", "/api-product/usage/current")

    def list_conversations(self, limit: int = 50) -> list[dict[str, Any]]:
        return self._request("GET", f"/ai/conversations?limit={limit}")

    def get_conversation_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/ai/conversations/{conversation_id}/messages")

    def chat(self, message: str, conversation_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"message": message}
        if conversation_id:
            body["conversation_id"] = conversation_id
        return self._request("POST", "/ai/chat", json_body=body)
