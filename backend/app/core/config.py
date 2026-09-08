import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema de Liquidación de Empresas de Transporte"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_jwt_key_transporte_rengifo_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "admin_transporte")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "transporte_seguro_2026")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "db_transporte_liquidacion")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5455")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        case_sensitive = True

settings = Settings()
