import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentMessages from "./TrumpetRecruitmentMessages";

const messages = [
  { label: "page blurb", audience: "Landing page", text: "First draft" },
  { label: "educator email", audience: "Educator email", text: "Second draft" },
];

describe("recruitment message selector", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  it("keeps one panel visible and moves selected focus with arrow keys", () => {
    render(<TrumpetRecruitmentMessages messages={messages} />);
    const first = screen.getByRole("tab", { name: "page blurb" });
    const second = screen.getByRole("tab", { name: "educator email" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First draft");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Second draft");
    fireEvent.keyDown(second, { key: "Home" });
    expect(first).toHaveFocus();
  });

  it("copies only the selected exact draft locally", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentMessages messages={messages} />);
    fireEvent.click(screen.getByRole("tab", { name: "educator email" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy educator email" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Second draft"));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
