import hashlib
import hmac
import json
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psycopg

from config import settings
from db import get_dsn


def _retry_delay_for_count(retry_count: int) -> timedelta:
    base_minutes = max(int(settings.api_usage_webhook_retry_base_minutes), 1)
    exponent = max(retry_count - 1, 0)
    delay_minutes = base_minutes * (2 ** exponent)
    return timedelta(minutes=delay_minutes)


def _parse_thresholds() -> list[int]:
    raw = settings.api_usage_alert_thresholds
    thresholds: set[int] = set()
    for chunk in raw.split(","):
        item = chunk.strip()
        if not item:
            continue
        try:
            value = int(item)
        except ValueError:
            continue
        if 1 <= value <= 100:
            thresholds.add(value)
    if not thresholds:
        thresholds = {80, 90, 100}
    return sorted(thresholds)


def _build_signature(secret: str, payload: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _deliver_webhook(url: str, body: bytes, signature: str | None) -> tuple[bool, int | None, str | None, str | None, int]:
    headers = {
        "Content-Type": "application/json",
        "X-Etholys-Event": "usage.threshold.reached",
    }
    if signature is not None:
        headers["X-Etholys-Signature"] = signature

    req = Request(url=url, data=body, headers=headers, method="POST")
    timeout = max(float(settings.api_usage_webhook_timeout_seconds), 0.5)
    started = time.perf_counter()

    def _elapsed_ms() -> int:
        return int((time.perf_counter() - started) * 1000)

    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return True, int(resp.status), raw[:1500], None, _elapsed_ms()
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return False, int(exc.code), raw[:1500], f"HTTPError: {exc}", _elapsed_ms()
    except URLError as exc:
        return False, None, None, f"URLError: {exc}", _elapsed_ms()
    except Exception as exc:  # pragma: no cover
        return False, None, None, f"UnexpectedError: {exc}", _elapsed_ms()


def _build_usage_event_payload(
    event_id: uuid.UUID,
    occurred_at: datetime,
    client_id: uuid.UUID,
    client_name: str,
    plan: str,
    month_start: date,
    threshold_percent: int,
    current_month_usage: int,
    monthly_limit: int,
) -> bytes:
    usage_percent = int((current_month_usage * 100) / monthly_limit)
    payload_dict = {
        "event": "usage.threshold.reached",
        "event_id": str(event_id),
        "occurred_at": occurred_at.isoformat(),
        "client": {
            "id": str(client_id),
            "name": client_name,
            "plan": plan,
        },
        "usage": {
            "month_start": month_start.isoformat(),
            "threshold_percent": threshold_percent,
            "current_month_usage": current_month_usage,
            "monthly_limit": monthly_limit,
            "usage_percent": usage_percent,
        },
    }
    return json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")


def _update_event_delivery(
    event_id: uuid.UUID,
    ok: bool,
    http_status: int | None,
    response_body: str | None,
    error_message: str | None,
    delivery_duration_ms: int,
    previous_retry_count: int,
) -> None:
    next_retry_at = None
    new_retry_count = previous_retry_count

    if not ok:
        new_retry_count = previous_retry_count + 1
        max_retries = max(int(settings.api_usage_webhook_max_retries), 1)
        if new_retry_count < max_retries:
            next_retry_at = datetime.now(timezone.utc) + _retry_delay_for_count(new_retry_count)

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE api_usage_alert_event
                SET delivery_status = %s,
                    http_status = %s,
                    response_body = %s,
                    error_message = %s,
                    delivery_duration_ms = %s,
                    retry_count = %s,
                    next_retry_at = %s,
                    sent_at = now()
                WHERE id = %s
                """,
                (
                    "sent" if ok else "failed",
                    http_status,
                    response_body,
                    error_message,
                    max(delivery_duration_ms, 0),
                    new_retry_count,
                    next_retry_at,
                    str(event_id),
                ),
            )
        conn.commit()


def emit_usage_threshold_alerts(
    client_id: uuid.UUID,
    client_name: str,
    plan: str,
    monthly_limit: int | None,
    current_month_usage: int,
    webhook_url: str | None,
    webhook_secret: str | None,
) -> None:
    if not webhook_url:
        return
    if monthly_limit is None or monthly_limit <= 0:
        return

    usage_percent = int((current_month_usage * 100) / monthly_limit)
    reached = [t for t in _parse_thresholds() if usage_percent >= t]
    if not reached:
        return

    now_utc = datetime.now(timezone.utc)
    month_start = date(now_utc.year, now_utc.month, 1)
    dsn = get_dsn()

    for threshold in reached:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO api_usage_alert_event (
                        client_id,
                        month_start,
                        threshold_percent,
                        triggered_usage,
                        monthly_limit,
                        webhook_url,
                        delivery_status,
                        retry_count,
                        next_retry_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 'pending', 0, now())
                    ON CONFLICT (client_id, month_start, threshold_percent) DO NOTHING
                    RETURNING id, retry_count
                    """,
                    (
                        str(client_id),
                        month_start,
                        threshold,
                        current_month_usage,
                        monthly_limit,
                        webhook_url,
                    ),
                )
                row = cur.fetchone()
                if row is None:
                    conn.commit()
                    continue
                event_id = row[0]
                retry_count = int(row[1])
                conn.commit()

        body = _build_usage_event_payload(
            event_id=event_id,
            occurred_at=now_utc,
            client_id=client_id,
            client_name=client_name,
            plan=plan,
            month_start=month_start,
            threshold_percent=threshold,
            current_month_usage=current_month_usage,
            monthly_limit=monthly_limit,
        )
        signature = _build_signature(webhook_secret, body) if webhook_secret else None

        ok, http_status, response_body, error_message, duration_ms = _deliver_webhook(webhook_url, body, signature)

        _update_event_delivery(
            event_id=event_id,
            ok=ok,
            http_status=http_status,
            response_body=response_body,
            error_message=error_message,
            delivery_duration_ms=duration_ms,
            previous_retry_count=retry_count,
        )


def retry_failed_usage_alerts(client_id: uuid.UUID, limit: int = 50) -> dict[str, int]:
    limit = max(1, min(limit, 500))
    dsn = get_dsn()

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.id,
                       e.month_start,
                       e.threshold_percent,
                       e.triggered_usage,
                       e.monthly_limit,
                       e.webhook_url,
                      e.retry_count,
                       c.name,
                       c.plan,
                       c.usage_webhook_secret
                FROM api_usage_alert_event e
                JOIN api_client c ON c.id = e.client_id
                WHERE e.client_id = %s
                  AND e.delivery_status = 'failed'
                ORDER BY e.created_at DESC
                LIMIT %s
                """,
                (str(client_id), limit),
            )
            rows = cur.fetchall()

    attempted = 0
    sent = 0
    failed = 0
    now_utc = datetime.now(timezone.utc)

    for row in rows:
        event_id = row[0]
        month_start = row[1]
        threshold_percent = int(row[2])
        triggered_usage = int(row[3])
        monthly_limit = int(row[4])
        webhook_url = row[5]
        retry_count = int(row[6])
        client_name = row[7]
        plan = row[8]
        webhook_secret = row[9]

        body = _build_usage_event_payload(
            event_id=event_id,
            occurred_at=now_utc,
            client_id=client_id,
            client_name=client_name,
            plan=plan,
            month_start=month_start,
            threshold_percent=threshold_percent,
            current_month_usage=triggered_usage,
            monthly_limit=monthly_limit,
        )
        signature = _build_signature(webhook_secret, body) if webhook_secret else None
        ok, http_status, response_body, error_message, duration_ms = _deliver_webhook(webhook_url, body, signature)
        _update_event_delivery(
            event_id=event_id,
            ok=ok,
            http_status=http_status,
            response_body=response_body,
            error_message=error_message,
            delivery_duration_ms=duration_ms,
            previous_retry_count=retry_count,
        )

        attempted += 1
        if ok:
            sent += 1
        else:
            failed += 1

    return {
        "attempted": attempted,
        "sent": sent,
        "failed": failed,
    }


def retry_due_usage_alerts(limit: int = 20) -> dict[str, int]:
    limit = max(1, min(limit, 200))
    dsn = get_dsn()

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.id,
                       e.client_id,
                       e.month_start,
                       e.threshold_percent,
                       e.triggered_usage,
                       e.monthly_limit,
                       e.webhook_url,
                       e.retry_count,
                       c.name,
                       c.plan,
                       c.usage_webhook_secret
                FROM api_usage_alert_event e
                JOIN api_client c ON c.id = e.client_id
                WHERE e.delivery_status = 'failed'
                  AND e.next_retry_at IS NOT NULL
                  AND e.next_retry_at <= now()
                  AND e.retry_count < %s
                ORDER BY e.next_retry_at ASC
                LIMIT %s
                """,
                (max(int(settings.api_usage_webhook_max_retries), 1), limit),
            )
            rows = cur.fetchall()

    attempted = 0
    sent = 0
    failed = 0
    now_utc = datetime.now(timezone.utc)

    for row in rows:
        event_id = row[0]
        client_id = row[1]
        month_start = row[2]
        threshold_percent = int(row[3])
        triggered_usage = int(row[4])
        monthly_limit = int(row[5])
        webhook_url = row[6]
        retry_count = int(row[7])
        client_name = row[8]
        plan = row[9]
        webhook_secret = row[10]

        body = _build_usage_event_payload(
            event_id=event_id,
            occurred_at=now_utc,
            client_id=client_id,
            client_name=client_name,
            plan=plan,
            month_start=month_start,
            threshold_percent=threshold_percent,
            current_month_usage=triggered_usage,
            monthly_limit=monthly_limit,
        )
        signature = _build_signature(webhook_secret, body) if webhook_secret else None
        ok, http_status, response_body, error_message, duration_ms = _deliver_webhook(webhook_url, body, signature)

        _update_event_delivery(
            event_id=event_id,
            ok=ok,
            http_status=http_status,
            response_body=response_body,
            error_message=error_message,
            delivery_duration_ms=duration_ms,
            previous_retry_count=retry_count,
        )

        attempted += 1
        if ok:
            sent += 1
        else:
            failed += 1

    return {
        "attempted": attempted,
        "sent": sent,
        "failed": failed,
    }
