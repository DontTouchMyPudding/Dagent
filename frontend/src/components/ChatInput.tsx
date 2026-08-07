import { useState } from "react";
import { Button, Input, Space } from "antd";
import {
  SendOutlined,
  StopOutlined,
  LoadingOutlined,
} from "@ant-design/icons";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  loading: boolean;
  streaming: boolean;
}

export default function ChatInput({
  onSend,
  onStop,
  loading,
  streaming,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  const handleSend = () => {
    const text = value.trim();
    if (!text || loading) return;
    onSend(text);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Space.Compact style={{ width: "100%", padding: "16px 24px" }}>
      <Input.TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder="输入消息..."
        autoSize={{ minRows: 1, maxRows: 6 }}
        disabled={streaming}
        style={{
          borderRadius: "12px 0 0 12px",
          resize: "none",
        }}
      />
      {streaming ? (
        <Button
          type="primary"
          danger
          icon={<StopOutlined />}
          onClick={onStop}
          style={{ borderRadius: "0 12px 12px 0", height: "auto" }}
        >
          停止
        </Button>
      ) : (
        <Button
          type="primary"
          icon={loading ? <LoadingOutlined /> : <SendOutlined />}
          onClick={handleSend}
          disabled={!value.trim() || loading}
          style={{ borderRadius: "0 12px 12px 0", height: "auto" }}
        >
          发送
        </Button>
      )}
    </Space.Compact>
  );
}
