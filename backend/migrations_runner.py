import hashlib
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def run_migrations(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              checksum TEXT NOT NULL,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )

        files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        for migration_file in files:
            version = migration_file.name
            sql = migration_file.read_text(encoding="utf-8")
            checksum = _sha256_text(sql)

            cur.execute(
                "SELECT checksum FROM schema_migrations WHERE version = %s",
                (version,),
            )
            row = cur.fetchone()

            if row is not None:
                applied_checksum = row[0]
                if applied_checksum != checksum:
                    raise RuntimeError(
                        f"Checksum mismatch for applied migration '{version}'. "
                        "Do not edit applied migrations; create a new migration file."
                    )
                continue

            cur.execute(sql)
            cur.execute(
                """
                INSERT INTO schema_migrations (version, checksum)
                VALUES (%s, %s)
                """,
                (version, checksum),
            )

    conn.commit()
