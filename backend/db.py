import os

from config import settings


def get_dsn() -> str:
    dsn = os.environ.get("DATABASE_URL") or str(settings.database_url)
    if "?" in dsn:
        dsn = dsn.split("?", 1)[0]
    return dsn
