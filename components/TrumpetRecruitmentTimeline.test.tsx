import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentTimeline, { type TimelineStep } from "./TrumpetRecruitmentTimeline";

const steps: TimelineStep[] = [
  { days: "1–2", title: "Check the score", detail: "Check the source." },
  { days: "3–4", title: "Share, if approved", detail: "Wait for approval." },
  { days: "5–7", title: "Listen for friction", detail: "Listen to adults." },
  { days: "8–10", title: "Try one more channel", detail: "Check channel rules." },
  { days: "11–12", title: "Follow up once", detail: "Respect a decline." },
  { days: "13–14", title: "Choose the next note", detail: "Decide what to revise." },
];

const matchMotion = (matches: boolean) => vi.stubGlobal("matchMedia", vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })));

beforeEach(() => {
  matchMotion(false);
  vi.stubGlobal("navigator", { ...navigator, vendor: "Google Inc." });
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Trumpet recruitment milestones", () => {
  it("anchors six chronological alternating branches to the trumpet and advances completed stems", () => {
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    const branches = container.querySelector('svg[data-branch-order="1-2-3-4-5-6"]');
    const nodes = [...container.querySelectorAll("[data-branch-step]")];
    expect(branches).toHaveAttribute("data-layout", "alternating");
    expect(nodes.map((node) => node.getAttribute("data-branch-step"))).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(nodes.map((node) => node.getAttribute("data-anchor-side"))).toEqual(["left", "right", "left", "right", "left", "right"]);
    expect(nodes.every((node) => node.querySelector("path") && node.querySelector("circle") && node.querySelector("text"))).toBe(true);
    expect(nodes.map((node) => node.querySelector("text")?.textContent)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(container.querySelector('[data-timeline-spine="base"]')).toHaveAttribute("d", expect.stringMatching(/^M .* V .*$/));
    expect(container.querySelector('[data-timeline-spine="progress"]')).toHaveAttribute("d", expect.stringMatching(/^M .* V .*$/));
    expect(container.querySelector('[data-timeline-direction="down"]')).toBeInTheDocument();
    expect([...container.querySelectorAll("button[data-side]")].map((node) => node.getAttribute("data-side"))).toEqual(["left", "right", "left", "right", "left", "right"]);
    fireEvent.click(screen.getByRole("button", { name: /Step 4, days/ }));
    expect(branches).toHaveAttribute("data-progress", "4");
    expect(nodes.map((node) => node.getAttribute("data-reached"))).toEqual(["true", "true", "true", "true", "false", "false"]);
    expect(screen.getByRole("button", { name: /Step 4, days/ })).toHaveAttribute("aria-current", "step");
  });

  it("keeps six ordered trumpet connections and a semantic active step on mobile", () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("max-width: 767px"), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    const branches = container.querySelector('svg[data-branch-order="1-2-3-4-5-6"]');
    expect(branches).toHaveAttribute("data-layout", "stacked");
    expect([...container.querySelectorAll("[data-branch-step]")].map((node) => node.getAttribute("data-anchor-side"))).toEqual(Array(6).fill("right"));
    expect(screen.getAllByRole("button", { name: /^Step \d, days/ }).map((button) => button.getAttribute("aria-label")?.slice(0, 6))).toEqual(["Step 1", "Step 2", "Step 3", "Step 4", "Step 5", "Step 6"]);
    fireEvent.click(screen.getByRole("button", { name: /Step 5, days/ }));
    expect(branches).toHaveAttribute("data-progress", "5");
    expect([...container.querySelectorAll("[data-branch-step]")].map((node) => node.getAttribute("data-reached"))).toEqual(["true", "true", "true", "true", "true", "false"]);
    expect(screen.getByRole("button", { name: /Step 5, days/ })).toHaveAttribute("aria-current", "step");
  });

  it("starts on a static poster and maps direct selections to one distinct clip and card", async () => {
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    expect(screen.getByRole("img", { name: "Vertically framed brass trumpet" })).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Step \d, days/ })).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /Step 4, days/ }));
    await act(async () => {});
    expect(container.firstElementChild).toHaveAttribute("data-active", "4");
    expect(container.querySelector("video source")).toHaveAttribute("src", "/work/trumpet-trainer/recruitment-motion/step-04.webm");
    expect(container.querySelector("video source")).toHaveAttribute("type", 'video/webm; codecs="vp9"');
    expect(screen.getByText("Check channel rules.")).toBeInTheDocument();
    fireEvent.ended(container.querySelector("video")!);
    expect(container.querySelector("video")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-active", "4");
  });

  it("supports arrow, Home, and End keys plus both navigation directions", () => {
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    const first = screen.getByRole("button", { name: /Step 1, days/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: /Step 2, days/ })).toHaveFocus();
    expect(container.firstElementChild).toHaveAttribute("data-active", "2");
    fireEvent.click(screen.getByRole("button", { name: "Next milestone" }));
    expect(container.firstElementChild).toHaveAttribute("data-active", "3");
    fireEvent.click(screen.getByRole("button", { name: "Previous milestone" }));
    expect(container.firstElementChild).toHaveAttribute("data-active", "2");
    const dot = screen.getByRole("button", { name: /Show milestone 2/ });
    fireEvent.keyDown(dot, { key: "End" });
    expect(screen.getByRole("button", { name: /Show milestone 6/ })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Next milestone" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("button", { name: /Show milestone 6/ }), { key: "Home" });
    expect(container.firstElementChild).toHaveAttribute("data-active", "1");
  });

  it("pauses the old video on rapid selection and replays the selected gesture", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 2, days/ }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: /Step 5, days/ }));
    await act(async () => {});
    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(container.querySelector("video source")).toHaveAttribute("src", "/work/trumpet-trainer/recruitment-motion/step-05.webm");
    fireEvent.click(screen.getByRole("button", { name: "Replay milestone 5 gesture" }));
    await act(async () => {});
    expect(play).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenCalled();
    expect(container.querySelectorAll("video")).toHaveLength(1);
  });

  it("keeps direct selection and card highlights without video or tremor in reduced motion", () => {
    matchMotion(true);
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 3, days/ }));
    expect(container.firstElementChild).toHaveAttribute("data-motion", "reduced");
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button", { name: /Replay milestone/ })).toBeNull();
    expect(screen.getByText("Listen to adults.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Step 3, days/ })).toHaveAttribute("data-tremor", "false");
    expect(container.querySelector('svg[data-branch-order="1-2-3-4-5-6"]')).toHaveAttribute("data-progress", "3");
  });

  it("falls back to the poster and retains selection when media playback fails", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("blocked"));
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 6, days/ }));
    await act(async () => {});
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Motion unavailable");
    expect(screen.getByRole("img", { name: "Vertically framed brass trumpet" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-active", "6");
  });

  it("uses the transparent poster when alpha playback is unsupported", () => {
    vi.stubGlobal("navigator", { ...navigator, vendor: "Apple Computer, Inc." });
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 3, days/ }));
    expect(container.firstElementChild).toHaveAttribute("data-alpha-motion", "poster");
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button", { name: /Replay milestone/ })).toBeNull();
    expect(screen.getByRole("img", { name: "Vertically framed brass trumpet" })).toHaveAttribute("data-hidden", "false");
  });

  it("rejects opaque video decoding before revealing it", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    } as unknown as CanvasRenderingContext2D);
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 2, days/ }));
    await act(async () => {});
    fireEvent.loadedData(container.querySelector("video")!);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img", { name: "Vertically framed brass trumpet" })).toHaveAttribute("data-hidden", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Motion unavailable");
  });

  it("reveals alpha video only after the transparent corner probe passes", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }),
    } as unknown as CanvasRenderingContext2D);
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 2, days/ }));
    await act(async () => {});
    const video = container.querySelector("video")!;
    fireEvent.playing(video);
    expect(video).toHaveAttribute("data-visible", "false");
    fireEvent.loadedData(video);
    expect(video).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("img", { name: "Vertically framed brass trumpet" })).toHaveAttribute("data-hidden", "true");
  });

  it("shows a readable fallback if the poster image cannot load", () => {
    render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.error(screen.getByRole("img", { name: "Vertically framed brass trumpet" }));
    expect(screen.getByRole("img", { name: "Trumpet visual unavailable" })).toHaveTextContent("Trumpet visual unavailable");
    expect(screen.getByRole("button", { name: /Step 1, days/ })).toBeEnabled();
  });

  it("adds only a brief card pulse after the third milestone press", async () => {
    vi.useFakeTimers();
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 3, days/ }));
    await act(async () => {});
    act(() => vi.advanceTimersByTime(520));
    expect(screen.getByRole("button", { name: /Step 3, days/ })).toHaveAttribute("data-tremor", "true");
    act(() => vi.advanceTimersByTime(220));
    expect(screen.getByRole("button", { name: /Step 3, days/ })).toHaveAttribute("data-tremor", "false");
    expect(container.querySelectorAll('[data-tremor="true"]')).toHaveLength(0);
  });
});
