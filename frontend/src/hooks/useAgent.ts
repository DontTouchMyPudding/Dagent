import { useCallback, useEffect, useMemo, useState } from "react";
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

export function useAgent(sessionId: string): UseAgentReturn {
  const [messages, setMessages] = useState<Message[]>([]);

  const updateSessionTitleMutation = useMutation({
    mutationFn: (variables: { sessionId: string; title: string }) =>
      apiUpdateSessionTitle(variables.sessionId, variables.title),
  });

  const handleStreamComplete = useCallback(
    (params: {
      sessionId: string;
      userMessage: Message | null;
      assistantMessage: Message;
    }) => {
      const { userMessage, assistantMessage } = params;
      setMessages((prev) => [
        ...prev,
        ...(userMessage ? [userMessage] : []),
        assistantMessage,
      ]);
    },
    [],
  );

  const {
    activeMessages,
    activeSessionId,
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
    stopChat(sessionId).catch(() => {
      // 后端停止请求失败不影响前端状态重置
    });
    stopChatStream();
  }, [stopChatStream, sessionId]);

  const combinedMessages = useMemo(() => {
    if (activeSessionId !== sessionId) return messages;
    return [...messages, ...activeMessages];
  }, [sessionId, messages, activeMessages, activeSessionId]);

  const error = useMemo(() => {
    if (chatError) return chatError;
    if (updateSessionTitleMutation.error instanceof Error)
      return updateSessionTitleMutation.error.message;
    return null;
  }, [chatError, updateSessionTitleMutation.error]);

  return {
    messages: combinedMessages,
    sendMessage,
    stop,
    loading,
    streaming,
    error,
  };
}
