from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    LLM_MODEL_NAME: str
    LLM_BASE_URL: str
    LLM_API_KEY: str

    class Config:
        env_file = ".env"
        extra = "ignore"
