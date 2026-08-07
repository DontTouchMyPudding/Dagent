# Chat Hooks 职责拆分设计

## 背景

当前 `src/hooks/useChatSessions.ts` 同时承担三类职责：

1. **会话列表管理**：查询、创建、选择 sessions。
2. **单会话消息管理**：messages map、流式发送、停止。
3. **UI 输入状态**：`input` 状态。

由于 `input` 状态变化频率最高，而 `ChatPage` 调用 `useChatSessions`，导致每次输入都会让整个 `ChatPage` 重新渲染，左侧 `Sidebar` 也随之重新渲染。

## 目标

- 拆分 hook 职责，让 `Sidebar` 不受输入框影响。
- 保持现有功能不变：新建会话、切换会话、发送消息、流式输出、停止。
- 不引入过度设计（如 Context）。

## 方案

采用 **方案 B：中等拆分**。

### Hook 拆分

#### `useSessions(options)`

路径：`src/hooks/useSessions.ts`

职责：
- 查询 sessions 列表（TanStack Query）。
- 创建新会话。
- 维护 `activeSessionId` 状态，并与 `urlSessionId` 同步。
- 提供 `selectSession(id)` 用于切换当前会话。

返回：
```ts
{
  sessions: ChatSession[];
  activeSessionId: string | null;
  selectSession: (id: string) => void;
  createSession: () => Promise<string>;
  isLoading: boolean;
  error: string | null;
}
```

注意：`selectSession` 只更新状态，不执行导航；导航由 `ChatPage` 负责。

#### `useChat(sessionId)`

路径：`src/hooks/useChat.ts`

职责：
- 维护 `messagesMap`：记录每个 sessionId 的消息列表。
- 发送消息、流式接收响应。
- 停止生成。
- 假设调用时已存在有效 `sessionId`。

返回：
```ts
{
  messages: Message[];
  sendMessage: (text: string, sessionId: string) => Promise<void>;
  stop: () => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
}
```

`sendMessage` 接收 `sessionId` 参数，不再内部创建会话。

### 组件调整

#### `ChatMainArea`

- 内部持有 `input` 状态。
- `onSend` 签名改为 `(text: string) => void`。
- 发送成功后自己清空输入框。

#### `ChatPage`

- 调用 `useSessions({ urlSessionId })`。
- 调用 `useChat(activeSessionId)`。
- `handleSend(text)`：
  - 若 `activeSessionId` 存在 → `sendMessage(text, activeSessionId)`。
  - 若为空 → `const id = await createSession()` → `navigate(`/chat/${id}`)` → `sendMessage(text, id)`。
- `handleSelectSession(id)` → `selectSession(id)` → `navigate(`/chat/${id}`)`。
- `handleNewChat` → `stop()` → `selectSession(null)` → `navigate("/chat")`。

### 数据流

```
ChatPage
├── useSessions ──▶ Sidebar (sessions, activeSessionId, callbacks)
└── useChat ──────▶ ChatMainArea (messages, sendMessage, stop, states)
```

输入框变化只影响 `ChatMainArea` 内部状态，不影响 `ChatPage` 和 `Sidebar`。

## 边界情况

- **空会话页输入发送**：由 `ChatPage` 先创建会话，跳转后再发消息。
- **切换会话**：停止当前流式输出，更新 `activeSessionId`，`useChat` 根据新 id 显示对应 messages。
- **新建会话**：停止流式输出，清空 `activeSessionId`，跳转回 `/chat`。
- **发送时 sessionId 为空**：`useChat` 内部可抛出明确错误，但正常流程下由 `ChatPage` 保证不会传入空值。

## 不变项

- `src/api/chat.ts` 保持不变。
- `Sidebar` / `SessionList` 的 props 结构基本不变。
- `src/utils/types.ts` 保持不变。

## 验收标准

- [ ] 在输入框输入时，`Sidebar` 不再重新渲染。
- [ ] 新建会话、切换会话、发送消息、流式输出、停止功能正常。
- [ ] TypeScript 编译通过。
- [ ] 无功能回归。
