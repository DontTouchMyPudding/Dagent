import { useEffect, useRef } from "react";
import { Message } from "../utils/types";
import MessageBubble from "./MessageBubble";
import EmptyChat from "./EmptyChat";

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
}

export default function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyChat />;
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px",
      }}
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isStreaming={
            streaming && index === messages.length - 1 && message.role === "assistant"
          }
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
