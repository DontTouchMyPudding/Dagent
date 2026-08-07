from dotenv import load_dotenv
import os

load_dotenv()


class Config:
    DB_URI: str = os.getenv("DB_URI", "")
    COLLECTION_NAME: str = os.getenv("COLLECTION_NAME", "rag_documents")
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "")
    EMBEDDING_BASE_URL: str = os.getenv("EMBEDDING_BASE_URL", "")
    EMBEDDING_API_KEY: str = os.getenv("EMBEDDING_API_KEY", "")
    LLM_MODEL_NAME: str = os.getenv("LLM_MODEL_NAME", "gpt-4o")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    TAVILY_KEY: str = os.getenv("TAVILY_KEY", "")


config = Config()
