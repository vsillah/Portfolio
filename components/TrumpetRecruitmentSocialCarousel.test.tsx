import { fireEvent, render, screen, within } from "@testing-library/react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentSocialCarousel from "./TrumpetRecruitmentSocialCarousel";

describe("approved social slide carousel", () => {
  it("shows one slide, seven precise toggles, and previous/next controls", () => {
    render(<TrumpetRecruitmentSocialCarousel />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Social carousel slide 1 of 7" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Social carousel slide 1 of 7" })).toHaveAttribute("width", "1080");
    expect(screen.getByRole("img", { name: "Social carousel slide 1 of 7" })).toHaveAttribute("height", "1350");
    expect(within(screen.getByRole("tablist", { name: "Choose a social slide" })).getAllByRole("tab")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Previous social slide" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Show social slide 1" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next social slide" }));
    expect(screen.getByRole("status")).toHaveTextContent("Slide 2 of 7");
    expect(screen.getByRole("img", { name: "Social carousel slide 2 of 7" })).toHaveAttribute("src", expect.stringContaining("slide-02.png"));
    fireEvent.click(screen.getByRole("button", { name: "Previous social slide" }));
    expect(screen.getByRole("status")).toHaveTextContent("Slide 1 of 7");
    fireEvent.click(screen.getByRole("tab", { name: "Show social slide 7" }));
    expect(screen.getByRole("status")).toHaveTextContent("Slide 7 of 7");
    const songBuilderImage = screen.getByRole("img", { name: "Social carousel slide 7 of 7" });
    expect(new URL(songBuilderImage.getAttribute("src")!, "http://localhost").searchParams.get("url")).toBe("/showcases/trumpet-trainer/a558583a/social/slide-07.png");
    expect(screen.getByRole("button", { name: "Next social slide" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Show social slide 7" })).toHaveAttribute("aria-current", "true");
  });

  it("pins the corrected notation capture and keeps the six older slide bytes", () => {
    const asset = (path: string) => readFileSync(join(process.cwd(), path));
    const hash = (path: string) => createHash("sha256").update(asset(path)).digest("hex");
    expect(hash("docs/qa/trumpet-recruitment-visual-story/source/after-1062.png")).toBe("4613e9d8f4785d4e922a2fe120435ae2cc131f2476cf180eb6df24741b965b5f");
    expect(hash("docs/qa/trumpet-recruitment-visual-story/source/notation-walkthrough.mp4")).toBe("45ebbda1961027f966c9ce2d119c77504ff7d921782ea8def2cba7876ffb1eff");
    expect(hash("public/showcases/trumpet-trainer/a558583a/social/slide-07.png")).toBe("678bde6e836b3ebeda6c9356f00a4f9c879b9d4139002d5183eecba26f535a0e");
    expect(hash("public/showcases/trumpet-trainer/c19989a3/social/slide-07.png")).toBe("b9f30d645f598b7f712ece1676b69f52f5bca531f5fac15ea21f0dc05c83ea72");
    for (let index = 1; index <= 6; index += 1) {
      const filename = `slide-${String(index).padStart(2, "0")}.png`;
      expect(asset(`public/showcases/trumpet-trainer/c19989a3/social/${filename}`)).toEqual(asset(`docs/qa/trumpet-trainer-gameplay/social/${filename}`));
    }
  });

  it("supports arrow, Home, and End keys without a network request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TrumpetRecruitmentSocialCarousel />);
    const first = screen.getByRole("tab", { name: "Show social slide 1" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: "Show social slide 2" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(second, { key: "End" });
    expect(screen.getByRole("tab", { name: "Show social slide 7" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Show social slide 7" }), { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("Slide 7 of 7");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Show social slide 7" }), { key: "Home" });
    expect(first).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Slide 1 of 7");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
