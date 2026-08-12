import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Message } from "../utils/types";
import { useChatStream } from "./useChatStream";
import {
  stopChat,
  updateSessionTitle as apiUpdateSessionTitle,
} from "../api/chat";

export interface UseAgentReturn {
  messages: Message[];
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
}

export function useAgent(sessionId: string | null): UseAgentReturn {
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});

  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const updateSessionTitleMutation = useMutation({
    mutationFn: (variables: { sessionId: string; title: string }) =>
      apiUpdateSessionTitle(variables.sessionId, variables.title),
  });

  const handleStreamComplete = useCallback(
    (params: { userMessage: Message | null; assistantMessage: Message }) => {
      const { userMessage, assistantMessage } = params;
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;

      setMessagesMap((prev) => {
        const existing = prev[currentSessionId] ?? [];
        const toAdd = userMessage
          ? [userMessage, assistantMessage]
          : [assistantMessage];
        return {
          ...prev,
          [currentSessionId]: [...existing, ...toAdd],
        };
      });
    },
    [],
  );

  const {
    activeMessages,
    sendMessage: sendChatMessage,
    resumeOnMount,
    stop: stopChatStream,
    loading,
    streaming,
    error: chatError,
  } = useChatStream(sessionId, { onComplete: handleStreamComplete });

  useEffect(() => {
    resumeOnMount();
  }, [resumeOnMount]);

  const sendMessage = useCallback(
    async (text: string) => {
      await sendChatMessage(text);
    },
    [sendChatMessage],
  );

  const stop = useCallback(() => {
    const currentSessionId = sessionIdRef.current;
    if (currentSessionId) {
      stopChat(currentSessionId).catch(() => {
        // 后端停止请求失败不影响前端状态重置
      });
    }
    stopChatStream();
  }, [stopChatStream]);

  const messages = useMemo(() => {
    if (!sessionId) return [];
    return [...(messagesMap[sessionId] ?? []), ...activeMessages];
  }, [sessionId, messagesMap, activeMessages]);

  const error = useMemo(() => {
    if (chatError) return chatError;
    if (updateSessionTitleMutation.error instanceof Error)
      return updateSessionTitleMutation.error.message;
    return null;
  }, [chatError, updateSessionTitleMutation.error]);

  return {
    messages,
    sendMessage,
    stop,
    loading,
    streaming,
    error,
  };
}
