# SSE Chunk Parser & Think Rendering Design

## Date
2026-07-31

## Goal
让 `parseChunk` 正确解析后端返回的 OpenAI 兼容 chat.completion.chunk JSON，并产出结构化 `{type, value}`；业务层把 reasoning 内容和正文分开拼接；UI 对 thinking 过程做可折叠、颜色区分的渲染。

## Background
当前 `src/utils/streamParser.ts` 直接原样返回 chunk 字符串。后端实际格式如下：

```json
{
  "id": "...",
  "choices": [{
    "delta": {
      "content": "模型",
      "reasoning_content": null
    },
    "finish_reason": null
  }]
}
```

`delta.content` 为正文章节，`delta.reasoning_content` 为思考章节。

## Design

### 1. Chunk Parsing
- `parseChunk(chunk: string): StreamChunk`
- 输入可能是 SSE 包装：`data: {...}\n\n` 或纯 JSON 字符串。
- 解析 JSON，提取 `choices[0].delta`。
- 如果 `reasoning_content` 存在且非空 → `{ type: "think", value: reasoning_content }`。
- 如果 `content` 存在且非空 → `{ type: "value", value: content }`。
- 两者都为空，或只有 `finish_reason` / `[DONE]`，返回 `{ type: "value", value: "" }`，业务层忽略空值。
- `error` 类型先保留接口但不实现；遇到解析异常时返回空值，避免打断流。

### 2. Data Model
- `Message` 增加可选字段 `thinking?: string`。
- `StreamChunk` 类型：
  ```ts
  export type StreamChunkType = "think" | "value" | "error";
  export interface StreamChunk {
    type: StreamChunkType;
    value: string;
  }
  ```

### 3. Business Layer (useChatStream)
- `onChunk` 收到 `StreamChunk`。
- `type === "value"` → 追加到 `last.content`。
- `type === "think"` → 追加到 `last.thinking`。
- `type === "error"` 或空值 → 跳过。

### 4. UI Rendering (MessageBubble)
- 如果 `message.thinking` 存在，在正文前渲染一个可折叠的思考区块。
- 视觉：
  - 背景：低饱和青灰 `#2a3a3a`。
  - 文字：`#b0c4c4`。
  - 标题行："思考过程" + 展开/收起图标。
  - 默认展开；点击标题切换。
  - 折叠动画使用 CSS `max-height` + `overflow` transition，不引入额外动画库。
- 正文仍用 `Streamdown` 渲染；思考内容使用纯文本保留换行，避免 Markdown 过度渲染。

## Files to Change
1. `src/utils/types.ts` — 添加 `StreamChunk` / `StreamChunkType`，扩展 `Message`。
2. `src/utils/streamParser.ts` — 实现 JSON/SSE 解析逻辑。
3. `src/hooks/useChatStream.ts` — 按 type 分别拼接。
4. `src/components/MessageBubble.tsx` — 渲染 thinking 折叠区块。

## Error Handling
- 解析失败不抛错，返回空 `value` 让业务层忽略，避免单个坏 chunk 中断整个流。
- 真正的 `error` 类型后续可在 `streamText` 或后端返回错误 payload 时扩展。

## Dependencies
- 不新增依赖。折叠交互使用原生 React state + CSS transition。