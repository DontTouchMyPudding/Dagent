import { Empty } from "antd";

export default function EmptyChat() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255, 255, 255, 0.45)",
      }}
    >
      <Empty
        description="发送第一条消息，开始对话"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    </div>
  );
}
