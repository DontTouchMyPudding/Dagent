import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "antd";
import { useSessions } from "../hooks/useSessions";
import Sidebar from "../components/Sidebar";
import ChatMainArea from "../components/ChatMainArea";
import KeepAlive from "../components/KeepAlive";
import ChatSession from "../components/ChatSession";

const { Header } = Layout;

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const {
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    loading: sessionsLoading,
    error: sessionsError,
  } = useSessions({ urlSessionId: sessionId });

  const handleNewChat = useCallback(() => {
    selectSession(null);
    navigate("/chat");
  }, [navigate, selectSession]);

  const handleSelectSession = useCallback(
    (id: string) => {
      selectSession(id);
      navigate(`/chat/${id}`);
    },
    [navigate, selectSession],
  );

  const handleSessionSend = useCallback(
    async (_sessionId: string, text: string) => {
      setPendingMessage(null);
      // The actual message was sent by ChatSession/useAgent.
      // This callback is used for parent-level side effects if needed.
      void _sessionId;
      void text;
    },
    [],
  );

  const handleSessionStop = useCallback(() => {
    // No-op wrapper; ChatSession already calls useAgent.stop().
  }, []);

  const handleEmptySend = useCallback(
    async (text: string) => {
      const newId = await createSession();
      setPendingMessage(text);
      navigate(`/chat/${newId}`, { replace: true });
    },
    [createSession, navigate],
  );

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
        {activeSessionId ? (
          <KeepAlive activeKey={activeSessionId} max={10}>
            {(sessionId) => (
              <ChatSession
                key={sessionId}
                sessionId={sessionId}
                autoSendMessage={
                  sessionId === activeSessionId
                    ? (pendingMessage ?? undefined)
                    : undefined
                }
                onSend={(text) => handleSessionSend(sessionId, text)}
                onStop={handleSessionStop}
              />
            )}
          </KeepAlive>
        ) : (
          <ChatMainArea
            messages={[]}
            onSend={handleEmptySend}
            onStop={() => {}}
            loading={sessionsLoading}
            streaming={false}
            error={sessionsError}
          />
        )}
      </Layout>
    </Layout>
  );
}
