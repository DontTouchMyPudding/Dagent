import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ChatSession } from "../utils/types";
import SessionList from "./SessionList";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: 260,
        height: "100%",
        display: "flex",
        flexDirection: "column", 
        backgroundColor: "#141414",
        borderRight: "1px solid #303030",
      }}
    >
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onNewChat}
        >
          新建会话
        </Button>
      </div>
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={onSelectSession}
      />
    </aside>
  );
}
