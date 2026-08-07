import { useMemo, useState } from "react";
import { Avatar, Card, Spin, Typography } from "antd";
import { UserOutlined, RobotOutlined } from "@ant-design/icons";
import { Streamdown } from "streamdown";
import { math } from "@streamdown/math";
import { code } from "@streamdown/code";
import { Message } from "../utils/types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({
  message,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [thinkingExpanded, setThinkingExpanded] = useState(true);

  const bubbleStyle: React.CSSProperties = useMemo(
    () => ({
      maxWidth: "80%",
      borderRadius: "16px",
      backgroundColor: isUser ? "#1677ff" : "#1f1f1f",
      color: "#fff",
      padding: "12px 16px",
      wordBreak: "break-word",
    }),
    [isUser],
  );

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      {!isUser && (
        <Avatar
          style={{ backgroundColor: "#13c2c2", flexShrink: 0 }}
          icon={<RobotOutlined />}
        />
      )}
      <Card
        bordered={false}
        styles={{ body: { padding: 0 } }}
        style={bubbleStyle}
      >
        {isUser ? (
          <Typography.Text style={{ color: "#fff", whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography.Text>
        ) : (
          <>
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
            <Streamdown plugins={{ math, code }}>{message.content}</Streamdown>
            {isStreaming && !message.content && (
              <Spin size="small" style={{ marginTop: 8 }} />
            )}
          </>
        )}
      </Card>
      {isUser && (
        <Avatar
          style={{ backgroundColor: "#1677ff", flexShrink: 0 }}
          icon={<UserOutlined />}
        />
      )}
    </div>
  );
}
