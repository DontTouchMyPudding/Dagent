from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from src.agent.core.config import config


def get_embeddings():
    return OpenAIEmbeddings(
        model=config.EMBEDDING_MODEL_NAME,
        base_url=config.EMBEDDING_BASE_URL,
        api_key=config.EMBEDDING_API_KEY,
    )


def create_llm(model: str = None, temperature: float = 0.7):
    return ChatOpenAI(
        model=model or config.LLM_MODEL_NAME,
        base_url=config.LLM_BASE_URL,
        api_key=config.LLM_API_KEY,
        temperature=temperature,
        streaming=True,
        extra_body={"thinking": {"type": "disabled"}}
    )