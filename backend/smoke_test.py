import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = os.environ.get("ETHOLYS_API_URL", "http://127.0.0.1:8000").rstrip("/")
ADMIN_TOKEN = os.environ.get("API_ADMIN_TOKEN", "")


def request_json(path: str, method: str = "GET", body: dict | None = None, headers: dict | None = None):
    data = None
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = Request(f"{BASE_URL}{path}", data=data, method=method, headers=req_headers)
    with urlopen(req, timeout=15) as resp:
        payload = resp.read().decode("utf-8")
        return resp.status, json.loads(payload)


def request_any(path: str, method: str = "GET", body: dict | None = None, headers: dict | None = None):
    try:
        return request_json(path, method=method, body=body, headers=headers)
    except HTTPError as exc:
        raw = exc.read().decode("utf-8") if exc.fp else ""
        try:
            payload = json.loads(raw) if raw else {}
        except ValueError:
            payload = {"detail": raw}
        return exc.code, payload


def wait_ready(max_seconds: int = 90):
    start = time.time()
    while (time.time() - start) < max_seconds:
        try:
            status, payload = request_json("/health")
            if status == 200 and payload.get("status") == "ok":
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError("API did not become healthy in time")


def main() -> int:
    print(f"[smoke] target={BASE_URL}")

    wait_ready()
    print("[smoke] /health OK")

    _, ready_payload = request_json("/health/ready")
    if "checks" not in ready_payload:
        raise RuntimeError("/health/ready missing checks")
    print("[smoke] /health/ready OK")

    if not ADMIN_TOKEN:
        print("[smoke] API_ADMIN_TOKEN is missing, skipping productization flow")
        return 0

    _, create_payload = request_json(
        "/api-product/clients",
        method="POST",
        body={"name": "Smoke Test Client", "plan": "starter", "rpm_limit": 30},
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    api_key = create_payload.get("api_key")
    client_id = create_payload.get("id")
    if not api_key or not client_id:
        raise RuntimeError("Failed to create client in smoke flow")
    print("[smoke] /api-product/clients OK")

    _, me_payload = request_json(
        "/api-product/me",
        headers={"X-API-Key": api_key},
    )
    if me_payload.get("id") != client_id:
        raise RuntimeError("Client ID mismatch on /api-product/me")
    print("[smoke] /api-product/me OK")

    _, usage_payload = request_json(
        "/api-product/usage/current",
        headers={"X-API-Key": api_key},
    )
    if "rpm_limit" not in usage_payload:
        raise RuntimeError("Usage payload missing rpm_limit")
    print("[smoke] /api-product/usage/current OK")

    _, client_metrics_payload = request_json(
        f"/api-product/clients/{client_id}/usage-alerts/metrics?days=30",
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    required_metrics_keys = {
        "days",
        "total",
        "sent",
        "failed",
        "pending",
        "http_2xx",
        "http_4xx",
        "http_5xx",
        "http_other",
        "delivery_p50_ms",
        "delivery_p95_ms",
        "delivery_p99_ms",
        "slo_success_rate_percent",
        "success_rate_percent",
        "last_attempt_at",
    }
    if not required_metrics_keys.issubset(set(client_metrics_payload.keys())):
        raise RuntimeError("Client usage-alert metrics missing expected keys")
    print("[smoke] /api-product/clients/{id}/usage-alerts/metrics OK")

    _, global_metrics_payload = request_json(
        f"/api-product/usage-alerts/metrics?days=30&client_id={client_id}",
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    if not required_metrics_keys.issubset(set(global_metrics_payload.keys())):
        raise RuntimeError("Global usage-alert metrics missing expected keys")
    print("[smoke] /api-product/usage-alerts/metrics OK")

    _, trend_payload = request_json(
        f"/api-product/usage-alerts/trend?days=30&client_id={client_id}",
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    if not isinstance(trend_payload, list):
        raise RuntimeError("Usage-alert trend payload should be a list")
    if trend_payload:
        required_trend_keys = {"day", "total", "sent", "failed", "pending", "http_2xx", "http_4xx", "http_5xx"}
        if not required_trend_keys.issubset(set(trend_payload[0].keys())):
            raise RuntimeError("Usage-alert trend row missing expected keys")
    print("[smoke] /api-product/usage-alerts/trend OK")

    _, key_payload = request_json(
        f"/api-product/clients/{client_id}/keys",
        method="POST",
        body={"name": "integration-a"},
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    extra_key = key_payload.get("api_key")
    key_id = key_payload.get("id")
    if not extra_key or not key_id:
        raise RuntimeError("Failed to create additional key")
    print("[smoke] additional key creation OK")

    status, _ = request_any(
        f"/api-product/clients/{client_id}/keys",
        method="POST",
        body={"name": "integration-b"},
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    if status != 409:
        raise RuntimeError("Expected plan key limit (409) when creating one more key on starter plan")
    print("[smoke] plan key limit enforcement OK")

    _, me_extra_payload = request_json(
        "/api-product/me",
        headers={"X-API-Key": extra_key},
    )
    if me_extra_payload.get("id") != client_id:
        raise RuntimeError("Additional key failed on /api-product/me")
    print("[smoke] additional key auth OK")

    request_json(
        f"/api-product/clients/{client_id}/keys/{key_id}/revoke",
        method="POST",
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    print("[smoke] key revoke endpoint OK")

    status, _ = request_any(
        "/api-product/me",
        headers={"X-API-Key": extra_key},
    )
    if status != 401:
        raise RuntimeError("Revoked key should be unauthorized")
    print("[smoke] revoked key blocked OK")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (HTTPError, URLError, RuntimeError, ValueError) as exc:
        print(f"[smoke] FAILED: {exc}")
        raise SystemExit(1)
