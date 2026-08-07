import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Message } from "../utils/types";
import { parseChunk } from "../utils/streamParser";
import { streamText } from "../utils/streamFetch";
import {
  stopChat,
  updateSessionTitle as apiUpdateSessionTitle,
} from "../api/chat";

const API_URL = "/api/chat/stream";

export interface UseAgentReturn {
  messages: Message[];
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useAgent(sessionId: string | null): UseAgentReturn {
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
    const currentSessionId = sessionIdRef.current;
    if (currentSessionId) {
      stopChat(currentSessionId).catch(() => {
        // 后端停止请求失败不影响前端状态重置
      });
    }
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
    async (text: string) => {
      const targetSessionId = sessionIdRef.current;
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
          body: { message: text, task_id: targetSessionId },
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
