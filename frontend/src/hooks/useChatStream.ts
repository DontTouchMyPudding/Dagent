import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Message, ToolCall, ToolResult } from "../utils/types";
import { parseChunk } from "../utils/streamParser";
import { streamText } from "../utils/streamFetch";

const API_URL = "/api/chat/stream";

export interface UseChatStreamOptions {
  onComplete?: (params: {
    userMessage: Message | null;
    assistantMessage: Message;
  }) => void;
}

export interface UseChatStreamReturn {
  activeMessages: Message[];
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
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(sessionId);
  const thinkRef = useRef("");
  const contentRef = useRef("");
  const toolCallsRef = useRef<ToolCall[]>([]);
  const toolResultsRef = useRef<ToolResult[]>([]);
  const pendingRef = useRef<number | null>(null);
  const activeMessagesRef = useRef<Message[]>([]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const clearStreamState = useCallback(() => {
    if (pendingRef.current !== null) {
      cancelAnimationFrame(pendingRef.current);
      pendingRef.current = null;
    }
    thinkRef.current = "";
    contentRef.current = "";
    toolCallsRef.current = [];
    toolResultsRef.current = [];
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
      const currentSessionId = sessionIdRef.current;
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

  const runStream = useCallback(
    async (
      body: { message?: string; task_id: string },
      initialMessages: Message[],
    ): Promise<{ messages: Message[]; error: string | null }> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          streamError = "生成已停止";
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
        setActiveMessages([]);
        return { messages: finalMessages, error: streamError };
      }
    },
    [handleChunk, clearStreamState, flushToActiveMessages],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const currentSessionId = sessionIdRef.current;
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

      if (!streamError) {
        const assistant = messages.find((m) => m.role === "assistant");
        if (assistant) {
          onComplete?.({ userMessage, assistantMessage: assistant });
        }
      }
    },
    [runStream, onComplete],
  );

  const resumeOnMount = useCallback(() => {
    const currentSessionId = sessionIdRef.current;
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
        if (!streamError) {
          const assistant = messages.find((m) => m.role === "assistant");
          if (assistant) {
            onComplete?.({ userMessage: null, assistantMessage: assistant });
          }
        }
      },
    );
  }, [runStream, onComplete]);

  const stop = useCallback(() => {
    const currentSessionId = sessionIdRef.current;
    if (currentSessionId) {
      sessionStorage.removeItem(getStorageKey(currentSessionId));
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
    sendMessage,
    resumeOnMount,
    stop,
    loading: isLoading,
    streaming,
    resuming,
    error,
  };
}
