# Etholys API Integration Guide

This guide helps external systems integrate quickly and safely.

## 1) Base URL and auth

- Base URL (local): `http://localhost:8000`
- Auth header: `X-API-Key: <client_api_key>`
- Admin header: `X-Admin-Token: <API_ADMIN_TOKEN>`

## 2) OpenAPI contract

The canonical contract is stored at:

- `backend/integrations/openapi/etholys-openapi.json`

Regenerate after API changes:

```bash
python export_openapi.py
```

## 3) Minimal onboarding flow for partners

1. Provision a client with `POST /api-product/clients` (admin).
2. Deliver `api_key` securely to partner system.
3. Partner calls `POST /ai/chat` and/or usage endpoints.
4. Partner stores `X-Request-ID` for support traceability.
5. Monitor rate-limit headers for throttle/backoff.

## 4) Headers partners should consume

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-MonthlyLimit`
- `X-MonthlyUsage`
- `X-MonthlyRemaining`
- `X-Request-ID`

## 5) CORS for browser clients

For browser integrations on external domains:

1. Set explicit origins in `CORS_ALLOW_ORIGINS`.
2. Use `CORS_ALLOW_CREDENTIALS=true` only when needed.
3. Do not use wildcard origin with credentials.

Example:

```env
CORS_ALLOW_ORIGINS=https://app.partner.com,https://portal.customer.com
CORS_ALLOW_CREDENTIALS=true
```

## 6) Usage alert webhook verification

When `usage_webhook_secret` is configured, alerts include:

- Header: `X-Etholys-Signature`
- Algorithm: HMAC SHA-256

Receiver pseudocode:

1. Read raw request body.
2. Compute `hex(hmac_sha256(secret, raw_body))`.
3. Compare with `X-Etholys-Signature` using constant-time compare.
4. Reject mismatch with `401`.

## 7) Executable examples

See examples in:

- `backend/integrations/examples/curl.sh`
- `backend/integrations/examples/python_client.py`
- `backend/integrations/examples/node_client.mjs`

## 8) Lightweight SDKs

Official lightweight clients included in this repository:

- Python: `backend/integrations/sdk/python/`
- TypeScript: `backend/integrations/sdk/typescript/`

Both SDKs include:

- API key authentication via `X-API-Key`
- Timeout support
- Error normalization (`detail` from API responses)
- Helper methods for `chat`, `me`, `usage/current`, and conversation queries
