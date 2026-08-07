from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings


def retrieve_query(query: str, embeddings: Embeddings, db_uri: str, collection_name: str = "rag_documents", top_k: int = 10) -> list[Document]:
    store = Chroma(persist_directory=db_uri, embedding_function=embeddings, collection_name=collection_name)
    results = store.similarity_search(query, k=top_k)
    return results
