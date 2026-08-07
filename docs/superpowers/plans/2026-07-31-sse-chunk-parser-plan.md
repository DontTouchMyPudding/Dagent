# SSE Chunk Parser & Think Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 OpenAI 兼容 SSE chunk 解析、thinking/content 分开拼接、以及可折叠的思考过程渲染。

**Architecture:** 在 `streamParser.ts` 中新增 `StreamChunk` 类型和 JSON/SSE 解析逻辑；在 `types.ts` 扩展 `Message`；在 `useChatStream.ts` 按类型分别追加；在 `MessageBubble.tsx` 用 React state + CSS transition 实现 thinking 折叠区块。

**Tech Stack:** React, TypeScript, Ant Design, CSS-in-JS inline styles.

## Global Constraints
- 不新增依赖。
- 不修改 git 状态（用户要求不使用 git 操作）。
- 折叠动画仅使用 CSS transition，不引入动画库。
- `error` 类型接口保留但暂不实现业务处理。

---

### Task 1: Extend Types

**Files:**
- Modify: `src/utils/types.ts`

**Interfaces:**
- Produces: `StreamChunkType`, `StreamChunk`, `Message.thinking?: string`.

- [ ] **Step 1: Add stream chunk types**

在 `src/utils/types.ts` 中追加：

```ts
export type StreamChunkType = "think" | "value" | "error";

export interface StreamChunk {
  type: StreamChunkType;
  value: string;
}
```

- [ ] **Step 2: Extend Message with thinking**

修改 `Message` 接口：

```ts
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
}
```

---

### Task 2: Implement parseChunk

**Files:**
- Modify: `src/utils/streamParser.ts`

**Interfaces:**
- Consumes: 后端 SSE chunk（可能带 `data: ` 前缀或 `[DONE]`）。
- Produces: `StreamChunk`。

- [ ] **Step 1: Parse SSE payload**

去除 `data: ` 前缀，忽略 `[DONE]` 和空行：

```ts
const line = chunk.trim();
if (!line || line === "data: [DONE]") {
  return { type: "value", value: "" };
}
const json = line.startsWith("data:") ? line.slice(5).trim() : line;
```

- [ ] **Step 2: Extract delta fields**

解析 JSON，按优先级返回：

```ts
const data = JSON.parse(json);
const delta = data?.choices?.[0]?.delta;
if (!delta) return { type: "value", value: "" };

if (delta.reasoning_content) {
  return { type: "think", value: String(delta.reasoning_content) };
}
if (delta.content) {
  return { type: "value", value: String(delta.content) };
}
return { type: "value", value: "" };
```

- [ ] **Step 3: Wrap in try/catch**

解析失败返回空值，不中断流：

```ts
try {
  // ...parse...
} catch {
  return { type: "value", value: "" };
}
```

---

### Task 3: Update useChatStream

**Files:**
- Modify: `src/hooks/useChatStream.ts`

**Interfaces:**
- Consumes: `StreamChunk` from `parseChunk`。
- Produces: 更新后的 `messages`，其中 assistant 消息可能包含 `thinking`。

- [ ] **Step 1: Use StreamChunk return**

```ts
const chunk = parseChunk(rawChunk);
if (!chunk.value) return;
```

- [ ] **Step 2: Branch append by type**

```ts
setMessages((prev) => {
  const next = [...prev];
  const last = next[next.length - 1];
  if (!last || last.role !== "assistant") return prev;
  if (chunk.type === "think") {
    last.thinking = (last.thinking || "") + chunk.value;
  } else {
    last.content += chunk.value;
  }
  return next;
});
```

---

### Task 4: Render Thinking in MessageBubble

**Files:**
- Modify: `src/components/MessageBubble.tsx`

**Interfaces:**
- Consumes: `Message.thinking`。

- [ ] **Step 1: Add expanded state**

```ts
import { useState } from "react";
// ...
const [thinkingExpanded, setThinkingExpanded] = useState(true);
```

- [ ] **Step 2: Render collapsible thinking block**

在 `Streamdown` 之前插入：

```tsx
{message.thinking && (
  <div style={{ marginBottom: 12 }}>
    <div
      onClick={() => setThinkingExpanded((v) => !v)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        color: "#b0c4c4",
        fontSize: 13,
        userSelect: "none",
      }}
    >
      <span>{thinkingExpanded ? "▼" : "▶"}</span>
      <span>思考过程</span>
    </div>
    <div
      style={{
        maxHeight: thinkingExpanded ? 999 : 0,
        overflow: "hidden",
        transition: "max-height 0.25s ease",
        marginTop: 8,
        padding: thinkingExpanded ? "8px 12px" : "0 12px",
        borderRadius: 8,
        backgroundColor: "#2a3a3a",
        color: "#b0c4c4",
        fontSize: 13,
        whiteSpace: "pre-wrap",
      }}
    >
      {message.thinking}
    </div>
  </div>
)}
```

---

## Self-Review

1. **Spec coverage:**
   - Chunk 解析 → Task 2。
   - `Message.thinking` → Task 1。
   - 分开拼接 → Task 3。
   - 可折叠 + 颜色区分 → Task 4。
   - `error` 接口保留 → Task 1 类型定义。
   无遗漏。

2. **Placeholder scan:** 无 TBD/TODO/"later"。

3. **Type consistency:** `StreamChunk` / `StreamChunkType` 在 Task 1 定义，Task 2 返回，Task 3 消费，一致。