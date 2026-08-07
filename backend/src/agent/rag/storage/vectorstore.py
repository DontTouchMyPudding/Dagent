from pathlib import Path
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings
from src.agent.rag.ingestion.loader import Loader
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from src.agent.common.utils import chunk_add_metadata
import logging

logger = logging.getLogger(__name__)


def embedding_data(path: str, embeddings: Embeddings, user_id: str, db_uri: str,
                   collection_name: str = "rag_documents"):
    markdown = Loader(path).load()
    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[
            ("#", "h1"), ("##", "h2"), ("###", "h3"),
            ("####", "h4"), ("#####", "h5"), ("######", "h6")
        ],
        strip_headers=False,
    )
    md_header_chunks = md_splitter.split_text(markdown)
    character_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500, chunk_overlap=100,
        separators=["\n\n", "\n", "。", "？", " ", ""]
    )
    chunks = character_splitter.split_documents(md_header_chunks)

    root_path = Path(path).parent
    file_name = Path(path).name

    documents = list(map(
        lambda chunk: chunk_add_metadata(chunk, {"path": str(root_path / file_name), "user_id": user_id}),
        chunks
    ))
    Chroma.from_documents(documents, embeddings, collection_name=collection_name, persist_directory=db_uri)
    logger.info(f"Embedded {len(documents)} chunks from {path}")