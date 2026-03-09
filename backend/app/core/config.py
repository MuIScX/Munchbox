from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_HOURS: int = 744

    class Config:
        env_file = Path(__file__).resolve().parent.parent / ".env"


settings = Settings()
