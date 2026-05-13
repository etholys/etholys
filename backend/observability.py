import uuid
from datetime import datetime, timedelta, timezone

import psycopg

from db import get_dsn


def write_api_request_log(
    *,
    client_id: uuid.UUID | None,
    request_id: str,
    method: str,
    path: str,
    status_code: int,
    duration_ms: int,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api_request_log (
                    client_id,
                    request_id,
                    method,
                    path,
                    status_code,
                    duration_ms,
                    ip_address,
                    user_agent
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(client_id) if client_id else None,
                    request_id,
                    method,
                    path,
                    status_code,
                    max(duration_ms, 0),
                    ip_address,
                    user_agent,
                ),
            )
        conn.commit()


def purge_old_request_logs(older_than_days: int) -> int:
    days = max(1, min(older_than_days, 3650))
    threshold = datetime.now(timezone.utc) - timedelta(days=days)

    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM api_request_log
                WHERE created_at < %s
                """,
                (threshold,),
            )
            deleted = cur.rowcount
        conn.commit()

    return int(deleted)
