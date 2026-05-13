import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import psycopg

from config import settings
from db import get_dsn
from observability import purge_old_request_logs
from security import (
    ApiClientContext,
    generate_api_key,
    get_current_usage_snapshot,
    get_usage_summary,
    hash_api_key,
    require_admin_token,
    require_api_client,
    require_scopes,
)
from usage_alerts import retry_failed_usage_alerts

router = APIRouter(prefix="/api-product", tags=["API Product"])

PLAN_ACTIVE_KEY_LIMITS: dict[str, int] = {
    "starter": 2,
    "pro": 5,
    "enterprise": 20,
}


def _active_key_limit_for_plan(plan: str) -> int:
    return PLAN_ACTIVE_KEY_LIMITS.get(plan.strip().lower(), 3)


class CreateClientIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    plan: str = Field(default="starter", min_length=2, max_length=60)
    rpm_limit: int | None = Field(default=None, ge=1, le=100000)
    monthly_request_limit: int | None = Field(default=None, ge=1, le=100000000)
    usage_webhook_url: str | None = Field(default=None, max_length=1000)
    usage_webhook_secret: str | None = Field(default=None, max_length=500)
    scopes: str = Field(default="ai:read,ai:write,usage:read", min_length=1, max_length=400)
    expires_at: datetime | None = None


class CreateClientOut(BaseModel):
    id: uuid.UUID
    name: str
    plan: str
    rpm_limit: int
    api_key: str


class ClientOut(BaseModel):
    id: uuid.UUID
    name: str
    plan: str
    rpm_limit: int
    monthly_request_limit: int | None
    usage_webhook_url: str | None
    usage_webhook_enabled: bool
    is_active: bool
    scopes: str
    expires_at: datetime | None


class UsageOut(BaseModel):
    rpm_limit: int
    current_minute_requests: int
    remaining_this_minute: int
    monthly_request_limit: int | None
    current_month_requests: int
    remaining_this_month: int | None
    window_resets_at: str


class UsageDayOut(BaseModel):
    day: str
    requests: int


class UsageSummaryOut(BaseModel):
    days: int
    total_period: int
    total_last_24h: int
    total_current_month: int
    by_day: list[UsageDayOut]


class RequestLogOut(BaseModel):
    request_id: str
    method: str
    path: str
    status_code: int
    duration_ms: int
    ip_address: str | None
    user_agent: str | None
    created_at: str


class UpdateClientIn(BaseModel):
    plan: str | None = Field(default=None, min_length=2, max_length=60)
    rpm_limit: int | None = Field(default=None, ge=1, le=100000)
    monthly_request_limit: int | None = Field(default=None, ge=1, le=100000000)
    usage_webhook_url: str | None = Field(default=None, max_length=1000)
    usage_webhook_secret: str | None = Field(default=None, max_length=500)
    clear_usage_webhook_secret: bool = False
    is_active: bool | None = None
    scopes: str | None = Field(default=None, min_length=1, max_length=400)
    expires_at: datetime | None = None
    clear_expires_at: bool = False


class RotateKeyOut(BaseModel):
    id: uuid.UUID
    api_key: str


class CreateClientKeyIn(BaseModel):
    name: str = Field(default="default", min_length=1, max_length=80)
    expires_at: datetime | None = None


class ClientKeyOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    is_active: bool
    expires_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None


class CreateClientKeyOut(ClientKeyOut):
    api_key: str


class UsageAlertEventOut(BaseModel):
    id: uuid.UUID
    month_start: str
    threshold_percent: int
    triggered_usage: int
    monthly_limit: int
    delivery_status: str
    http_status: int | None
    error_message: str | None
    created_at: str
    sent_at: str | None


class RetryUsageAlertsOut(BaseModel):
    attempted: int
    sent: int
    failed: int


class UsageAlertMetricsOut(BaseModel):
    days: int
    total: int
    sent: int
    failed: int
    pending: int
    http_2xx: int
    http_4xx: int
    http_5xx: int
    http_other: int
    delivery_p50_ms: float | None
    delivery_p95_ms: float | None
    delivery_p99_ms: float | None
    slo_success_rate_percent: float
    success_rate_percent: float
    last_attempt_at: str | None


class UsageAlertTopClientOut(BaseModel):
    client_id: uuid.UUID
    client_name: str
    plan: str
    total: int
    sent: int
    failed: int
    pending: int
    success_rate_percent: float


class UsageAlertTrendDayOut(BaseModel):
    day: str
    total: int
    sent: int
    failed: int
    pending: int
    http_2xx: int
    http_4xx: int
    http_5xx: int


class PurgeOut(BaseModel):
    older_than_days: int
    deleted: int


@router.post("/clients", response_model=CreateClientOut, dependencies=[Depends(require_admin_token)])
def create_client(body: CreateClientIn):
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)
    rpm_limit = body.rpm_limit or settings.api_default_rpm_limit

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api_client (
                    name,
                    api_key_hash,
                    plan,
                    rpm_limit,
                    monthly_request_limit,
                    usage_webhook_url,
                    usage_webhook_secret,
                    scopes,
                    expires_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, plan, rpm_limit, monthly_request_limit, usage_webhook_url, is_active, scopes, expires_at
                """,
                (
                    body.name.strip(),
                    key_hash,
                    body.plan.strip(),
                    rpm_limit,
                    body.monthly_request_limit,
                    body.usage_webhook_url,
                    body.usage_webhook_secret,
                    body.scopes.strip().lower(),
                    body.expires_at,
                ),
            )
            row = cur.fetchone()
            cur.execute(
                """
                INSERT INTO api_client_key (client_id, name, api_key_hash, is_active, expires_at)
                VALUES (%s, %s, %s, true, %s)
                """,
                (str(row[0]), "primary", key_hash, body.expires_at),
            )
        conn.commit()

    return CreateClientOut(
        id=row[0],
        name=row[1],
        plan=row[2],
        rpm_limit=row[3],
        api_key=raw_key,
    )


@router.get("/clients", response_model=list[ClientOut], dependencies=[Depends(require_admin_token)])
def list_clients(limit: int = 100):
    limit = max(1, min(limit, 500))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, plan, rpm_limit, monthly_request_limit, usage_webhook_url, is_active, scopes, expires_at
                FROM api_client
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()

    return [
        ClientOut(
            id=r[0],
            name=r[1],
            plan=r[2],
            rpm_limit=r[3],
            monthly_request_limit=r[4],
            usage_webhook_url=r[5],
            usage_webhook_enabled=bool(r[5]),
            is_active=r[6],
            scopes=r[7],
            expires_at=r[8],
        )
        for r in rows
    ]


@router.post(
    "/clients/{client_id}/deactivate",
    response_model=ClientOut,
    dependencies=[Depends(require_admin_token)],
)
def deactivate_client(client_id: uuid.UUID):
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE api_client
                SET is_active = false,
                    updated_at = now()
                WHERE id = %s
                RETURNING id, name, plan, rpm_limit, monthly_request_limit, usage_webhook_url, is_active, scopes, expires_at
                """,
                (str(client_id),),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")
        conn.commit()

    return ClientOut(
        id=row[0],
        name=row[1],
        plan=row[2],
        rpm_limit=row[3],
        monthly_request_limit=row[4],
        usage_webhook_url=row[5],
        usage_webhook_enabled=bool(row[5]),
        is_active=row[6],
        scopes=row[7],
        expires_at=row[8],
    )


@router.patch("/clients/{client_id}", response_model=ClientOut, dependencies=[Depends(require_admin_token)])
def update_client(client_id: uuid.UUID, body: UpdateClientIn):
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE api_client
                SET plan = COALESCE(%s, plan),
                    rpm_limit = COALESCE(%s, rpm_limit),
                    monthly_request_limit = COALESCE(%s, monthly_request_limit),
                    usage_webhook_url = COALESCE(%s, usage_webhook_url),
                    usage_webhook_secret = CASE WHEN %s THEN NULL ELSE COALESCE(%s, usage_webhook_secret) END,
                    is_active = COALESCE(%s, is_active),
                    scopes = COALESCE(%s, scopes),
                    expires_at = CASE WHEN %s THEN NULL ELSE COALESCE(%s, expires_at) END,
                    updated_at = now()
                WHERE id = %s
                RETURNING id, name, plan, rpm_limit, monthly_request_limit, usage_webhook_url, is_active, scopes, expires_at
                """,
                (
                    body.plan,
                    body.rpm_limit,
                    body.monthly_request_limit,
                    body.usage_webhook_url,
                    body.clear_usage_webhook_secret,
                    body.usage_webhook_secret,
                    body.is_active,
                    body.scopes.strip().lower() if body.scopes else None,
                    body.clear_expires_at,
                    body.expires_at,
                    str(client_id),
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")
        conn.commit()

    return ClientOut(
        id=row[0],
        name=row[1],
        plan=row[2],
        rpm_limit=row[3],
        monthly_request_limit=row[4],
        usage_webhook_url=row[5],
        usage_webhook_enabled=bool(row[5]),
        is_active=row[6],
        scopes=row[7],
        expires_at=row[8],
    )


@router.post(
    "/clients/{client_id}/rotate-key",
    response_model=RotateKeyOut,
    dependencies=[Depends(require_admin_token)],
)
def rotate_client_key(client_id: uuid.UUID):
    new_raw_key = generate_api_key()
    new_hash = hash_api_key(new_raw_key)

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM api_client WHERE id = %s", (str(client_id),))
            exists = cur.fetchone()
            if exists is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")

            cur.execute(
                """
                UPDATE api_client_key
                SET is_active = false,
                    revoked_at = now()
                WHERE client_id = %s
                  AND is_active = true
                """,
                (str(client_id),),
            )

            cur.execute(
                """
                UPDATE api_client
                SET api_key_hash = %s,
                    updated_at = now()
                WHERE id = %s
                RETURNING id
                """,
                (new_hash, str(client_id)),
            )
            row = cur.fetchone()

            cur.execute(
                """
                INSERT INTO api_client_key (client_id, name, api_key_hash, is_active)
                VALUES (%s, %s, %s, true)
                """,
                (str(client_id), "rotated", new_hash),
            )
        conn.commit()

    return RotateKeyOut(id=row[0], api_key=new_raw_key)


@router.get(
    "/clients/{client_id}/keys",
    response_model=list[ClientKeyOut],
    dependencies=[Depends(require_admin_token)],
)
def list_client_keys(client_id: uuid.UUID, include_inactive: bool = False, limit: int = 100):
    limit = max(1, min(limit, 500))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM api_client WHERE id = %s", (str(client_id),))
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")

            if include_inactive:
                cur.execute(
                    """
                    SELECT id, client_id, name, is_active, expires_at, created_at, revoked_at
                    FROM api_client_key
                    WHERE client_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (str(client_id), limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, client_id, name, is_active, expires_at, created_at, revoked_at
                    FROM api_client_key
                    WHERE client_id = %s
                      AND is_active = true
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (str(client_id), limit),
                )
            rows = cur.fetchall()

    return [
        ClientKeyOut(
            id=row[0],
            client_id=row[1],
            name=row[2],
            is_active=row[3],
            expires_at=row[4],
            created_at=row[5],
            revoked_at=row[6],
        )
        for row in rows
    ]


@router.post(
    "/clients/{client_id}/keys",
    response_model=CreateClientKeyOut,
    dependencies=[Depends(require_admin_token)],
)
def create_client_key(client_id: uuid.UUID, body: CreateClientKeyIn):
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT plan FROM api_client WHERE id = %s", (str(client_id),))
            row_plan = cur.fetchone()
            if row_plan is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")
            key_limit = _active_key_limit_for_plan(str(row_plan[0]))

            cur.execute(
                """
                SELECT COUNT(*)
                FROM api_client_key
                WHERE client_id = %s
                  AND is_active = true
                  AND (expires_at IS NULL OR expires_at >= now())
                """,
                (str(client_id),),
            )
            active_key_count = int(cur.fetchone()[0])
            if active_key_count >= key_limit:
                raise HTTPException(
                    status_code=409,
                    detail=f"Limite de chaves ativas atingido para o plano ({key_limit})",
                )

            cur.execute(
                """
                INSERT INTO api_client_key (client_id, name, api_key_hash, is_active, expires_at)
                VALUES (%s, %s, %s, true, %s)
                RETURNING id, client_id, name, is_active, expires_at, created_at, revoked_at
                """,
                (str(client_id), body.name.strip(), key_hash, body.expires_at),
            )
            row = cur.fetchone()
        conn.commit()

    return CreateClientKeyOut(
        id=row[0],
        client_id=row[1],
        name=row[2],
        is_active=row[3],
        expires_at=row[4],
        created_at=row[5],
        revoked_at=row[6],
        api_key=raw_key,
    )


@router.post(
    "/clients/{client_id}/keys/{key_id}/revoke",
    response_model=ClientKeyOut,
    dependencies=[Depends(require_admin_token)],
)
def revoke_client_key(client_id: uuid.UUID, key_id: uuid.UUID):
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE api_client_key
                SET is_active = false,
                    revoked_at = now()
                WHERE id = %s
                  AND client_id = %s
                RETURNING id, client_id, name, is_active, expires_at, created_at, revoked_at
                """,
                (str(key_id), str(client_id)),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Chave não encontrada")
        conn.commit()

    return ClientKeyOut(
        id=row[0],
        client_id=row[1],
        name=row[2],
        is_active=row[3],
        expires_at=row[4],
        created_at=row[5],
        revoked_at=row[6],
    )


@router.get("/me", response_model=ClientOut)
def my_client(
    client: ApiClientContext = Depends(require_api_client),
    _scopes: None = Depends(require_scopes("usage:read")),
):
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, plan, rpm_limit, monthly_request_limit, usage_webhook_url, is_active, scopes, expires_at
                FROM api_client
                WHERE id = %s
                """,
                (str(client.id),),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")

    return ClientOut(
        id=row[0],
        name=row[1],
        plan=row[2],
        rpm_limit=row[3],
        monthly_request_limit=row[4],
        usage_webhook_url=row[5],
        usage_webhook_enabled=bool(row[5]),
        is_active=row[6],
        scopes=row[7],
        expires_at=row[8],
    )


@router.get(
    "/clients/{client_id}/usage-alerts",
    response_model=list[UsageAlertEventOut],
    dependencies=[Depends(require_admin_token)],
)
def client_usage_alerts(client_id: uuid.UUID, limit: int = 100):
    limit = max(1, min(limit, 500))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM api_client WHERE id = %s", (str(client_id),))
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")

            cur.execute(
                """
                SELECT id, month_start, threshold_percent, triggered_usage, monthly_limit,
                       delivery_status, http_status, error_message, created_at, sent_at
                FROM api_usage_alert_event
                WHERE client_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (str(client_id), limit),
            )
            rows = cur.fetchall()

    return [
        UsageAlertEventOut(
            id=row[0],
            month_start=row[1].isoformat(),
            threshold_percent=row[2],
            triggered_usage=row[3],
            monthly_limit=row[4],
            delivery_status=row[5],
            http_status=row[6],
            error_message=row[7],
            created_at=row[8].isoformat(),
            sent_at=row[9].isoformat() if row[9] else None,
        )
        for row in rows
    ]


@router.post(
    "/clients/{client_id}/usage-alerts/retry",
    response_model=RetryUsageAlertsOut,
    dependencies=[Depends(require_admin_token)],
)
def retry_client_usage_alerts(client_id: uuid.UUID, limit: int = 50):
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM api_client WHERE id = %s", (str(client_id),))
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")

    result = retry_failed_usage_alerts(client_id=client_id, limit=limit)
    return RetryUsageAlertsOut(**result)


@router.get(
    "/clients/{client_id}/usage-alerts/metrics",
    response_model=UsageAlertMetricsOut,
    dependencies=[Depends(require_admin_token)],
)
def client_usage_alert_metrics(client_id: uuid.UUID, days: int = 30):
    days = max(1, min(days, 365))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM api_client WHERE id = %s", (str(client_id),))
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado")

            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE delivery_status = 'sent') AS sent,
                    COUNT(*) FILTER (WHERE delivery_status = 'failed') AS failed,
                    COUNT(*) FILTER (WHERE delivery_status = 'pending') AS pending,
                    COUNT(*) FILTER (WHERE http_status >= 200 AND http_status < 300) AS http_2xx,
                    COUNT(*) FILTER (WHERE http_status >= 400 AND http_status < 500) AS http_4xx,
                    COUNT(*) FILTER (WHERE http_status >= 500 AND http_status < 600) AS http_5xx,
                    COUNT(*) FILTER (WHERE http_status IS NOT NULL AND (http_status < 200 OR (http_status >= 300 AND http_status < 400) OR http_status >= 600)) AS http_other,
                                        percentile_cont(0.50) WITHIN GROUP (ORDER BY delivery_duration_ms) FILTER (WHERE delivery_duration_ms IS NOT NULL) AS delivery_p50_ms,
                                        percentile_cont(0.95) WITHIN GROUP (ORDER BY delivery_duration_ms) FILTER (WHERE delivery_duration_ms IS NOT NULL) AS delivery_p95_ms,
                                        percentile_cont(0.99) WITHIN GROUP (ORDER BY delivery_duration_ms) FILTER (WHERE delivery_duration_ms IS NOT NULL) AS delivery_p99_ms,
                    COUNT(*) FILTER (WHERE delivery_duration_ms IS NOT NULL AND delivery_duration_ms <= %s) AS slo_ok,
                    COUNT(*) FILTER (WHERE delivery_duration_ms IS NOT NULL) AS slo_measured,
                    MAX(sent_at) AS last_attempt_at
                FROM api_usage_alert_event
                WHERE client_id = %s
                  AND created_at >= now() - (%s || ' days')::interval
                """,
                (settings.api_usage_webhook_slo_threshold_ms, str(client_id), days),
            )
            row = cur.fetchone()

    total = int(row[0] or 0)
    sent = int(row[1] or 0)
    failed = int(row[2] or 0)
    pending = int(row[3] or 0)
    http_2xx = int(row[4] or 0)
    http_4xx = int(row[5] or 0)
    http_5xx = int(row[6] or 0)
    http_other = int(row[7] or 0)
    delivery_p50_ms = float(row[8]) if row[8] is not None else None
    delivery_p95_ms = float(row[9]) if row[9] is not None else None
    delivery_p99_ms = float(row[10]) if row[10] is not None else None
    slo_ok = int(row[11] or 0)
    slo_measured = int(row[12] or 0)
    slo_success_rate = (float(slo_ok) * 100.0 / float(slo_measured)) if slo_measured > 0 else 0.0
    success_rate = (float(sent) * 100.0 / float(total)) if total > 0 else 0.0
    last_attempt_at = row[13].isoformat() if row[13] is not None else None

    return UsageAlertMetricsOut(
        days=days,
        total=total,
        sent=sent,
        failed=failed,
        pending=pending,
        http_2xx=http_2xx,
        http_4xx=http_4xx,
        http_5xx=http_5xx,
        http_other=http_other,
        delivery_p50_ms=delivery_p50_ms,
        delivery_p95_ms=delivery_p95_ms,
        delivery_p99_ms=delivery_p99_ms,
        slo_success_rate_percent=round(slo_success_rate, 2),
        success_rate_percent=round(success_rate, 2),
        last_attempt_at=last_attempt_at,
    )


@router.get(
    "/usage-alerts/metrics",
    response_model=UsageAlertMetricsOut,
    dependencies=[Depends(require_admin_token)],
)
def global_usage_alert_metrics(days: int = 30, plan: str | None = None, client_id: uuid.UUID | None = None):
    days = max(1, min(days, 365))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'sent') AS sent,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'failed') AS failed,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'pending') AS pending,
                    COUNT(*) FILTER (WHERE e.http_status >= 200 AND e.http_status < 300) AS http_2xx,
                    COUNT(*) FILTER (WHERE e.http_status >= 400 AND e.http_status < 500) AS http_4xx,
                    COUNT(*) FILTER (WHERE e.http_status >= 500 AND e.http_status < 600) AS http_5xx,
                    COUNT(*) FILTER (WHERE e.http_status IS NOT NULL AND (e.http_status < 200 OR (e.http_status >= 300 AND e.http_status < 400) OR e.http_status >= 600)) AS http_other,
                    percentile_cont(0.50) WITHIN GROUP (ORDER BY e.delivery_duration_ms) FILTER (WHERE e.delivery_duration_ms IS NOT NULL) AS delivery_p50_ms,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY e.delivery_duration_ms) FILTER (WHERE e.delivery_duration_ms IS NOT NULL) AS delivery_p95_ms,
                    percentile_cont(0.99) WITHIN GROUP (ORDER BY e.delivery_duration_ms) FILTER (WHERE e.delivery_duration_ms IS NOT NULL) AS delivery_p99_ms,
                    COUNT(*) FILTER (WHERE e.delivery_duration_ms IS NOT NULL AND e.delivery_duration_ms <= %s) AS slo_ok,
                    COUNT(*) FILTER (WHERE e.delivery_duration_ms IS NOT NULL) AS slo_measured,
                    MAX(e.sent_at) AS last_attempt_at
                FROM api_usage_alert_event e
                JOIN api_client c ON c.id = e.client_id
                WHERE e.created_at >= now() - (%s || ' days')::interval
                                    AND (%s::text IS NULL OR c.plan = %s::text)
                                    AND (%s::uuid IS NULL OR e.client_id = %s::uuid)
                """,
                (settings.api_usage_webhook_slo_threshold_ms, days, plan, plan, str(client_id) if client_id else None, str(client_id) if client_id else None),
            )
            row = cur.fetchone()

    total = int(row[0] or 0)
    sent = int(row[1] or 0)
    failed = int(row[2] or 0)
    pending = int(row[3] or 0)
    http_2xx = int(row[4] or 0)
    http_4xx = int(row[5] or 0)
    http_5xx = int(row[6] or 0)
    http_other = int(row[7] or 0)
    delivery_p50_ms = float(row[8]) if row[8] is not None else None
    delivery_p95_ms = float(row[9]) if row[9] is not None else None
    delivery_p99_ms = float(row[10]) if row[10] is not None else None
    slo_ok = int(row[11] or 0)
    slo_measured = int(row[12] or 0)
    slo_success_rate = (float(slo_ok) * 100.0 / float(slo_measured)) if slo_measured > 0 else 0.0
    success_rate = (float(sent) * 100.0 / float(total)) if total > 0 else 0.0
    last_attempt_at = row[13].isoformat() if row[13] is not None else None

    return UsageAlertMetricsOut(
        days=days,
        total=total,
        sent=sent,
        failed=failed,
        pending=pending,
        http_2xx=http_2xx,
        http_4xx=http_4xx,
        http_5xx=http_5xx,
        http_other=http_other,
        delivery_p50_ms=delivery_p50_ms,
        delivery_p95_ms=delivery_p95_ms,
        delivery_p99_ms=delivery_p99_ms,
        slo_success_rate_percent=round(slo_success_rate, 2),
        success_rate_percent=round(success_rate, 2),
        last_attempt_at=last_attempt_at,
    )


@router.get(
    "/usage-alerts/trend",
    response_model=list[UsageAlertTrendDayOut],
    dependencies=[Depends(require_admin_token)],
)
def usage_alert_trend(days: int = 30, plan: str | None = None, client_id: uuid.UUID | None = None):
    days = max(1, min(days, 365))
    dsn = get_dsn()

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    (e.created_at AT TIME ZONE 'UTC')::date AS day,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'sent') AS sent,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'failed') AS failed,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'pending') AS pending,
                    COUNT(*) FILTER (WHERE e.http_status >= 200 AND e.http_status < 300) AS http_2xx,
                    COUNT(*) FILTER (WHERE e.http_status >= 400 AND e.http_status < 500) AS http_4xx,
                    COUNT(*) FILTER (WHERE e.http_status >= 500 AND e.http_status < 600) AS http_5xx
                FROM api_usage_alert_event e
                JOIN api_client c ON c.id = e.client_id
                WHERE e.created_at >= now() - (%s || ' days')::interval
                                    AND (%s::text IS NULL OR c.plan = %s::text)
                                    AND (%s::uuid IS NULL OR e.client_id = %s::uuid)
                GROUP BY day
                ORDER BY day ASC
                """,
                (days, plan, plan, str(client_id) if client_id else None, str(client_id) if client_id else None),
            )
            rows = cur.fetchall()

    return [
        UsageAlertTrendDayOut(
            day=row[0].isoformat(),
            total=int(row[1] or 0),
            sent=int(row[2] or 0),
            failed=int(row[3] or 0),
            pending=int(row[4] or 0),
            http_2xx=int(row[5] or 0),
            http_4xx=int(row[6] or 0),
            http_5xx=int(row[7] or 0),
        )
        for row in rows
    ]


@router.get(
    "/usage-alerts/top-failing-clients",
    response_model=list[UsageAlertTopClientOut],
    dependencies=[Depends(require_admin_token)],
)
def top_failing_usage_alert_clients(days: int = 30, limit: int = 10):
    days = max(1, min(days, 365))
    limit = max(1, min(limit, 100))

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.id,
                    c.name,
                    c.plan,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'sent') AS sent,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'failed') AS failed,
                    COUNT(*) FILTER (WHERE e.delivery_status = 'pending') AS pending
                FROM api_usage_alert_event e
                JOIN api_client c ON c.id = e.client_id
                WHERE e.created_at >= now() - (%s || ' days')::interval
                GROUP BY c.id, c.name, c.plan
                HAVING COUNT(*) FILTER (WHERE e.delivery_status = 'failed') > 0
                ORDER BY failed DESC, total DESC
                LIMIT %s
                """,
                (days, limit),
            )
            rows = cur.fetchall()

    out: list[UsageAlertTopClientOut] = []
    for row in rows:
        total = int(row[3] or 0)
        sent = int(row[4] or 0)
        failed = int(row[5] or 0)
        pending = int(row[6] or 0)
        success_rate = (float(sent) * 100.0 / float(total)) if total > 0 else 0.0
        out.append(
            UsageAlertTopClientOut(
                client_id=row[0],
                client_name=row[1],
                plan=row[2],
                total=total,
                sent=sent,
                failed=failed,
                pending=pending,
                success_rate_percent=round(success_rate, 2),
            )
        )
    return out


@router.get("/usage/current", response_model=UsageOut)
def my_current_usage(
    client: ApiClientContext = Depends(require_api_client),
    _scopes: None = Depends(require_scopes("usage:read")),
):
    snapshot = get_current_usage_snapshot(client.id)
    return UsageOut(**snapshot)


@router.get("/usage/summary", response_model=UsageSummaryOut)
def my_usage_summary(
    days: int = 30,
    client: ApiClientContext = Depends(require_api_client),
    _scopes: None = Depends(require_scopes("usage:read")),
):
    summary = get_usage_summary(client.id, days=days)
    return UsageSummaryOut(**summary)


@router.get(
    "/clients/{client_id}/usage/summary",
    response_model=UsageSummaryOut,
    dependencies=[Depends(require_admin_token)],
)
def get_client_usage_summary(client_id: uuid.UUID, days: int = 30):
    summary = get_usage_summary(client_id, days=days)
    return UsageSummaryOut(**summary)


@router.get("/request-logs", response_model=list[RequestLogOut])
def my_request_logs(
    limit: int = 100,
    client: ApiClientContext = Depends(require_api_client),
    _scopes: None = Depends(require_scopes("usage:read")),
):
    limit = max(1, min(limit, 500))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT request_id, method, path, status_code, duration_ms, ip_address, user_agent, created_at
                FROM api_request_log
                WHERE client_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (str(client.id), limit),
            )
            rows = cur.fetchall()

    return [
        RequestLogOut(
            request_id=row[0],
            method=row[1],
            path=row[2],
            status_code=row[3],
            duration_ms=row[4],
            ip_address=row[5],
            user_agent=row[6],
            created_at=row[7].isoformat(),
        )
        for row in rows
    ]


@router.delete(
    "/admin/request-logs/purge",
    response_model=PurgeOut,
    dependencies=[Depends(require_admin_token)],
)
def purge_request_logs(older_than_days: int | None = None):
    days = older_than_days or settings.api_request_log_retention_days
    deleted = purge_old_request_logs(days)
    return PurgeOut(older_than_days=days, deleted=deleted)


@router.get(
    "/clients/{client_id}/request-logs",
    response_model=list[RequestLogOut],
    dependencies=[Depends(require_admin_token)],
)
def client_request_logs(client_id: uuid.UUID, limit: int = 100):
    limit = max(1, min(limit, 500))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT request_id, method, path, status_code, duration_ms, ip_address, user_agent, created_at
                FROM api_request_log
                WHERE client_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (str(client_id), limit),
            )
            rows = cur.fetchall()

    return [
        RequestLogOut(
            request_id=row[0],
            method=row[1],
            path=row[2],
            status_code=row[3],
            duration_ms=row[4],
            ip_address=row[5],
            user_agent=row[6],
            created_at=row[7].isoformat(),
        )
        for row in rows
    ]
