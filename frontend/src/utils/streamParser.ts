import { StreamChunk } from "./types";

/**
 * 解析 OpenAI 兼容的 chat.completion.chunk。
 * 支持 SSE 包装（data: {...}）或纯 JSON 字符串。
 * 返回 { type, value }，业务层负责拼接。
 */
export function parseChunk(chunk: string): StreamChunk {
  const line = chunk.trim();

  if (!line || line === "data: [DONE]") {
    return { type: "value", value: "" };
  }
  const parsed = line.split("\n");
  const [_, __, data] = parsed;
  const json = data ? data.slice(5).trim() : "{}";

  try {
    const data = JSON.parse(JSON.parse(json));
    const delta = data?.choices?.[0]?.delta;

    if (!delta) {
      return { type: "value", value: "" };
    }

    if (delta.reasoning_content) {
      return { type: "think", value: String(delta.reasoning_content) };
    }

    if (delta.content) {
      return { type: "value", value: String(delta.content) };
    }
    return { type: "value", value: "" };
  } catch {
    return { type: "value", value: "" };
  }
}
