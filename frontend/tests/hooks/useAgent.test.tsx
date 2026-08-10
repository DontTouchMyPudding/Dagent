import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useAgent } from "../../src/hooks/useAgent";
import { streamText } from "../../src/utils/streamFetch";

vi.mock("../../src/utils/streamFetch", () => ({
  streamText: vi.fn(),
}));

vi.mock("../../src/api/chat", async () => {
  return {
    stopChat: vi.fn().mockResolvedValue({}),
    updateSessionTitle: vi.fn().mockResolvedValue(undefined),
  };
});

const mockStreamText = vi.mocked(streamText);

function makeChunk(delta: Record<string, string>): string {
  const inner = JSON.stringify({ choices: [{ delta }] });
  const escaped = inner.replace(/"/g, '\\"');
  return `event: message\nid: 1\ndata: "${escaped}"`;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(cb, 0);
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("appends streamed messages to messagesMap and returns combined messages", async () => {
    mockStreamText.mockImplementation(async ({ onChunk, onOver }) => {
      onChunk(makeChunk({ content: "world" }));
      onOver?.();
    });

    const { result } = renderHook(() => useAgent("s1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "hello",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "world",
    });
  });

  it("keeps messages isolated per session", async () => {
    mockStreamText.mockImplementation(async ({ onChunk, onOver }) => {
      onChunk(makeChunk({ content: "world" }));
      onOver?.();
    });

    const { result, rerender } = renderHook(
      (props: { sessionId: string | null }) => useAgent(props.sessionId),
      {
        initialProps: { sessionId: "s1" },
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    rerender({ sessionId: "s2" });

    expect(result.current.messages).toEqual([]);
  });
});
