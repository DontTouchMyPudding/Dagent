from typing import Literal

from langchain_core.tools import tool

from src.agent.core.llm import get_embeddings
from src.agent.rag.retrieval.retriever import retrieve_query
from src.agent.core.config import config
from tavily import TavilyClient

embeddings = get_embeddings()
tavily_client = TavilyClient(config.TAVILY_KEY)


@tool
def retrieve_tool(
        query: str,
        top_k: int = 5,
):
    """
从本地知识库中检索与查询相关的文档片段。

【适用场景】
- 用户询问与已入库文档相关的专业知识、内部资料
- 需要基于私有数据回答问题时
- 优先于网络搜索使用，除非知识库无结果

【不适用场景】
- 实时信息、最新动态（使用 web_search 替代）
- 知识库中明确没有收录的通用常识

【参数建议】
- query: 提炼用户问题的核心语义，而非直接复制原句。例如用户问"怎么申请报销"，query 填"报销流程"
- top_k: 问题简单用 3，需要多角度参考时用 5-8

【返回格式】
每条结果包含来源文件路径和正文内容，无结果时返回提示信息
"""
    try:
        result = retrieve_query(query, embeddings, config.DB_URI, config.COLLECTION_NAME, top_k=top_k)

        if not result:
            return "没有相关知识"

        outputs = []
        for i, doc in enumerate(result, 1):
            source = doc.metadata.get("path", "未知来源") if doc.metadata else "未知来源"
            outputs.append(f'[文档{i}](来源: {source})\n{doc.page_content}')

        return "\n\n".join(outputs)

    except Exception as e:
        return f"知识库检索失败: {str(e)}"


@tool
def web_search_by_tavily(
        keyword: str,
        search_depth: Literal["basic", "advanced"] = "basic",
        max_results: int = 5,
        include_answer: bool = False,
):
    """
通过 Tavily 搜索引擎检索互联网上的公开信息。

【适用场景】
- 需要实时或最新信息（新闻、价格、近期事件等）
- 知识库检索无结果后的兜底
- 用户明确要求搜索网络

【不适用场景】
- 私有/内部知识（使用 retrieve_tool 替代）
- 简单常识问题，无需联网

【参数建议】
- keyword: 使用简洁的搜索词，而非完整句子。例如"Python asyncio 教程"而非"请问 Python 的 asyncio 怎么用"
- search_depth: 优先用 "basic"；若结果质量差或话题复杂再用 "advanced"
- include_answer: 若用户需要快速结论可设为 True，需要原始来源设为 False
- max_results: 一般问题用 3-5，需要多方印证时用 5-8

【返回格式】
每条结果包含标题、URL 和内容摘要；include_answer=True 时附带 AI 摘要
"""
    try:
        response = tavily_client.search(
            query=keyword,
            search_depth=search_depth,
            max_results=max_results,
            include_answer=include_answer,
        )

        if not response.get("results"):
            return "未找到相关结果"

        results = []
        for i, r in enumerate(response["results"][:max_results], 1):
            results.append(f'[{i}] {r["title"]}\nURL: {r["url"]}\n{r["content"]}')

        answer = f'\n\nAI 摘要: {response["answer"]}' if include_answer and response.get("answer") else ""

        return "\n\n".join(results) + answer

    except Exception as e:
        return f"搜索失败: {str(e)}"
