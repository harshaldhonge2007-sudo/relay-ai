from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "RELAY AI"
    app_version: str = "0.1.0"
    
    database_url: str = "postgresql://relay:relay@db:5432/relay"
    
    github_token: Optional[str] = None
    github_api_url: str = "https://api.github.com"
    
    llm_provider: str = "gemini"
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    
    llm_temperature: float = 0.0
    
    replay_mode: bool = False
    replay_cache_path: str = "/tmp/relay_replay_cache.json"
    
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    
    link_threshold: float = 0.7
    max_linking_confidence: float = 1.0
    
    max_interview_questions: int = 8
    risk_doc_coverage_weight: float = 0.6
    
    audit_enabled: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings():
    return Settings()
