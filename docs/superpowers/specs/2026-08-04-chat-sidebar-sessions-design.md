# 聊天界面左侧历史会话菜单设计文档

## 背景

当前前端聊天界面为单栏全屏布局：顶部标题、消息列表、输入框。没有会话管理能力，刷新后无法定位到特定会话。

## 目标

为聊天界面增加左侧边栏，提供：

1. **新建会话按钮**：点击后切换到空页面。
2. **历史会话列表**：展示已有会话，点击可切换会话上下文。
3. **URL 路由持久化**：通过 `createBrowserRouter` 配置路由，刷新页面后仍能定位到对应 session。
4. **Mock API**：前端先使用 mock 数据模拟后端接口，后续后端实现后可直接替换。

## 非目标

- 不实现历史消息的真实加载（点击历史会话后只切换上下文，消息暂时为空）。
- 不实现删除、重命名会话功能（后续可扩展）。
- 不做复杂的响应式折叠侧边栏（第一期保持固定宽度）。

## 路由设计

使用 `react-router-dom` 的 `createBrowserRouter` 以对象数组形式声明路由：

```tsx
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
```

`main.tsx` 中使用 `RouterProvider` 挂载路由。

## 数据模型

```ts
// src/utils/types.ts
export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// Message 类型保持现有定义不变
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
}
```

## 组件结构

```
App.tsx
└── RouterProvider
    └── ChatPage.tsx
        ├── Sidebar.tsx
        │   └── SessionList.tsx
        └── ChatMainArea.tsx
            ├── Header
            ├── MessageList.tsx
            └── ChatInput.tsx
```

### 各组件职责

- **ChatPage**：读取 URL 中的 `sessionId`，组装 Sidebar 和 ChatMainArea，管理整体布局。
- **Sidebar**：左侧边栏容器，包含新建按钮和历史列表。
- **SessionList**：渲染历史会话列表，高亮当前选中项，处理点击事件。
- **ChatMainArea**：右侧主聊天区，展示消息列表和输入框。
- **MessageList / MessageBubble / ChatInput / EmptyChat**：基本保持现有逻辑，消息来源改为按 session 维护。

## 状态管理

新增核心 hook：`src/hooks/useChatSessions.ts`。

内部状态：

```ts
const [sessions, setSessions] = useState<ChatSession[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
const [loading, setLoading] = useState(false);
const [streaming, setStreaming] = useState(false);
const [error, setError] = useState<string | null>(null);
const [input, setInput] = useState("");
```

对外暴露：

```ts
interface UseChatSessionsReturn {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Message[];
  loading: boolean;
  streaming: boolean;
  error: string | null;
  input: string;
  setInput: (v: string) => void;
  createSession: () => string;
  selectSession: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
}
```

## 数据流

1. 页面加载时，`useChatSessions` 调用 mock API 拉取历史会话列表。
2. `ChatPage` 从 URL 读取 `sessionId` 并传给 hook，hook 设置 `activeSessionId`。
3. 对于已有会话，若本地没有消息，则显示空页面（不加载历史消息）。
4. 在 `/chat/new` 发送第一条消息时：
   - 创建新 session，生成 `sessionId`。
   - 调用 `navigate(`/chat/${newId}`)` 更新 URL。
   - 将用户消息和助手消息写入 `messagesMap[newId]`。
   - 流式响应过程中实时更新该 session 的消息。
   - 用首条用户消息的前 20 字更新 session title，并插入 `sessions` 列表。
5. 点击 Sidebar 中的历史项：调用 `selectSession(id)`，内部 `navigate(`/chat/${id}`)`。
6. 切换会话前，若当前正在流式输出，先调用 `stop()` 中断。

## Mock API

新增 `src/api/chat.ts`：

```ts
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
  title: string
): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

export async function fetchSessionMessages(sessionId: string): Promise<Message[]> {
  // 当前阶段返回空数组，后续后端实现后替换
  return new Promise((resolve) => setTimeout(() => resolve([]), 200));
}
```

真实后端接入时，只需替换函数内部实现。

## 错误处理

- **无效 `sessionId`**：访问不存在的 session 时显示空页面，不报错。
- **发送消息失败**：顶部 `Alert` 展示错误信息。
- **切换会话时正在流式输出**：先中断当前请求，再切换。
- **首条消息生成 title**：超过 20 字截断并加 “…”。

## 依赖变更

需要新增依赖：

```bash
pnpm add react-router-dom
pnpm add -D @types/react-router-dom
```

> 注：`react-router-dom` v7 中类型已内置，可视实际版本决定是否需要 `@types/react-router-dom`。

## 测试策略

手动验证：

1. 点击“新建会话”，URL 变为 `/chat/new`，右侧为空页面。
2. 发送第一条消息，URL 变为 `/chat/:sessionId`，左侧列表出现新会话。
3. 点击不同历史项，URL 变化，右侧显示对应会话消息。
4. 在 `/chat/:sessionId` 刷新，页面保持当前会话。
5. 流式输出时切换会话，流立即中断。

单元测试（可选）：

- 使用 React Testing Library 测试 `useChatSessions`：
  - 创建 session 后 `sessions` 数量 +1。
  - 发送消息后 `messagesMap` 正确更新。
  - 切换 session 后 `activeSessionId` 变化。

## 后续可扩展

- 接入真实后端 API 替换 mock。
- 点击历史会话时加载完整聊天记录。
- 增加删除、重命名会话功能。
- 增加可折叠/响应式侧边栏。
