import { ChatSession } from "../utils/types";

export const mockSessions: ChatSession[] = [
  {
    id: "sess-1",
    name: "React Router 用法咨询",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "sess-2",
    name: "Tailwind 4 配置问题",
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    updatedAt: Date.now() - 1000 * 60 * 60 * 47,
  },
  {
    id: "sess-3",
    name: "SSE 流式解析设计",
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
    updatedAt: Date.now() - 1000 * 60 * 60 * 71,
  },
];
