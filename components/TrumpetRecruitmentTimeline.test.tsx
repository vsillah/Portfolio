import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TrumpetRecruitmentTimeline, { type TimelineStep } from "./TrumpetRecruitmentTimeline";

const steps: TimelineStep[] = [
  { days: "1–2", title: "Check the score", detail: "Check the source." },
  { days: "3–4", title: "Share, if approved", detail: "Wait for approval." },
  { days: "5–7", title: "Listen for friction", detail: "Listen to adults." },
  { days: "8–10", title: "Try one more channel", detail: "Check channel rules." },
  { days: "11–12", title: "Follow up once", detail: "Respect a decline." },
  { days: "13–14", title: "Choose the next note", detail: "Decide what to revise." },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Trumpet recruitment timeline media", () => {
  it("plays Safari's transparent animated WebP once and advances the six beats", () => {
    vi.useFakeTimers();
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    let trigger!: () => void;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        trigger = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect() {}
    });
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    expect(container.querySelector("video")).toBeNull();
    act(trigger);
    const image = container.querySelector('img[src$="trumpet-timeline.webp"]')!;
    expect(image).not.toBeNull();
    fireEvent.load(image);
    expect(container.firstElementChild).toHaveAttribute("data-beat", "1");
    act(() => vi.advanceTimersByTime(1280));
    expect(container.firstElementChild).toHaveAttribute("data-beat", "2");
    act(() => vi.advanceTimersByTime(5200));
    expect(container.firstElementChild).toHaveAttribute("data-beat", "6");
    expect(container.querySelectorAll('img[src$="trumpet-timeline.webp"]')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(600));
    expect(container.querySelector('img[src$="trumpet-timeline.webp"]')).toBeNull();
    expect(container.querySelector('img[src*="trumpet-timeline-poster.png"]')).not.toBeNull();
  });

  it("shows the stable poster and all six native details when motion is reduced", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    const timeline = container.firstElementChild!;
    expect(timeline).toHaveAttribute("data-beat", "6");
    expect(timeline.querySelectorAll("ol > li details")).toHaveLength(6);
    expect(timeline.querySelector("video")).toBeNull();
    expect(timeline.querySelector("img")).toHaveAttribute("alt", "");
    expect(observer).not.toHaveBeenCalled();
    const details = screen.getAllByText("Review details")[2].closest("details")!;
    fireEvent.click(details.querySelector("summary")!);
    expect(details).toHaveAttribute("open");
  });

  it("plays the rendered instrument once and follows its beat timestamps without losing details focus", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    let trigger!: (visible: boolean) => void;
    const disconnect = vi.fn();
    const observe = vi.fn();
    class MockObserver {
      constructor(callback: IntersectionObserverCallback) {
        trigger = (visible) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe = observe;
      disconnect = disconnect;
    }
    vi.stubGlobal("IntersectionObserver", MockObserver);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    const timeline = container.firstElementChild!;
    const player = timeline.querySelector("video")!;
    expect(player.querySelectorAll("source")).toHaveLength(2);
    expect(timeline.querySelector("[data-motion-part]")).toBeNull();
    expect(observe).toHaveBeenCalledOnce();

    await act(async () => trigger(true));
    expect(play).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalled();
    expect(timeline).toHaveAttribute("data-beat", "1");
    expect(timeline.querySelector("img")).not.toBeNull();
    fireEvent.playing(player);
    expect(timeline.querySelector("img")).toBeNull();
    const summary = timeline.querySelectorAll("ol > li summary")[2];
    (summary as HTMLElement).focus();
    fireEvent.click(summary);
    for (const [time, beat] of [[1.3, 2], [3.3, 3], [4.3, 4], [5.5, 5], [6.5, 6]] as const) {
      Object.defineProperty(player, "currentTime", { configurable: true, value: time });
      fireEvent.timeUpdate(player);
      expect(timeline).toHaveAttribute("data-beat", String(beat));
    }
    act(() => { trigger(false); trigger(true); });
    expect(play).toHaveBeenCalledOnce();
    expect(summary).toHaveFocus();
    expect(summary.closest("details")).toHaveAttribute("open");
    fireEvent.error(player);
    expect(timeline.querySelector("video")).toBeNull();
    expect(timeline.querySelector("img")).not.toBeNull();
    expect(timeline).toHaveAttribute("data-beat", "6");
  });
});
