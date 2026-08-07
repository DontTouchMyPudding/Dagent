import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatInput from "../../src/components/ChatInput";

describe("ChatInput", () => {
  it("does not call onSend while typing", () => {
    const onSend = vi.fn();
    render(
      <ChatInput
        onSend={onSend}
        onStop={() => {}}
        loading={false}
        streaming={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("输入消息...");
    fireEvent.change(textarea, { target: { value: "hello" } });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onSend with trimmed text and clears after sending", () => {
    const onSend = vi.fn();
    render(
      <ChatInput
        onSend={onSend}
        onStop={() => {}}
        loading={false}
        streaming={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("输入消息...");
    fireEvent.change(textarea, { target: { value: "  hello world  " } });
    fireEvent.click(screen.getByText("发送"));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello world");
    expect(textarea).toHaveValue("");
  });

  it("does not send empty or whitespace-only messages", () => {
    const onSend = vi.fn();
    render(
      <ChatInput
        onSend={onSend}
        onStop={() => {}}
        loading={false}
        streaming={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("输入消息...");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(screen.getByText("发送"));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("submits on Enter without shift", () => {
    const onSend = vi.fn();
    render(
      <ChatInput
        onSend={onSend}
        onStop={() => {}}
        loading={false}
        streaming={false}
      />,
    );

    const textarea = screen.getByPlaceholderText("输入消息...");
    fireEvent.change(textarea, { target: { value: "hi" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledWith("hi");
  });

  it("shows stop button while streaming", () => {
    const onStop = vi.fn();
    render(
      <ChatInput
        onSend={() => {}}
        onStop={onStop}
        loading={false}
        streaming={true}
      />,
    );

    fireEvent.click(screen.getByText("停止"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
