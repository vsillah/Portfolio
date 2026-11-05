import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentCopy from "./TrumpetRecruitmentCopy";

describe("recruitment copy control", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  it("copies draft text locally without requesting or sending anything", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentCopy label="message" text="Adult feedback only" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Adult feedback only"));
    expect(screen.getByRole("status")).toHaveTextContent("Review it before using it anywhere");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("gives a manual recovery path when clipboard access fails", async () => {
    writeText.mockRejectedValueOnce(new Error("clipboard denied"));
    render(<TrumpetRecruitmentCopy label="message" text="Adult feedback only" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Select and copy the text below");
  });
});
