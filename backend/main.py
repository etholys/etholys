from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
import psycopg

from config import settings
from db import get_dsn
from routers.ai_chat import router as ai_router
from schema_ai import ensure_ai_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        ensure_ai_tables(conn)
    yield


app = FastAPI(
    title="Etholys API",
    description="Backend FastAPI — substituição do Abacus (IA grava no PostgreSQL)",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(ai_router)

STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/ui", include_in_schema=False)
def chat_ui():
    """Página simples para conversar com a IA (mensagens vão para o banco)."""
    path = STATIC_DIR / "chat.html"
    if not path.is_file():
        return RedirectResponse(url="/docs")
    return FileResponse(path)


@app.get("/health")
def health():
    return {"status": "ok", "service": "etholys-api"}


@app.get("/health/db")
def health_db():
    dsn = get_dsn()
    with psycopg.connect(dsn, connect_timeout=5) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    return {"status": "ok", "database": "reachable"}


@app.get("/health/ai", tags=["IA"])
async def health_ai():
    """Indica qual provedor de IA está configurado (sem gastar tokens)."""
    return {
        "provider": settings.ai_provider,
        "gemini_model": settings.gemini_model,
        "gemini_configured": bool(settings.gemini_api_key),
        "ollama_base_url": settings.ollama_base_url,
        "ollama_model": settings.ollama_model,
        "openai_model": settings.openai_model,
        "openai_configured": bool(settings.openai_api_key),
    }
