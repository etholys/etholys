from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://etholys:etholys_dev_change_me@localhost:5433/etholys"

    # gemini | ollama | openai
    ai_provider: str = "gemini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"

    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    ai_system_prompt: str = (
        "You are a helpful assistant for Etholys business and project data. "
        "Answer concisely in the same language as the user."
    )

    # Productization / API sales
    api_admin_token: str | None = None
    api_default_rpm_limit: int = 60
    api_request_log_retention_days: int = 90
    api_key_expiry_warning_days: int = 14
    api_usage_alert_thresholds: str = "80,90,100"
    api_usage_webhook_timeout_seconds: float = 3.0
    api_usage_webhook_retry_base_minutes: int = 1
    api_usage_webhook_max_retries: int = 5
    api_usage_webhook_auto_retry_per_request: int = 2
    api_usage_webhook_slo_threshold_ms: int = 2000

    # Runtime / portability
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_allow_origins: str = "*"
    cors_allow_credentials: bool = False
    db_connect_max_retries: int = 20
    db_connect_retry_delay_seconds: float = 1.5


settings = Settings()
