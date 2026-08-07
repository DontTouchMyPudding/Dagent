import { ChatSession, Message } from "../utils/types";
import { ApiResponse, get, post } from "../utils/request";

export async function fetchSessions(): Promise<
  ApiResponse<{ total: number; list: ChatSession[] }>
> {
  return get("/chat/list");
}

export async function createSession(): Promise<ApiResponse<ChatSession>> {
  return post("/chat/create");
}

export const stopChat = async (task_id: string) => post(`/chat/stop/${task_id}`);

export async function updateSessionTitle(
  sessionId: string,
  title: string,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("[mock] update session title", sessionId, title);
      resolve();
    }, 100);
  });
}

export async function fetchSessionMessages(
  sessionId: string,
): Promise<Message[]> {
  return new Promise((resolve) => {
    console.log("[mock] fetch messages for", sessionId);
    setTimeout(() => resolve([]), 200);
  });
}
