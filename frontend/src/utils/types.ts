export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type StreamChunkType = "think" | "value" | "error";

export interface StreamChunk {
  type: StreamChunkType;
  value: string;
}
