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


settings = Settings()
