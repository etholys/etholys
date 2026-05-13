# Etholys Python SDK (lightweight)

## Install

```bash
pip install -r requirements.txt
```

## Usage

```python
from etholys_sdk import EtholysClient

client = EtholysClient(base_url="http://127.0.0.1:8000", api_key="eth_xxx")

me = client.get_me()
print(me)

chat = client.chat("Hello from Python SDK")
print(chat)
```
