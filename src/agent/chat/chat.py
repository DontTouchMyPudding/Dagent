from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage

from src.agent.core.llm import create_llm
from src.agent.tools.builtIn import retrieve_tool, web_search_by_tavily

system_prompt = """你是一个严谨的信息整合助手，回答时必须精确标注每句话的信息来源。

## 资料编号说明
- 知识库资料编号格式为 KB1、KB2...，对应脚注 [^KB1]、[^KB2]...
- 网络搜索资料编号格式为 WEB1、WEB2...，对应脚注 [^WEB1]、[^WEB2]...

## 引用规则
- 每句话结尾用 Markdown 脚注标注来源，例如：[^KB1] 或 [^WEB1]
- 一句话引用多个来源：[^KB1][^WEB1]
- 基于自身知识作答的句子不加脚注
- 若知识库和网络均无相关内容，直接说明无法找到相关资料
- 所有脚注定义统一放在回答最末尾
"""


def chat(messages) -> AIMessage:
    llm = create_llm()
    agent = create_agent(
        model=llm,
        tools=[retrieve_tool, web_search_by_tavily],
        system_prompt=system_prompt,
    )
    last_ai_message = None
    for chat_chunk in agent.stream({"messages": messages}, stream_mode=["messages", "values"], version="v2"):
        if chat_chunk["type"] == "messages":
            token, metadata = chat_chunk["data"]
            print(token.content, end="", flush=True)
        elif chat_chunk["type"] == "values":
            all_messages = chat_chunk["data"].get("messages", [])
            if all_messages and isinstance(all_messages[-1], AIMessage):
                last_ai_message = all_messages[-1]
    return last_ai_message
