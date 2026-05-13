import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
import psycopg

from config import settings
from db import get_dsn
from migrations_runner import run_migrations
from observability import write_api_request_log
from routers.api_product import router as api_product_router
from routers.ai_chat import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    dsn = get_dsn()
    retries = max(1, settings.db_connect_max_retries)
    delay = max(0.1, settings.db_connect_retry_delay_seconds)

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with psycopg.connect(dsn) as conn:
                run_migrations(conn)
            last_error = None
            break
        except psycopg.Error as exc:
            last_error = exc
            if attempt == retries:
                raise
            await asyncio.sleep(delay)

    if last_error is not None:
        raise last_error
    yield


app = FastAPI(
    title="Etholys API",
    description=(
        "Etholys API para chat IA e integrações empresariais. "
        "Inclui autenticação por API key e limites por plano."
    ),
    version="0.4.0",
    lifespan=lifespan,
)

app.include_router(ai_router)
app.include_router(api_product_router)

allowed_origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = ["*"]

has_wildcard_origin = "*" in allowed_origins
allow_credentials = settings.cors_allow_credentials and not has_wildcard_origin

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_and_audit(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()

    response = await call_next(request)

    duration_ms = int((time.perf_counter() - start) * 1000)
    response.headers["X-Request-ID"] = request_id

    client = getattr(request.state, "api_client", None)
    if client is not None:
        write_api_request_log(
            client_id=client.id,
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
        )

    return response

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


@app.get("/health/ready")
def health_ready():
    """Readiness check with dependency and critical config visibility."""
    dsn = get_dsn()
    db_ok = False
    db_error = None
    try:
        with psycopg.connect(dsn, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        db_ok = True
    except psycopg.Error as exc:
        db_error = str(exc)

    provider = (settings.ai_provider or "").strip().lower()
    ai_config_ok = (
        (provider == "gemini" and bool(settings.gemini_api_key))
        or (provider == "openai" and bool(settings.openai_api_key))
        or (provider == "ollama" and bool(settings.ollama_base_url) and bool(settings.ollama_model))
    )
    admin_ok = bool(settings.api_admin_token)

    ready = db_ok and ai_config_ok and admin_ok
    return {
        "status": "ready" if ready else "not-ready",
        "checks": {
            "database": {
                "ok": db_ok,
                "error": db_error,
            },
            "ai_provider": {
                "provider": provider,
                "ok": ai_config_ok,
                "gemini_key_configured": bool(settings.gemini_api_key),
                "openai_key_configured": bool(settings.openai_api_key),
                "ollama_configured": bool(settings.ollama_base_url and settings.ollama_model),
            },
            "api_admin": {
                "ok": admin_ok,
                "configured": admin_ok,
            },
        },
    }


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
