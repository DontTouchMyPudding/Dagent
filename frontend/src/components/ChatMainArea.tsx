import { Alert, Layout } from "antd";
import { Message } from "../utils/types";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";

const { Content } = Layout;

interface ChatMainAreaProps {
  messages: Message[];
  onSend: (text: string) => void;
  onStop: () => void;
  loading: boolean;
  streaming: boolean;
  error: string | null;
}

export default function ChatMainArea({
  messages,
  onSend,
  onStop,
  loading,
  streaming,
  error,
}: ChatMainAreaProps) {
  return (
    <Layout style={{ flex: 1, backgroundColor: "#0f1115" }}>
      <Content
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {error && (
          <Alert
            message={error}
            type="error"
            closable
            showIcon
            style={{ margin: "16px 24px 0" }}
          />
        )}
        <MessageList messages={messages} streaming={streaming} />
        <ChatInput
          onSend={onSend}
          onStop={onStop}
          loading={loading}
          streaming={streaming}
        />
      </Content>
    </Layout>
  );
}
