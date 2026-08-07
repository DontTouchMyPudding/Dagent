# Chat Hooks 职责拆分实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `useChatSessions` 拆分为 `useSessions` 与 `useChat`，并把 `input` 状态下沉到 `ChatMainArea`，消除输入框打字对 `Sidebar` 的渲染影响。

**Architecture:** 列表状态与会话消息状态分离，`ChatPage` 负责路由与会话创建的协调，`ChatMainArea` 自主管理输入框状态。

**Tech Stack:** React 18, TypeScript, TanStack Query, React Router, Ant Design, Vite

## Global Constraints

- 保持现有功能不变：新建会话、切换会话、发送消息、流式输出、停止。
- `src/api/chat.ts` 与 `src/utils/types.ts` 不得修改。
- `Sidebar` / `SessionList` 的 props 结构保持不变。
- TypeScript 编译必须通过。

---

## File Structure

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/hooks/useSessions.ts` | 创建 | 管理 sessions 列表、创建会话、选择会话 |
| `src/hooks/useChat.ts` | 创建 | 管理单会话消息、发送、流式输出、停止 |
| `src/hooks/useChatSessions.ts` | 删除 | 旧 hook，职责拆分后不再需要 |
| `src/components/ChatMainArea.tsx` | 修改 | 内部持有 `input` 状态，`onSend` 改为 `(text: string) => void` |
| `src/pages/ChatPage.tsx` | 修改 | 使用新 hooks，协调新建会话与发送 |

---

### Task 1: 创建 `useSessions` hook

**Files:**
- Create: `src/hooks/useSessions.ts`

**Interfaces:**
- Consumes: `fetchSessions`, `createSession` from `src/api/chat.ts`; `urlSessionId` from route.
- Produces: `UseSessionsReturn` interface; `useSessions` hook.

- [ ] **Step 1: 写入 `useSessions.ts` 完整代码**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatSession } from "../utils/types";
import { createSession as apiCreateSession, fetchSessions } from "../api/chat";

const SESSIONS_QUERY_KEY = ["chat", "sessions"] as const;

export interface UseSessionsReturn {
  sessions: ChatSession[];
  activeSessionId: string | null;
  selectSession: (id: string | null) => void;
  createSession: () => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

export interface UseSessionsOptions {
  urlSessionId?: string;
}

export function useSessions({
  urlSessionId,
}: UseSessionsOptions = {}): UseSessionsReturn {
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    urlSessionId ?? null,
  );

  const {
    data: sessions = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetchSessions();
      return response.data;
    },
    select: (data) => data.list,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiCreateSession();
      return response.data;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(
        SESSIONS_QUERY_KEY,
        (old: ChatSession[] = []) => [session, ...old],
      );
      setActiveSessionId(session.id);
    },
  });

  useEffect(() => {
    setActiveSessionId(urlSessionId ?? null);
  }, [urlSessionId]);

  const selectSession = useCallback((id: string | null) => {
    setActiveSessionId(id);
  }, []);

  const createSession = useCallback(async (): Promise<string> => {
    const session = await createSessionMutation.mutateAsync();
    return session.id;
  }, [createSessionMutation]);

  const error = useMemo(() => {
    if (queryError instanceof Error) return queryError.message;
    if (createSessionMutation.error instanceof Error)
      return createSessionMutation.error.message;
    return null;
  }, [queryError, createSessionMutation.error]);

  return {
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    isLoading,
    error,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/hooks/useSessions.ts
git commit -m "feat: add useSessions hook for session list management"
```

---

### Task 2: 创建 `useChat` hook

**Files:**
- Create: `src/hooks/useChat.ts`

**Interfaces:**
- Consumes: `streamText` from `src/utils/streamFetch.ts`; `parseChunk` from `src/utils/streamParser.ts`; `updateSessionTitle` from `src/api/chat.ts`.
- Produces: `UseChatReturn` interface; `useChat` hook.

- [ ] **Step 1: 写入 `useChat.ts` 完整代码**

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Message } from "../utils/types";
import { parseChunk } from "../utils/streamParser";
import { streamText } from "../utils/streamFetch";
import { updateSessionTitle as apiUpdateSessionTitle } from "../api/chat";

const API_URL = "/api/chat/stream";

export interface UseChatReturn {
  messages: Message[];
  sendMessage: (text: string, sessionId: string) => Promise<void>;
  stop: () => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(sessionId: string | null): UseChatReturn {
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  const thinkRef = useRef("");
  const contentRef = useRef("");
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const updateSessionTitleMutation = useMutation({
    mutationFn: (variables: { sessionId: string; title: string }) =>
      apiUpdateSessionTitle(variables.sessionId, variables.title),
  });

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStreaming(false);
    setLoading(false);
  }, []);

  const flashMessage = useCallback(() => {
    pendingRef.current = null;
    const thinking = thinkRef.current;
    const content = contentRef.current;
    thinkRef.current = "";
    contentRef.current = "";
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;
    setMessagesMap((prev) => {
      const msgs = prev[currentSessionId];
      if (!msgs) return prev;
      const lastIndex = msgs.length - 1;
      const last = msgs[lastIndex];
      if (!last || last.role !== "assistant") return prev;
      const updatedLast: Message = {
        ...last,
        content: last.content + content,
        thinking: (last.thinking ?? "") + thinking,
      };
      return {
        ...prev,
        [currentSessionId]: msgs.map((msg, index) =>
          index === lastIndex ? updatedLast : msg,
        ),
      };
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string, targetSessionId: string) => {
      if (!text.trim()) return;
      if (!targetSessionId) {
        setStreamError("未选择会话");
        return;
      }

      setStreamError(null);
      setLoading(true);
      setStreaming(true);

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: text,
      };

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
      };

      setMessagesMap((prev) => ({
        ...prev,
        [targetSessionId]: [
          ...(prev[targetSessionId] ?? []),
          userMessage,
          assistantMessage,
        ],
      }));

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await streamText({
          url: API_URL,
          body: { message: text },
          onChunk: (chunk) => {
            chunk?.split("\n\n").forEach((line) => {
              const parsed = parseChunk(line);
              if (parsed.type === "think") {
                thinkRef.current += parsed.value;
              } else if (parsed.type === "value") {
                contentRef.current += parsed.value;
              }
              if (pendingRef.current === null) {
                pendingRef.current = requestAnimationFrame(flashMessage);
              }
            });
          },
          signal: abortController.signal,
        });
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            setStreamError("生成已停止");
          } else {
            setStreamError(err.message || "请求失败");
          }
        } else {
          setStreamError("请求失败");
        }
      } finally {
        setLoading(false);
        setStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [flashMessage, updateSessionTitleMutation],
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const error = useMemo(() => {
    if (streamError) return streamError;
    if (updateSessionTitleMutation.error instanceof Error)
      return updateSessionTitleMutation.error.message;
    return null;
  }, [streamError, updateSessionTitleMutation.error]);

  return {
    messages: sessionId ? (messagesMap[sessionId] ?? []) : [],
    sendMessage,
    stop,
    loading,
    streaming,
    error,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/hooks/useChat.ts
git commit -m "feat: add useChat hook for single-session messaging"
```

---

### Task 3: 修改 `ChatMainArea` 持有 `input` 状态

**Files:**
- Modify: `src/components/ChatMainArea.tsx`

**Interfaces:**
- Consumes: `messages`, `onSend(text: string)`, `onStop`, `loading`, `streaming`, `error`.
- Produces: `ChatMainArea` 组件，`onSend` 签名改为 `(text: string) => void`。

- [ ] **Step 1: 修改 `ChatMainArea.tsx` 完整代码**

```tsx
import { useState } from "react";
import { Alert, Layout } from "antd";
import { Message } from "../utils/types";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";

const { Content } = Layout;

interface ChatMainAreaProps {
  messages: Message[];
  onSend: (text: string) => void;
  onStop: () => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
}

export default function ChatMainArea({
  messages,
  onSend,
  onStop,
  loading,
  streaming,
  error,
}: ChatMainAreaProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input);
    setInput("");
  };

  return (
    <Layout style={{ flex: 1, backgroundColor: "#0f1115" }}>
      <Content
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {error && (
          <Alert
            message={error}
            type="error"
            closable
            showIcon
            style={{ margin: "16px 24px 0" }}
          />
        )}
        <MessageList messages={messages} streaming={streaming} />
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={onStop}
          loading={loading}
          streaming={streaming}
        />
      </Content>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/ChatMainArea.tsx
git commit -m "refactor: move input state into ChatMainArea"
```

---

### Task 4: 修改 `ChatPage` 使用新 hooks 并协调新建会话

**Files:**
- Modify: `src/pages/ChatPage.tsx`
- Delete: `src/hooks/useChatSessions.ts`

**Interfaces:**
- Consumes: `useSessions`, `useChat`。
- Produces: 更新后的 `ChatPage` 组件。

- [ ] **Step 1: 修改 `ChatPage.tsx` 完整代码**

```tsx
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "antd";
import { useSessions } from "../hooks/useSessions";
import { useChat } from "../hooks/useChat";
import Sidebar from "../components/Sidebar";
import ChatMainArea from "../components/ChatMainArea";

const { Header } = Layout;

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    loading: sessionsLoading,
    error: sessionsError,
  } = useSessions({ urlSessionId: sessionId });

  const {
    messages,
    sendMessage,
    stop,
    loading: chatLoading,
    streaming,
    error: chatError,
  } = useChat(activeSessionId);

  const handleNewChat = useCallback(() => {
    stop();
    selectSession(null);
    navigate("/chat");
  }, [navigate, selectSession, stop]);

  const handleSelectSession = useCallback(
    (id: string) => {
      selectSession(id);
      navigate(`/chat/${id}`);
    },
    [navigate, selectSession],
  );

  const handleSend = useCallback(
    async (text: string) => {
      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        targetSessionId = await createSession();
        navigate(`/chat/${targetSessionId}`, { replace: true });
      }
      await sendMessage(text, targetSessionId);
    },
    [activeSessionId, createSession, navigate, sendMessage],
  );

  const loading = sessionsLoading || chatLoading;
  const error = sessionsError ?? chatError;

  return (
    <Layout style={{ height: "100vh", backgroundColor: "#0f1115" }}>
      <Header
        style={{
          backgroundColor: "#141414",
          borderBottom: "1px solid #303030",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
          AI 助手
        </span>
      </Header>
      <Layout hasSider style={{ flex: 1, overflow: "hidden" }}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
        />
        <ChatMainArea
          messages={messages}
          onSend={handleSend}
          onStop={stop}
          loading={loading}
          streaming={streaming}
          error={error}
        />
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 删除旧的 `useChatSessions.ts`**

```bash
rm src/hooks/useChatSessions.ts
git rm src/hooks/useChatSessions.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/pages/ChatPage.tsx src/hooks/useChatSessions.ts
git commit -m "refactor: split useChatSessions into useSessions and useChat"
```

---

### Task 5: 编译与手动验证

**Files:**
- 全局检查

- [ ] **Step 1: 运行 TypeScript 编译**

```bash
pnpm tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 2: 启动开发服务器并手动验证**

```bash
pnpm dev
```

验证项：
1. 在输入框输入文字，打开 DevTools 观察 `Sidebar` / `SessionList` 的 `console.log` 不再每次输入都打印。
2. 在 `/chat` 空会话页输入文字点击发送，能自动创建会话并跳转。
3. 切换会话正常。
4. 流式输出与停止按钮正常。
5. 新建会话按钮正常。

- [ ] **Step 3: 提交（如仅验证无代码改动可跳过）**

---

## Self-Review

1. **Spec coverage:** 所有设计要点均已覆盖：hook 拆分、`input` 下沉、`ChatPage` 协调、边界情况。
2. **Placeholder scan:** 无 TBD/TODO/"稍后实现" 等占位符。
3. **Type consistency:** `onSend` 在 `ChatMainAreaProps` 和 `ChatPage` 中均为 `(text: string) => void`；`useChat.sendMessage` 接收 `(text: string, sessionId: string)`，与 `ChatPage.handleSend` 调用一致。

## Notes

- `useChat` 中保留了 `updateSessionTitleMutation` 但未在 `sendMessage` 中调用，与原代码保持一致，避免引入额外行为变更。
