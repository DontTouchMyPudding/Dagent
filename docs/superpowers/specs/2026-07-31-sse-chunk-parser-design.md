# 前端 SSE Chunk 解析器设计文档

## 1. 背景

后端 `/chat/stream` 返回 `text/event-stream`，其中每个 token 包装在 SSE 消息里：

```text
event: token
data: {"id":"...","choices":[{"delta":{"content":"模型"},...}],...}

```

`data` 字段内的 JSON 为 OpenAI `chat.completion.chunk` 结构，待显示文本位于 `choices[0].delta.content`。

当前 `frontend/src/utils/streamParser.ts` 是一个纯函数 `(chunk: string) => string`，直接拼接 fetch 收到的原始文本，无法：
- 从 SSE 包装中提取 `data` 字段；
- 处理 SSE 消息跨多个 fetch chunk 或被拆分到单个 chunk 的情况；
- 识别 `event: error` 等元事件；
- 在解析层保存状态。

因此需要把 `streamParser.ts` 改造为有状态的 SSE 解析器。

## 2. 目标与非目标

### 目标

- 正确解析后端 SSE 流，提取 `choices[0].delta.content`。
- 支持 SSE 消息跨 fetch chunk 的拼接。
- 支持单个 fetch chunk 内包含多条 SSE 消息。
- 识别 `event: error` 并将其作为错误暴露给 `useChatStream`。
- 保持解析逻辑与 Hook/组件解耦，便于单元测试。

### 非目标

- 本次不处理 `delta.reasoning_content`、`tool_calls`、`function_call`、`refusal` 等字段。
- 不处理 `finish_reason` 的语义（仅将其作为普通消息忽略）。
- 不修改后端接口。
- 不引入新的网络请求库或全局状态管理。

## 3. 技术方案

采用**有状态解析器工厂**方案：

- `streamParser.ts` 导出 `createStreamParser(): StreamParser`。
- `StreamParser` 维护内部 SSE buffer，提供 `parse(chunk)` 与 `flush()`。
- `useChatStream` 在每次请求时创建新的 parser 实例，并在收到 chunk 时调用 `parse`。

相比在 `streamFetch` 或 `useChatStream` 内直接解析，此方案：
- 保持解析逻辑集中，便于后续后端格式变更时扩展；
- 不破坏 `streamFetch` 作为通用流读取工具的抽象；
- 状态封装在 parser 内部，单元测试可直接喂入任意 chunk 序列。

## 4. 接口设计

```ts
// frontend/src/utils/streamParser.ts
export interface StreamParser {
  /** 消费一段 fetch chunk，返回已解析出的文本（可能为空）。 */
  parse(chunk: string): string | null;
  /** 流结束时调用，处理 buffer 中剩余内容。 */
  flush(): string | null;
  /** 若解析过程中遇到 event: error，则此处保存错误对象。 */
  readonly error: Error | null;
}

export function createStreamParser(): StreamParser;
```

## 5. 解析算法

### 5.1 状态

- `buffer: string`：累积未完整的 SSE 消息。
- `_error: Error | null`：遇到的错误事件。

### 5.2 parse(chunk)

1. `buffer += chunk`。
2. 按 `\n\n` 切分，得到若干完整消息与最后一个可能不完整的尾部。
3. 对每一个完整消息调用 `processMessage()`，收集返回的 content。
4. 将尾部（可能为空）保留在 `buffer`。
5. 返回收集到的 content 拼接结果；若无内容返回 `null`。

### 5.3 processMessage(message)

1. 按行拆分，去除每行首尾空白。
2. 识别：
   - `event: <value>` → 记录 event 名。
   - `data: <value>` → 记录 data 内容；若后续行以空格开头则视为 data  continuation（SSE 规范）。
3. 如果 event 为 `error`：
   - 尝试 JSON.parse data 读取 `error` 字段；否则使用 data 原文。
   - 设置 `_error = new Error(...)`。
   - 返回 `null`。
4. 否则，若 data 存在：
   - 尝试 JSON.parse。
   - 提取 `choices[0]?.delta?.content`。
   - 若 content 存在且非空，返回该字符串。
5. JSON 解析失败或 content 缺失：返回 `null`（不打断流，可在 dev 环境 warn）。

### 5.4 flush()

1. 若 `buffer` 非空，调用 `processMessage(buffer)` 处理剩余内容。
2. 清空 `buffer`。
3. 返回收集到的 content。

## 6. useChatStream 集成

改动点：

1. 导入 `createStreamParser` 替代 `parseChunk`。
2. `sendMessage` 内创建 `const parser = createStreamParser()`。
3. `onChunk` 回调改为：
   ```ts
   onChunk: (chunk) => {
     const textChunk = parser.parse(chunk);
     if (parser.error) {
       throw parser.error;
     }
     if (!textChunk) return;
     setMessages((prev) => {
       const next = [...prev];
       const last = next[next.length - 1];
       if (last && last.role === "assistant") {
         last.content += textChunk;
       }
       return next;
     });
   },
   ```
4. 在 `try` 块末尾或 `finally` 中调用 `parser.flush()`，确保尾部 buffer 被消费。

错误传播：
- `parser.error` 在 `onChunk` 中立即抛出，会被外层 `try/catch` 捕获，设置 `error` 状态。
- 网络错误、主动中断保持现有逻辑不变。

## 7. 边界情况处理

| 场景 | 处理 |
|------|------|
| 单条 SSE 跨多个 fetch chunk | buffer 累积，直到收到 `\n\n` 再处理。 |
| 单个 chunk 含多条 SSE | 按 `\n\n` 拆分后逐条处理，content 拼接返回。 |
| data 为空或 content 为 null | 忽略，返回 null。 |
| JSON 解析失败 | 忽略该消息，dev 环境 console.warn，不打断流。 |
| event 为 error | 设置 `parser.error`，上层展示 Alert。 |
| 无 event 字段 | 默认按 token 处理。 |
| 流异常中断 | `finally` 中调用 `flush()` 消费剩余 buffer。 |

## 8. 测试思路

在 `streamParser.ts` 同目录或 `src/__tests__` 增加单测：

- 完整 SSE 消息：`event: token\ndata: {"choices":[{"delta":{"content":"hello"}}]}\n\n` → 返回 `"hello"`。
- 跨 chunk：`event: token\ndata: {"choices":` 与 `[{"delta":{"content":"hi"}}]}\n\n` → 返回 `"hi"`。
- 多消息同 chunk：两条完整 SSE → 返回 content 拼接。
- error 事件：`event: error\ndata: {"error":"backend fail"}\n\n` → `parser.error` 非空。
- 空 content 或缺失 choices：返回 `null`，error 为空。

## 9. 文件变更清单

- `frontend/src/utils/streamParser.ts`：改为 `createStreamParser` 工厂，实现 SSE + JSON 解析。
- `frontend/src/hooks/useChatStream.ts`：使用 `createStreamParser`，处理 `parser.error`，调用 `flush()`。
- 可选：`frontend/src/utils/types.ts` 若需导出 `StreamParser` 类型；也可仅在 `streamParser.ts` 导出。

## 10. 验收标准

- [ ] 前端能正确展示后端流式返回的文本，逐字/逐段出现。
- [ ] 单个 fetch chunk 包含多条 SSE 消息时，内容拼接正确。
- [ ] SSE 消息跨 fetch chunk 时，内容拼接正确。
- [ ] 后端返回 `event: error` 时，页面顶部 Alert 显示错误信息。
- [ ] JSON 解析异常或 content 为空时，不中断整个流。
- [ ] 主动停止或组件卸载时，无内存泄漏或 reader 未释放警告。
- [ ] `streamParser.ts` 可通过单元测试覆盖主要边界情况。
