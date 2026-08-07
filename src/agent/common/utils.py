from langchain_core.documents import Document


def chunk_add_metadata(chunk: Document, metadata: dict) -> Document:
    return Document(chunk.page_content, metadata={**chunk.metadata, **metadata})
