import { List, Typography } from "antd";
import { ChatSession } from "../utils/types";

interface SessionListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
}

export default function SessionList({
  sessions,
  activeSessionId,
  onSelect,
}: SessionListProps) {
  return (
    <List
      dataSource={sessions}
      renderItem={(session) => {
        const isActive = session.id === activeSessionId;
        return (
          <List.Item
            onClick={() => onSelect(session.id)}
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              borderRadius: "8px",
              margin: "4px 8px",
              backgroundColor: isActive ? "#1677ff" : "transparent",
              transition: "background-color 0.2s ease",
            }}
          >
            <Typography.Text
              ellipsis
              style={{
                color: isActive ? "#fff" : "rgba(255, 255, 255, 0.85)",
                width: "100%",
              }}
            >
              {session.name}
            </Typography.Text>
          </List.Item>
        );
      }}
      style={{
        flex: 1,
        overflowY: "auto",
      }}
    />
  );
}
