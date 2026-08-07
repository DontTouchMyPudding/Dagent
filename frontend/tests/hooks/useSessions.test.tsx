import { describe, it, expect, vi } from "vitest";
import {
  renderHook,
  act,
  waitFor,
  WrapperComponent,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useSessions } from "../../src/hooks/useSessions";

let sessionCounter = 0;

vi.mock("../../src/api/chat", () => ({
  fetchSessions: vi.fn().mockResolvedValue({
    code: 0,
    data: { total: 2, list: [
      { id: "s1", name: "会话一", createdAt: 1, updatedAt: 1 },
      { id: "s2", name: "会话二", createdAt: 2, updatedAt: 2 },
    ]},
    message: "ok",
  }),
  createSession: vi.fn().mockImplementation(() => {
    sessionCounter += 1;
    return Promise.resolve({
      code: 0,
      data: { id: `new-${sessionCounter}`, name: "新会话", createdAt: Date.now(), updatedAt: Date.now() },
      message: "ok",
    });
  }),
}));

function createWrapper(): WrapperComponent<{ children: ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useSessions", () => {
  beforeEach(() => {
    sessionCounter = 0;
  });

  it("should load mock sessions on mount", async () => {
    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.sessions.length).toBeGreaterThan(0);
    });
  });

  it("should create a new session", async () => {
    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createSession();
    });

    expect(result.current.activeSessionId).not.toBeNull();
    expect(result.current.sessions.length).toBeGreaterThan(0);
  });

  it("should switch active session", async () => {
    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const id = await result.current.createSession();
      result.current.selectSession(id);
    });

    expect(result.current.activeSessionId).toBe(result.current.sessions[0].id);
  });
});
