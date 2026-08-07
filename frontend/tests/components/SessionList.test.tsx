import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionList from "../../src/components/SessionList";
import { ChatSession } from "../../src/utils/types";

const sessions: ChatSession[] = [
  { id: "s1", name: "会话一", createdAt: 1, updatedAt: 1 },
  { id: "s2", name: "会话二", createdAt: 2, updatedAt: 2 },
];

describe("SessionList", () => {
  it("renders session titles", () => {
    render(
      <SessionList
        sessions={sessions}
        activeSessionId={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("会话一")).toBeInTheDocument();
    expect(screen.getByText("会话二")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(
      <SessionList
        sessions={sessions}
        activeSessionId={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("会话二"));
    expect(onSelect).toHaveBeenCalledWith("s2");
  });
});
