import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatStream } from "../../src/hooks/useChatStream";
import { streamText } from "../../src/utils/streamFetch";

vi.mock("../../src/utils/streamFetch", () => ({
  streamText: vi.fn(),
}));

const mockStreamText = vi.mocked(streamText);

function makeChunk(delta: Record<string, string>): string {
  const inner = JSON.stringify({ choices: [{ delta }] });
  const escaped = inner.replace(/"/g, '\\"');
  return `event: message\nid: 1\ndata: "${escaped}"`;
}

describe("useChatStream", () => {
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

  it("streams a user message and assistant response, then calls onComplete", async () => {
    mockStreamText.mockImplementation(async ({ onChunk, onOver }) => {
      onChunk(makeChunk({ reasoning_content: "thinking" }));
      onChunk(makeChunk({ content: "answer" }));
      onOver?.();
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useChatStream("s1", { onComplete }),
    );

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      userMessage: expect.objectContaining({ role: "user", content: "hello" }),
      assistantMessage: expect.objectContaining({
        role: "assistant",
        content: "answer",
        thinking: "thinking",
      }),
    });
    expect(result.current.activeMessages).toEqual([]);
    expect(sessionStorage.getItem("chat:streaming:s1")).toBeNull();
  });

  it("aborts stream and clears sessionStorage on stop", async () => {
    const abortHandlers: Array<() => void> = [];
    mockStreamText.mockImplementation(async ({ signal }) => {
      const handler = () => {
        abortHandlers.forEach((h) => h());
      };
      signal?.addEventListener("abort", handler);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      signal?.removeEventListener("abort", handler);
    });

    const { result } = renderHook(() => useChatStream("s1"));

    act(() => {
      result.current.sendMessage("hi");
    });

    let aborted = false;
    abortHandlers.push(() => {
      aborted = true;
    });

    act(() => {
      result.current.stop();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(aborted).toBe(true);
    expect(sessionStorage.getItem("chat:streaming:s1")).toBeNull();
  });

  it("resumes stream on mount if sessionStorage mark exists", async () => {
    sessionStorage.setItem("chat:streaming:s1", "1");

    mockStreamText.mockImplementation(async ({ onChunk, onOver }) => {
      onChunk(makeChunk({ content: "answer" }));
      onOver?.();
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useChatStream("s1", { onComplete }),
    );

    await act(async () => {
      result.current.resumeOnMount();
    });

    await waitFor(() => {
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { task_id: "s1" },
        }),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(onComplete).toHaveBeenCalledWith({
      userMessage: null,
      assistantMessage: expect.objectContaining({
        role: "assistant",
        content: "answer",
      }),
    });
  });

  it("does not resume if sessionStorage mark is absent", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useChatStream("s1", { onComplete }),
    );

    act(() => {
      result.current.resumeOnMount();
    });

    expect(mockStreamText).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
