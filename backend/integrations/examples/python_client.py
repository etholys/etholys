import os
import requests

base_url = os.getenv("ETHOLYS_API_URL", "http://127.0.0.1:8000")
admin_token = os.getenv("API_ADMIN_TOKEN", "change-me-admin-token")

create_resp = requests.post(
    f"{base_url}/api-product/clients",
    headers={"X-Admin-Token": admin_token},
    json={"name": "Partner Python Demo", "plan": "starter", "rpm_limit": 60},
    timeout=15,
)
create_resp.raise_for_status()
api_key = create_resp.json()["api_key"]

me_resp = requests.get(
    f"{base_url}/api-product/me",
    headers={"X-API-Key": api_key},
    timeout=15,
)
me_resp.raise_for_status()
print("/api-product/me:", me_resp.json())

chat_resp = requests.post(
    f"{base_url}/ai/chat",
    headers={"X-API-Key": api_key},
    json={"message": "Hello from Python external system"},
    timeout=30,
)
chat_resp.raise_for_status()
print("/ai/chat:", chat_resp.json())
