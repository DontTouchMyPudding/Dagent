import { useEffect } from "react";
import { useAgent } from "../hooks/useAgent";
import ChatMainArea from "./ChatMainArea";

interface ChatSessionProps {
  sessionId: string;
  autoSendMessage?: string;
  onSend: (text: string) => Promise<void>;
  onStop: () => void;
}

export default function ChatSession({
  sessionId,
  autoSendMessage,
  onSend,
  onStop,
}: ChatSessionProps) {
  const {
    messages,
    sendMessage,
    stop,
    loading,
    streaming,
    error,
  } = useAgent(sessionId);

  useEffect(() => {
    if (autoSendMessage) {
      sendMessage(autoSendMessage).then(() => onSend(autoSendMessage));
    }
    // Only run once on mount for the given autoSendMessage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (text: string) => {
    await sendMessage(text);
    await onSend(text);
  };

  const handleStop = () => {
    stop();
    onStop();
  };

  return (
    <ChatMainArea
      messages={messages}
      onSend={handleSend}
      onStop={handleStop}
      loading={loading}
      streaming={streaming}
      error={error}
    />
  );
}
