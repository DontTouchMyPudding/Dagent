import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Message, ToolCall, ToolResult } from "../utils/types";
import { parseChunk } from "../utils/streamParser";
import { streamText } from "../utils/streamFetch";

const API_URL = "/api/chat/stream";
const STOPPED_ERROR = "生成已停止";

export interface UseChatStreamOptions {
  onComplete?: (params: {
    sessionId: string;
    userMessage: Message | null;
    assistantMessage: Message;
  }) => void;
}

export interface UseChatStreamReturn {
  activeMessages: Message[];
  activeSessionId: string | null;
  sendMessage: (text: string) => Promise<void>;
  resumeOnMount: () => void;
  stop: () => void;
  loading: boolean;
  streaming: boolean;
  resuming: boolean;
  error: string | null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getStorageKey(sessionId: string): string {
  return `chat:streaming:${sessionId}`;
}

export function useChatStream(
  sessionId: string | null,
  options: UseChatStreamOptions = {},
): UseChatStreamReturn {
  const { onComplete } = options;

  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const thinkRef = useRef("");
  const contentRef = useRef("");
  const toolCallsRef = useRef<ToolCall[]>([]);
  const toolResultsRef = useRef<ToolResult[]>([]);
  const pendingRef = useRef<number | null>(null);
  const activeMessagesRef = useRef<Message[]>([]);

  const clearStreamState = useCallback(() => {
    if (pendingRef.current !== null) {
      cancelAnimationFrame(pendingRef.current);
      pendingRef.current = null;
    }
    abortControllerRef.current = null;
    setLoading(false);
    setStreaming(false);
    setResuming(false);
  }, []);

  const flushToActiveMessages = useCallback(() => {
    pendingRef.current = null;
    const thinking = thinkRef.current;
    const content = contentRef.current;
    const toolCalls = toolCallsRef.current;
    const toolResults = toolResultsRef.current;
    thinkRef.current = "";
    contentRef.current = "";
    toolCallsRef.current = [];
    toolResultsRef.current = [];

    if (
      !thinking &&
      !content &&
      toolCalls.length === 0 &&
      toolResults.length === 0
    )
      return;

    const prev = activeMessagesRef.current;
    if (prev.length === 0) return;
    const lastIndex = prev.length - 1;
    const last = prev[lastIndex];
    if (last.role !== "assistant") return;
    const next = prev.map((msg, index) =>
      index === lastIndex
        ? {
            ...last,
            content: last.content + content,
            thinking: (last.thinking ?? "") + thinking,
            toolCalls: [...(last.toolCalls ?? []), ...toolCalls],
            toolResults: [...(last.toolResults ?? []), ...toolResults],
          }
        : msg,
    );
    activeMessagesRef.current = next;
    setActiveMessages(next);
  }, []);

  const handleChunk = useCallback(
    (chunk: string) => {
      const currentSessionId = activeSessionIdRef.current;
      if (!currentSessionId) return;

      sessionStorage.setItem(
        getStorageKey(currentSessionId),
        new Date().getUTCDate().toString(),
      );

      chunk?.split("\n\n").forEach((line) => {
        const parsed = parseChunk(line);
        if (parsed.type === "think") {
          thinkRef.current += parsed.value as string;
        } else if (parsed.type === "token" || parsed.type === "value") {
          contentRef.current += parsed.value as string;
        } else if (parsed.type === "tool_call") {
          toolCallsRef.current.push(parsed.value as ToolCall);
        } else if (parsed.type === "tool_result") {
          toolResultsRef.current.push(parsed.value as ToolResult);
        }
        if (pendingRef.current === null) {
          pendingRef.current = requestAnimationFrame(flushToActiveMessages);
        }
      });
    },
    [flushToActiveMessages],
  );

  const clearReconnectRun = (sessionId: string) => {
    sessionStorage.removeItem(getStorageKey(sessionId));
  };

  const runStream = useCallback(
    async (
      body: { message?: string; task_id: string },
      initialMessages: Message[],
    ): Promise<{ messages: Message[]; error: string | null }> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      activeSessionIdRef.current = body.task_id;
      setActiveSessionId(body.task_id);

      setActiveMessages(initialMessages);
      activeMessagesRef.current = initialMessages;
      setError(null);
      setStreaming(true);

      let streamError: string | null = null;

      try {
        await streamText({
          url: API_URL,
          body,
          onChunk: handleChunk,
          signal: controller.signal,
        });
        clearReconnectRun(body.task_id);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          streamError = STOPPED_ERROR;
        } else if (err instanceof Error) {
          streamError = err.message || "请求失败";
        } else {
          streamError = "请求失败";
        }
        setError(streamError);
      } finally {
        if (pendingRef.current !== null) {
          cancelAnimationFrame(pendingRef.current);
          pendingRef.current = null;
        }
        flushToActiveMessages();
        const finalMessages = activeMessagesRef.current;
        clearStreamState();
        activeSessionIdRef.current = null;
        setActiveSessionId(null);
        setActiveMessages([]);
        return { messages: finalMessages, error: streamError };
      }
    },
    [handleChunk, clearStreamState, flushToActiveMessages],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const currentSessionId = sessionId;
      if (!text.trim()) return;
      if (!currentSessionId) {
        setError("未选择会话");
        return;
      }

      setLoading(true);
      sessionStorage.removeItem(getStorageKey(currentSessionId));

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

      const { messages, error: streamError } = await runStream(
        { message: text, task_id: currentSessionId },
        [userMessage, assistantMessage],
      );

      if (!streamError || streamError === STOPPED_ERROR) {
        const assistant = messages.find((m) => m.role === "assistant");
        if (assistant) {
          onComplete?.({
            sessionId: currentSessionId,
            userMessage,
            assistantMessage: assistant,
          });
        }
      }
    },
    [runStream, onComplete, sessionId],
  );

  const resumeOnMount = useCallback(() => {
    const currentSessionId = sessionId;
    if (!currentSessionId) return;
    const mark = sessionStorage.getItem(getStorageKey(currentSessionId));
    if (!mark) return;

    setResuming(true);

    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
    };

    runStream({ task_id: currentSessionId }, [assistantMessage]).then(
      ({ messages, error: streamError }) => {
        if (!streamError || streamError === STOPPED_ERROR) {
          const assistant = messages.find((m) => m.role === "assistant");
          if (assistant) {
            onComplete?.({
              sessionId: currentSessionId,
              userMessage: null,
              assistantMessage: assistant,
            });
          }
        }
      },
    );
  }, [runStream, onComplete, sessionId]);

  const stop = useCallback(() => {
    const currentSessionId = activeSessionIdRef.current;
    if (currentSessionId) {
      clearReconnectRun(currentSessionId);
    }
    abortControllerRef.current?.abort();
    clearStreamState();
  }, [clearStreamState]);

  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) {
        cancelAnimationFrame(pendingRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const isLoading = useMemo(() => loading || resuming, [loading, resuming]);

  return {
    activeMessages,
    activeSessionId,
    sendMessage,
    resumeOnMount,
    stop,
    loading: isLoading,
    streaming,
    resuming,
    error,
  };
}
