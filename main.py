import logging

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

from src.agent.chat.chat import chat
from src.agent.core.config import config
from src.agent.core.llm import get_embeddings
from src.agent.rag.retrieval.retriever import retrieve_query
from src.agent.rag.storage.vectorstore import embedding_data

logging.basicConfig(level=logging.ERROR)
load_dotenv()
history = []

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="RAG Agent")
    parser.add_argument("--mode", choices=["ingest", "retrieve"])
    parser.add_argument("--path", help="文件路径（ingest模式）")
    parser.add_argument("--user-id", default="default", help="用户ID")
    parser.add_argument("--query", help="查询内容（retrieve模式）")
    parser.add_argument("--top-k", type=int, default=10, help="返回数量")
    args = parser.parse_args()

    embeddings = get_embeddings()

    if args.mode == "ingest":
        if not args.path:
            parser.error("--path required for ingest mode")
        embedding_data(args.path, embeddings, args.user_id, config.DB_URI, config.COLLECTION_NAME)
        print(f"Ingested: {args.path}")

    elif args.mode == "retrieve":
        query = args.query
        top_k = args.top_k
        print(config.COLLECTION_NAME)
        result = retrieve_query(query, embeddings, config.DB_URI, config.COLLECTION_NAME, top_k=top_k)
        print(result)

    else:
        while True:
            user_input = input("输入问题")  # 业务编码关联数据的缺失以及数据格式的不规范
            if user_input == "exit":
                print(history)
                break
            history.append(HumanMessage(content=user_input))
            response = chat(history)
            history.append(response)
