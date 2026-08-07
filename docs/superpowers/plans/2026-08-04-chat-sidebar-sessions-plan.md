# 聊天界面左侧历史会话菜单实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 React 聊天前端增加左侧历史会话菜单、新建会话按钮、URL 路由持久化，以及可替换的 mock API。

**Architecture:** 使用 `react-router-dom` 的 `createBrowserRouter` 配置 `/chat/new` 和 `/chat/:sessionId` 两条路由；新增 `useChatSessions` hook 统一维护会话列表、当前会话、各会话消息；新增 Sidebar/SessionList/ChatMainArea 组件拆分布局；mock API 层集中封装在 `src/api/chat.ts`，后续后端实现后可直接替换。

**Tech Stack:** React 19, TypeScript, Vite 8, TailwindCSS 4, Ant Design 6, react-router-dom, Vitest, React Testing Library, jsdom.

## Global Constraints

- 使用 `react-router-dom` 的 `createBrowserRouter` + `RouterProvider` 做路由配置。
- 历史会话列表数据来自 mock API，后续后端实现后只替换 `src/api/chat.ts` 内部实现。
- 点击历史会话只切换上下文，暂时不加载历史消息。
- 新建会话点击后切换到空页面；在该空会话发送第一条消息后，URL 变为 `/chat/:sessionId`，左侧列表出现新会话。
- 侧边栏第一期为固定宽度（约 260px），不做复杂折叠响应式。
- 不实现删除、重命名会话功能。
- 所有代码文件使用 TypeScript，类型必须完整。
- 每次任务完成后运行对应测试或验证命令，通过后再提交。

---

## 文件结构总览

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/utils/types.ts` | 修改 | 增加 `ChatSession` 类型 |
| `src/mocks/sessions.ts` | 创建 | mock 历史会话数据 |
| `src/api/chat.ts` | 创建 | mock API 封装 |
| `src/hooks/useChatSessions.ts` | 创建 | 核心 hook：会话列表、当前会话、消息、发送消息 |
| `src/hooks/useChatStream.ts` | 删除 | 被 `useChatSessions` 替代 |
| `src/components/Sidebar.tsx` | 创建 | 左侧边栏容器 |
| `src/components/SessionList.tsx` | 创建 | 历史会话列表 |
| `src/components/ChatMainArea.tsx` | 创建 | 右侧主聊天区 |
| `src/components/ChatPage.tsx` | 修改 | 读取 URL、组装布局、路由同步 |
| `src/App.tsx` | 修改 | 创建 router 配置 |
| `src/main.tsx` | 修改 | 使用 `RouterProvider` |
| `package.json` | 修改 | 增加 `react-router-dom`、`vitest` 等依赖与测试脚本 |
| `vitest.config.ts` | 创建 | Vitest + jsdom 配置 |
| `tests/hooks/useChatSessions.test.tsx` | 创建 | hook 核心逻辑测试 |
| `tests/components/SessionList.test.tsx` | 创建 | 历史列表渲染与点击测试 |

---

### Task 1: 安装路由依赖

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `react-router-dom` 作为运行时依赖，可在 `src/main.tsx` 和组件中使用。

- [ ] **Step 1: 安装 react-router-dom**

```bash
cd frontend
pnpm add react-router-dom
```

- [ ] **Step 2: 验证安装**

```bash
pnpm ls react-router-dom
```

Expected: 输出版本号，例如 `react-router-dom 6.x.x`。

- [ ] **Step 3: 提交**

```bash
git add package.json pnpm-lock.yaml
# 如有 node_modules 变更，不要提交 node_modules
git commit -m "chore: add react-router-dom dependency"
```

---

### Task 2: 增加 ChatSession 类型

**Files:**
- Modify: `frontend/src/utils/types.ts`

**Interfaces:**
- Produces: `ChatSession` interface，后续 Task 3/4/5/6 均依赖该类型。

- [ ] **Step 1: 修改类型文件**

将以下内容追加到 `frontend/src/utils/types.ts` 中 `Message` 类型之后：

```ts
export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend
pnpm exec tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/utils/types.ts
git commit -m "types: add ChatSession interface"
```

---

### Task 3: 创建 mock 数据与 API 层

**Files:**
- Create: `frontend/src/mocks/sessions.ts`
- Create: `frontend/src/api/chat.ts`

**Interfaces:**
- Consumes: `ChatSession` from `src/utils/types.ts`, `Message` from `src/utils/types.ts`.
- Produces: `fetchSessions`, `createSession`, `updateSessionTitle`, `fetchSessionMessages` 四个 mock API 函数。

- [ ] **Step 1: 创建 mock 数据文件**

创建 `frontend/src/mocks/sessions.ts`：

```ts
import { ChatSession } from "../utils/types";

export const mockSessions: ChatSession[] = [
  {
    id: "sess-1",
    title: "React Router 用法咨询",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "sess-2",
    title: "Tailwind 4 配置问题",
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    updatedAt: Date.now() - 1000 * 60 * 60 * 47,
  },
  {
    id: "sess-3",
    title: "SSE 流式解析设计",
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
    updatedAt: Date.now() - 1000 * 60 * 60 * 71,
  },
];
```

- [ ] **Step 2: 创建 mock API 文件**

创建 `frontend/src/api/chat.ts`：

```ts
import { ChatSession, Message } from "../utils/types";
import { mockSessions } from "../mocks/sessions";

export async function fetchSessions(): Promise<ChatSession[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve([...mockSessions]), 300);
  });
}

export async function createSession(title?: string): Promise<ChatSession> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const session: ChatSession = {
        id: `sess-${Date.now()}`,
        title: title || "新会话",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      resolve(session);
    }, 150);
  });
}

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
    setTimeout(() => resolve([]), 200);
  });
}
```

- [ ] **Step 3: 类型检查**

```bash
cd frontend
pnpm exec tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/mocks/sessions.ts frontend/src/api/chat.ts
git commit -m "feat: add mock chat API and session data"
```

---

### Task 4: 创建 useChatSessions 核心 hook

**Files:**
- Create: `frontend/src/hooks/useChatSessions.ts`
- Delete: `frontend/src/hooks/useChatStream.ts`

**Interfaces:**
- Consumes: `ChatSession`, `Message` from `src/utils/types.ts`; `parseChunk` from `src/utils/streamParser.ts`; `streamText` from `src/utils/streamFetch.ts`; `fetchSessions`, `createSession`, `updateSessionTitle` from `src/api/chat.ts`.
- Produces: `UseChatSessionsReturn` interface 及 `useChatSessions(urlSessionId?: string)` hook。

- [ ] **Step 1: 创建 useChatSessions.ts**

创建 `frontend/src/hooks/useChatSessions.ts`：

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatSession, Message } from "../utils/types";
import { parseChunk } from "../utils/streamParser";
import { streamText } from "../utils/streamFetch";
import {
  createSession as apiCreateSession,
  fetchSessions,
  updateSessionTitle,
} from "../api/chat";

const API_URL = "/chat/stream";

export interface UseChatSessionsReturn {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  createSession: () => Promise<string>;
  selectSession: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeTitle(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 20) return trimmed;
  return `${trimmed.slice(0, 20)}…`;
}

export function useChatSessions(
  urlSessionId?: string,
): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    urlSessionId ?? null,
  );
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const thinkRef = useRef("");
  const contentRef = useRef("");
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    if (urlSessionId) {
      setActiveSessionId(urlSessionId);
    }
  }, [urlSessionId]);

  useEffect(() => {
    let cancelled = false;
    fetchSessions().then((data) => {
      if (!cancelled) setSessions(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    setMessagesMap((prev) => {
      const msgs = prev[sessionId];
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
        [sessionId]: msgs.map((msg, index) =>
          index === lastIndex ? updatedLast : msg,
        ),
      };
    });
  }, []);

  const createSession = useCallback(async (): Promise<string> => {
    const session = await apiCreateSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessagesMap((prev) => ({ ...prev, [session.id]: [] }));
    return session.id;
  }, []);

  const selectSession = useCallback((id: string) => {
    stop();
    setActiveSessionId(id);
    setError(null);
  }, [stop]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setError(null);
      setLoading(true);
      setStreaming(true);
      setInput("");

      let currentSessionId = activeSessionId;
      let isNewSession = false;

      if (!currentSessionId) {
        currentSessionId = await createSession();
        isNewSession = true;
      }

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
        [currentSessionId!]: [
          ...(prev[currentSessionId!] ?? []),
          userMessage,
          assistantMessage,
        ],
      }));

      if (isNewSession) {
        const title = makeTitle(text);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId ? { ...s, title, updatedAt: Date.now() } : s,
          ),
        );
        await updateSessionTitle(currentSessionId, title);
      }

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
            setError("生成已停止");
          } else {
            setError(err.message || "请求失败");
          }
        } else {
          setError("请求失败");
        }
      } finally {
        setLoading(false);
        setStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [activeSessionId, createSession, flashMessage],
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    sessions,
    activeSessionId,
    messages: activeSessionId ? messagesMap[activeSessionId] ?? [] : [],
    input,
    setInput,
    loading,
    streaming,
    error,
    createSession,
    selectSession,
    sendMessage,
    stop,
  };
}
```

- [ ] **Step 2: 删除旧 hook**

```bash
rm frontend/src/hooks/useChatStream.ts
```

- [ ] **Step 3: 类型检查**

```bash
cd frontend
pnpm exec tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/hooks/useChatSessions.ts
git rm frontend/src/hooks/useChatStream.ts
git commit -m "feat: add useChatSessions hook to manage sessions and messages"
```

---

### Task 5: 创建 Sidebar 与 SessionList 组件

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/SessionList.tsx`

**Interfaces:**
- Consumes: `ChatSession` from `src/utils/types.ts`.
- Produces: `SidebarProps` 和 `SessionListProps` 组件接口；`Sidebar` 暴露 `onNewChat` 和 `onSelectSession` 事件。

- [ ] **Step 1: 创建 SessionList.tsx**

创建 `frontend/src/components/SessionList.tsx`：

```tsx
import { List, Typography } from "antd";
import { ChatSession } from "../utils/types";

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
}

export default function SessionList({
  sessions,
  activeSessionId,
  onSelect,
}: SessionListProps) {
  return (
    <List
      dataSource={sessions}
      renderItem={(session) => {
        const isActive = session.id === activeSessionId;
        return (
          <List.Item
            onClick={() => onSelect(session.id)}
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              borderRadius: "8px",
              margin: "4px 8px",
              backgroundColor: isActive ? "#1677ff" : "transparent",
              transition: "background-color 0.2s ease",
            }}
          >
            <Typography.Text
              ellipsis
              style={{
                color: isActive ? "#fff" : "rgba(255, 255, 255, 0.85)",
                width: "100%",
              }}
            >
              {session.title}
            </Typography.Text>
          </List.Item>
        );
      }}
      style={{
        flex: 1,
        overflowY: "auto",
      }}
    />
  );
}
```

- [ ] **Step 2: 创建 Sidebar.tsx**

创建 `frontend/src/components/Sidebar.tsx`：

```tsx
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ChatSession } from "../utils/types";
import SessionList from "./SessionList";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: 260,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#141414",
        borderRight: "1px solid #303030",
      }}
    >
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onNewChat}
        >
          新建会话
        </Button>
      </div>
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={onSelectSession}
      />
    </aside>
  );
}
```

- [ ] **Step 3: 类型检查**

```bash
cd frontend
pnpm exec tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/SessionList.tsx
git commit -m "feat: add Sidebar and SessionList components"
```

---

### Task 6: 创建 ChatMainArea 组件

**Files:**
- Create: `frontend/src/components/ChatMainArea.tsx`

**Interfaces:**
- Consumes: `Message` from `src/utils/types.ts`; `ChatInput` from `src/components/ChatInput.tsx`; `MessageList` from `src/components/MessageList.tsx`.
- Produces: `ChatMainAreaProps` 组件接口。

- [ ] **Step 1: 创建 ChatMainArea.tsx**

创建 `frontend/src/components/ChatMainArea.tsx`：

```tsx
import { Alert, Layout } from "antd";
import { Message } from "../utils/types";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";

const { Content } = Layout;

interface ChatMainAreaProps {
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
}

export default function ChatMainArea({
  messages,
  input,
  onInputChange,
  onSend,
  onStop,
  loading,
  streaming,
  error,
}: ChatMainAreaProps) {
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
          onChange={onInputChange}
          onSend={onSend}
          onStop={onStop}
          loading={loading}
          streaming={streaming}
        />
      </Content>
    </Layout>
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend
pnpm exec tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/ChatMainArea.tsx
git commit -m "feat: add ChatMainArea component"
```

---

### Task 7: 配置路由并重构 ChatPage

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/components/ChatPage.tsx`

**Interfaces:**
- Consumes: `useChatSessions` from `src/hooks/useChatSessions.ts`; `Sidebar` from `src/components/Sidebar.tsx`; `ChatMainArea` from `src/components/ChatMainArea.tsx`; `createBrowserRouter`, `RouterProvider`, `Navigate`, `useParams`, `useNavigate` from `react-router-dom`.

- [ ] **Step 1: 修改 App.tsx**

将 `frontend/src/App.tsx` 替换为：

```tsx
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import ChatPage from "./components/ChatPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/chat/new" replace />,
  },
  {
    path: "/chat/new",
    element: <ChatPage />,
  },
  {
    path: "/chat/:sessionId",
    element: <ChatPage />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
```

- [ ] **Step 2: 修改 main.tsx**

将 `frontend/src/main.tsx` 中的 `<App />` 替换为 `<RouterProvider>` 的引入和挂载：

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";
import App from "./App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <App />
    </ConfigProvider>
  </StrictMode>,
);
```

注意：`main.tsx` 只需要保持原样，因为 `App.tsx` 内部已经返回 `RouterProvider`。如果之前没有引入 `RouterProvider`，这里不需要额外修改。

- [ ] **Step 3: 修改 ChatPage.tsx**

将 `frontend/src/components/ChatPage.tsx` 替换为：

```tsx
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "antd";
import { useChatSessions } from "../hooks/useChatSessions";
import Sidebar from "./Sidebar";
import ChatMainArea from "./ChatMainArea";

const { Header } = Layout;

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    sessions,
    activeSessionId,
    messages,
    input,
    setInput,
    loading,
    streaming,
    error,
    createSession,
    selectSession,
    sendMessage,
    stop,
  } = useChatSessions(sessionId);

  useEffect(() => {
    if (activeSessionId && activeSessionId !== sessionId) {
      navigate(`/chat/${activeSessionId}`, { replace: true });
    }
  }, [activeSessionId, sessionId, navigate]);

  const handleNewChat = async () => {
    stop();
    navigate("/chat/new");
  };

  const handleSelectSession = (id: string) => {
    selectSession(id);
    navigate(`/chat/${id}`);
  };

  const handleSend = () => {
    sendMessage(input);
  };

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
      <Layout style={{ flex: 1, overflow: "hidden" }}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
        />
        <ChatMainArea
          messages={messages}
          input={input}
          onInputChange={setInput}
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

- [ ] **Step 4: 类型检查与构建验证**

```bash
cd frontend
pnpm exec tsc --noEmit
pnpm run build
```

Expected: TypeScript 无错误，Vite 构建成功。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx frontend/src/components/ChatPage.tsx
git commit -m "feat: wire up react-router and integrate useChatSessions with ChatPage"
```

---

### Task 8: 配置 Vitest 与自动化测试

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/tests/hooks/useChatSessions.test.tsx`
- Create: `frontend/tests/components/SessionList.test.tsx`

**Interfaces:**
- Consumes: `useChatSessions` from `src/hooks/useChatSessions.ts`; `SessionList` from `src/components/SessionList.tsx`.

- [ ] **Step 1: 安装测试依赖**

```bash
cd frontend
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: 添加测试脚本**

修改 `frontend/package.json` 的 `scripts` 部分：

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest"
}
```

- [ ] **Step 3: 创建 vitest 配置**

创建 `frontend/vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
  },
});
```

- [ ] **Step 4: 创建测试 setup 文件**

创建 `frontend/tests/setup.ts`：

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: 创建 useChatSessions 测试**

创建 `frontend/tests/hooks/useChatSessions.test.tsx`：

```tsx
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatSessions } from "../../src/hooks/useChatSessions";

describe("useChatSessions", () => {
  it("should load mock sessions on mount", async () => {
    const { result } = renderHook(() => useChatSessions());

    await waitFor(() => {
      expect(result.current.sessions.length).toBeGreaterThan(0);
    });
  });

  it("should create a new session", async () => {
    const { result } = renderHook(() => useChatSessions());

    await act(async () => {
      await result.current.createSession();
    });

    expect(result.current.activeSessionId).not.toBeNull();
    expect(result.current.sessions.length).toBeGreaterThan(0);
  });

  it("should switch active session", async () => {
    const { result } = renderHook(() => useChatSessions());

    await act(async () => {
      const id = await result.current.createSession();
      result.current.selectSession(id);
    });

    expect(result.current.activeSessionId).toBe(result.current.sessions[0].id);
  });
});
```

- [ ] **Step 6: 创建 SessionList 测试**

创建 `frontend/tests/components/SessionList.test.tsx`：

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionList from "../../src/components/SessionList";
import { ChatSession } from "../../src/utils/types";

const sessions: ChatSession[] = [
  { id: "s1", title: "会话一", createdAt: 1, updatedAt: 1 },
  { id: "s2", title: "会话二", createdAt: 2, updatedAt: 2 },
];

describe("SessionList", () => {
  it("renders session titles", () => {
    render(
      <SessionList
        sessions={sessions}
        activeSessionId={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("会话一")).toBeInTheDocument();
    expect(screen.getByText("会话二")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(
      <SessionList
        sessions={sessions}
        activeSessionId={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("会话二"));
    expect(onSelect).toHaveBeenCalledWith("s2");
  });
});
```

- [ ] **Step 7: 运行测试**

```bash
cd frontend
pnpm test -- --run
```

Expected: 所有测试通过。如果 `streamText` 导致测试网络请求失败，需要在 `tests/setup.ts` 中 mock `streamText` 或调整 hook 测试不触发发送消息。

- [ ] **Step 8: 提交**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/vitest.config.ts frontend/tests/
git commit -m "test: add vitest and tests for useChatSessions and SessionList"
```

---

### Task 9: 手动验证

**Files:** 无新增文件，仅运行验证。

**Interfaces:** 验证整个功能链路。

- [ ] **Step 1: 启动开发服务器**

```bash
cd frontend
pnpm dev
```

- [ ] **Step 2: 验证新建会话**

浏览器访问 `http://localhost:5173/`，应重定向到 `/chat/new`，左侧显示“新建会话”按钮和历史会话列表，右侧为 EmptyChat 空页面。

- [ ] **Step 3: 验证发送首条消息**

在空会话输入框中输入内容并发送，URL 应变更为 `/chat/:sessionId`，左侧历史列表顶部出现以首条消息前 20 字为标题的新会话。

- [ ] **Step 4: 验证切换会话**

点击左侧不同历史会话项，URL 变化，右侧显示对应会话的消息（mock 阶段若该会话无本地消息则显示空页面）。

- [ ] **Step 5: 验证刷新定位**

在 `/chat/:sessionId` 页面刷新，URL 保持不变，页面正确识别当前会话。

- [ ] **Step 6: 验证流式中断**

在助手正在流式回复时，点击另一个历史会话或新建会话，当前流应立即停止，新会话不受影响。

- [ ] **Step 7: 提交验证结果记录（可选）**

如验证通过，可执行：

```bash
git commit --allow-empty -m "verify: chat sidebar sessions feature passes manual checks"
```

---

## Self-Review

**1. Spec coverage:**
- 左侧菜单：Task 5 `Sidebar.tsx` + `SessionList.tsx` ✅
- 新建会话按钮：Task 5 中 `Sidebar` 的 `onNewChat`；Task 7 中 `handleNewChat` 跳转 `/chat/new` ✅
- 历史会话展示：Task 5 `SessionList` ✅
- URL 路由持久化：Task 1 安装依赖 + Task 7 配置 `createBrowserRouter` ✅
- Mock API：Task 3 `src/api/chat.ts` ✅
- 点击历史会话切换上下文不加载消息：Task 4 `useChatSessions` 仅切换 `activeSessionId`，不调用 `fetchSessionMessages` ✅
- 发送首条消息后新会话出现在列表：Task 4 `sendMessage` 在 `activeSessionId` 为空时创建 session 并更新 `sessions` ✅

**2. Placeholder scan:**
- 无 "TBD"/"TODO"、无模糊描述。所有代码块均给出完整实现。

**3. Type consistency:**
- `ChatSession` 类型在 Task 2 定义，Task 3/4/5/6/8 均一致使用。
- `useChatSessions` 返回的 `activeSessionId` 为 `string | null`，Task 5/7 组件props一致。
- `createSession` 返回 `Promise<string>`，Task 4 定义与 Task 7 使用一致。

**4. 已知风险与处理：**
- `useChatSessions` 的 `flashMessage` 在新建会话时可能因闭包捕获旧的 `activeSessionId` 而找不到消息。已通过在 hook 中使用 `activeSessionIdRef` 并在 `flashMessage` 中读取 ref 解决。
- 测试 `useChatSessions` 时若 `streamText` 发起真实请求会失败，当前测试用例未触发 `sendMessage`，因此不受影响。
