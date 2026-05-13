import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import psycopg
from fastapi import Depends, Header, HTTPException, Request, Response
from fastapi.security import APIKeyHeader

from config import settings
from db import get_dsn
from usage_alerts import emit_usage_threshold_alerts, retry_due_usage_alerts

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass(frozen=True)
class ApiClientContext:
    id: uuid.UUID
    name: str
    plan: str
    rpm_limit: int
    monthly_request_limit: int | None
    scopes: set[str]
    expires_at: datetime | None
    key_id: uuid.UUID | None
    key_name: str | None
    key_expires_at: datetime | None
    usage_webhook_url: str | None
    usage_webhook_secret: str | None


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    # Prefix keeps keys recognizable in logs and customer support flows.
    return f"eth_{secrets.token_urlsafe(24)}"


def _bucket_now() -> datetime:
    now_utc = datetime.now(timezone.utc)
    return now_utc.replace(second=0, microsecond=0)


def _load_client_by_api_key(cur, raw_key: str) -> ApiClientContext | None:
    key_hash = hash_api_key(raw_key)
    cur.execute(
        """
                SELECT
                    c.id,
                    c.name,
                    c.plan,
                    c.rpm_limit,
                    c.monthly_request_limit,
                    c.scopes,
                    c.expires_at,
                    c.usage_webhook_url,
                    c.usage_webhook_secret,
                    k.id,
                    k.name,
                    k.expires_at
                FROM api_client c
                LEFT JOIN api_client_key k
                    ON k.client_id = c.id
                 AND k.api_key_hash = %s
                 AND k.is_active = true
                WHERE c.is_active = true
                    AND (
                        c.api_key_hash = %s
                        OR (k.id IS NOT NULL AND (k.expires_at IS NULL OR k.expires_at >= now()))
                    )
                LIMIT 1
        """,
                (key_hash, key_hash),
    )
    row = cur.fetchone()
    if row is None:
        return None
    scopes_raw = (row[5] or "").strip()
    scopes = {
        s.strip().lower()
        for s in scopes_raw.split(",")
        if s.strip()
    }
    if not scopes:
        scopes = {"ai:read", "ai:write", "usage:read"}
    return ApiClientContext(
        id=row[0],
        name=row[1],
        plan=row[2],
        rpm_limit=row[3],
        monthly_request_limit=row[4],
        scopes=scopes,
        expires_at=row[6],
        usage_webhook_url=row[7],
        usage_webhook_secret=row[8],
        key_id=row[9],
        key_name=row[10],
        key_expires_at=row[11],
    )


def _increment_and_get_minute_usage(cur, client_id: uuid.UUID) -> int:
    bucket = _bucket_now()
    cur.execute(
        """
        INSERT INTO api_usage_minute (client_id, bucket_minute, request_count)
        VALUES (%s, %s, 1)
        ON CONFLICT (client_id, bucket_minute)
        DO UPDATE SET request_count = api_usage_minute.request_count + 1
        RETURNING request_count
        """,
        (str(client_id), bucket),
    )
    return cur.fetchone()[0]


def _get_current_usage(cur, client_id: uuid.UUID) -> int:
    cur.execute(
        """
        SELECT request_count
        FROM api_usage_minute
        WHERE client_id = %s
          AND bucket_minute = %s
        """,
        (str(client_id), _bucket_now()),
    )
    row = cur.fetchone()
    return int(row[0]) if row else 0


def _get_current_month_usage(cur, client_id: uuid.UUID) -> int:
    now_utc = datetime.now(timezone.utc)
    month_start = datetime(now_utc.year, now_utc.month, 1, tzinfo=timezone.utc)
    cur.execute(
        """
        SELECT COALESCE(SUM(request_count), 0)
        FROM api_usage_minute
        WHERE client_id = %s
          AND bucket_minute >= %s
        """,
        (str(client_id), month_start),
    )
    row = cur.fetchone()
    return int(row[0]) if row else 0


def get_current_usage_snapshot(client_id: uuid.UUID) -> dict[str, int | str]:
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                                SELECT rpm_limit, monthly_request_limit
                FROM api_client
                WHERE id = %s
                  AND is_active = true
                """,
                (str(client_id),),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Cliente de API não encontrado")
            rpm_limit = int(row[0])
            monthly_limit = int(row[1]) if row[1] is not None else None
            current = _get_current_usage(cur, client_id)
            current_month = _get_current_month_usage(cur, client_id)

    bucket = _bucket_now()
    reset_at = bucket + timedelta(minutes=1)
    return {
        "rpm_limit": rpm_limit,
        "current_minute_requests": current,
        "remaining_this_minute": max(rpm_limit - current, 0),
        "monthly_request_limit": monthly_limit,
        "current_month_requests": current_month,
        "remaining_this_month": (
            max(monthly_limit - current_month, 0)
            if monthly_limit is not None
            else None
        ),
        "window_resets_at": reset_at.isoformat(),
    }


def get_usage_summary(client_id: uuid.UUID, days: int = 30) -> dict:
    days = max(1, min(days, 365))
    now_utc = datetime.now(timezone.utc)
    period_start = now_utc - timedelta(days=days)
    month_start = datetime(now_utc.year, now_utc.month, 1, tzinfo=timezone.utc)
    last_24h_start = now_utc - timedelta(hours=24)

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(request_count), 0)
                FROM api_usage_minute
                WHERE client_id = %s
                  AND bucket_minute >= %s
                """,
                (str(client_id), period_start),
            )
            total_period = int(cur.fetchone()[0])

            cur.execute(
                """
                SELECT COALESCE(SUM(request_count), 0)
                FROM api_usage_minute
                WHERE client_id = %s
                  AND bucket_minute >= %s
                """,
                (str(client_id), last_24h_start),
            )
            total_last_24h = int(cur.fetchone()[0])

            cur.execute(
                """
                SELECT COALESCE(SUM(request_count), 0)
                FROM api_usage_minute
                WHERE client_id = %s
                  AND bucket_minute >= %s
                """,
                (str(client_id), month_start),
            )
            total_current_month = int(cur.fetchone()[0])

            cur.execute(
                """
                SELECT (bucket_minute AT TIME ZONE 'UTC')::date AS day, SUM(request_count) AS requests
                FROM api_usage_minute
                WHERE client_id = %s
                  AND bucket_minute >= %s
                GROUP BY day
                ORDER BY day ASC
                """,
                (str(client_id), period_start),
            )
            rows = cur.fetchall()

    by_day = [
        {
            "day": r[0].isoformat(),
            "requests": int(r[1]),
        }
        for r in rows
    ]
    return {
        "days": days,
        "total_period": total_period,
        "total_last_24h": total_last_24h,
        "total_current_month": total_current_month,
        "by_day": by_day,
    }


async def require_api_client(
    request: Request,
    response: Response,
    raw_key: str | None = Depends(api_key_header),
) -> ApiClientContext:
    if not raw_key:
        raise HTTPException(status_code=401, detail="X-API-Key ausente")

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            client = _load_client_by_api_key(cur, raw_key)
            if client is None:
                raise HTTPException(status_code=401, detail="X-API-Key inválida")

            now_utc = datetime.now(timezone.utc)
            if client.expires_at is not None:
                expires_at = client.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < now_utc:
                    raise HTTPException(status_code=401, detail="X-API-Key expirada")

            if client.key_expires_at is not None:
                key_expires_at = client.key_expires_at
                if key_expires_at.tzinfo is None:
                    key_expires_at = key_expires_at.replace(tzinfo=timezone.utc)
                if key_expires_at < now_utc:
                    raise HTTPException(status_code=401, detail="X-API-Key expirada")

            current = _increment_and_get_minute_usage(cur, client.id)
            if current > client.rpm_limit:
                conn.rollback()
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit excedido para o plano atual",
                )

            current_month = _get_current_month_usage(cur, client.id)
            if client.monthly_request_limit is not None and current_month > client.monthly_request_limit:
                conn.rollback()
                raise HTTPException(
                    status_code=402,
                    detail="Limite mensal excedido para o plano atual",
                )

        conn.commit()

    response.headers["X-RateLimit-Limit"] = str(client.rpm_limit)
    response.headers["X-RateLimit-Remaining"] = str(max(client.rpm_limit - current, 0))
    response.headers["X-RateLimit-Reset"] = str(int((_bucket_now() + timedelta(minutes=1)).timestamp()))
    response.headers["X-MonthlyLimit"] = (
        str(client.monthly_request_limit)
        if client.monthly_request_limit is not None
        else "unlimited"
    )
    response.headers["X-MonthlyUsage"] = str(current_month)
    response.headers["X-MonthlyRemaining"] = (
        str(max(client.monthly_request_limit - current_month, 0))
        if client.monthly_request_limit is not None
        else "unlimited"
    )
    if client.key_id is not None:
        response.headers["X-API-Key-Id"] = str(client.key_id)
    if client.key_name is not None:
        response.headers["X-API-Key-Name"] = client.key_name
    if client.key_expires_at is not None:
        warning_days = max(settings.api_key_expiry_warning_days, 1)
        key_expires_at = client.key_expires_at
        if key_expires_at.tzinfo is None:
            key_expires_at = key_expires_at.replace(tzinfo=timezone.utc)
        remaining_days = (key_expires_at - datetime.now(timezone.utc)).days
        response.headers["X-API-Key-Expires-At"] = key_expires_at.isoformat()
        if remaining_days <= warning_days:
            response.headers["X-API-Key-Expiry-Warning"] = f"expiring-in-{max(remaining_days, 0)}-days"
    response.headers["X-API-Client-Id"] = str(client.id)
    request.state.api_client = client

    emit_usage_threshold_alerts(
        client_id=client.id,
        client_name=client.name,
        plan=client.plan,
        monthly_limit=client.monthly_request_limit,
        current_month_usage=current_month,
        webhook_url=client.usage_webhook_url,
        webhook_secret=client.usage_webhook_secret,
    )

    retry_due_usage_alerts(limit=settings.api_usage_webhook_auto_retry_per_request)

    return client


def require_scopes(*required_scopes: str) -> Callable[[Request], None]:
    normalized_required = {s.strip().lower() for s in required_scopes if s.strip()}

    def _checker(request: Request) -> None:
        client = getattr(request.state, "api_client", None)
        if client is None:
            raise HTTPException(status_code=401, detail="Cliente API não autenticado")

        if "*" in client.scopes:
            return

        missing = [s for s in normalized_required if s not in client.scopes]
        if missing:
            raise HTTPException(
                status_code=403,
                detail=f"Escopo insuficiente. Necessário: {', '.join(sorted(normalized_required))}",
            )

    return _checker


def require_admin_token(x_admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> None:
    expected = settings.api_admin_token
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="API admin desabilitado: defina API_ADMIN_TOKEN no ambiente",
        )
    if not x_admin_token or x_admin_token != expected:
        raise HTTPException(status_code=401, detail="X-Admin-Token inválido")
