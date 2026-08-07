import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "antd";
import { useSessions } from "../hooks/useSessions";
import { useAgent } from "../hooks/useAgent";
import Sidebar from "../components/Sidebar";
import ChatMainArea from "../components/ChatMainArea";

const { Header } = Layout;

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    loading: sessionsLoading,
    error: sessionsError,
  } = useSessions({ urlSessionId: sessionId });

  const {
    messages,
    sendMessage,
    stop,
    loading: chatLoading,
    streaming,
    error: chatError,
  } = useAgent(activeSessionId);

  const handleNewChat = useCallback(() => {
    stop();
    selectSession(null);
    navigate("/chat");
  }, [navigate, selectSession, stop]);

  const handleSelectSession = useCallback(
    (id: string) => {
      selectSession(id);
      navigate(`/chat/${id}`);
    },
    [navigate, selectSession],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!activeSessionId) {
        const newId = await createSession();
        navigate(`/chat/${newId}`, { replace: true });
      }
      await sendMessage(text);
    },
    [activeSessionId, createSession, navigate, sendMessage],
  );

  const loading = sessionsLoading || chatLoading;
  const error = sessionsError ?? chatError;

  return (
    <Layout style={{ height: "100vh", backgroundColor: "#0f1115" }}>
      <Header
        style={{
          backgroundColor: "#141414",
          borderBottom: "1px solid #303030",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
          AI 助手
        </span>
      </Header>
      <Layout hasSider style={{ flex: 1, overflow: "hidden" }}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
        />
        <ChatMainArea
          messages={messages}
          onSend={handleSend}
          onStop={stop}
          loading={loading}
          streaming={streaming}
          error={error}
        />
      </Layout>
    </Layout>
  );
}
