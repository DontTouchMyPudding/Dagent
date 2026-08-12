import { StreamChunk } from "./types";

/**
 * 解析后端 Agent 流式返回的 SSE 事件。
 * 事件格式：
 *   id: <id>
 *   event: token|error
 *   data: {"type": "token|tool_call|tool_result|warning", "data": ...}
 *
 * 返回 { type, value }，业务层负责拼接。
 */
export function parseChunk(chunk: string): StreamChunk {
  const raw = chunk.trim();

  if (!raw || raw === "data: [DONE]") {
    return { type: "value", value: "" };
  }

  const lines = raw.split("\n");
  let eventName = "";
  let dataLine = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLine = line.slice(5).trim();
    }
  }

  if (eventName === "error") {
    return { type: "error", value: dataLine };
  }

  if (!dataLine || dataLine === "[DONE]") {
    return { type: "value", value: "" };
  }

  try {
    const payload = JSON.parse(dataLine);
    const type = payload?.type;
    const data = payload?.data;

    if (type === "token") {
      return { type: "token", value: String(data ?? "") };
    }

    if (type === "tool_call") {
      return {
        type: "tool_call",
        value: {
          id: String(data?.id ?? ""),
          name: String(data?.name ?? ""),
          args: data?.args ?? {},
        },
      };
    }

    if (type === "tool_result") {
      return {
        type: "tool_result",
        value: {
          name: String(data?.name ?? ""),
          output: String(data?.output ?? ""),
          success: data?.success,
          error: data?.error,
        },
      };
    }

    if (type === "warning" || type === "error") {
      return { type: "error", value: String(data ?? "") };
    }

    // 兼容旧的 OpenAI chat.completion.chunk 格式
    const delta = payload?.choices?.[0]?.delta;
    if (delta) {
      if (delta.reasoning_content) {
        return { type: "think", value: String(delta.reasoning_content) };
      }
      if (delta.content) {
        return { type: "value", value: String(delta.content) };
      }
    }

    return { type: "value", value: "" };
  } catch {
    return { type: "value", value: "" };
  }
}
