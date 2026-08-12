export type MessageRole = "user" | "assistant";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  output: string;
  success?: boolean;
  error?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type StreamChunkType =
  | "token"
  | "tool_call"
  | "tool_result"
  | "think"
  | "value"
  | "error";

export interface StreamChunk {
  type: StreamChunkType;
  value: string | ToolCall | ToolResult;
}
