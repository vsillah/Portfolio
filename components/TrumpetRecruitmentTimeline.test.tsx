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
});

describe("Trumpet recruitment timeline motion", () => {
  it("keeps all six native steps and details stable in reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    const timeline = container.firstElementChild!;
    expect(timeline).toHaveAttribute("data-beat", "6");
    expect(timeline.querySelectorAll("ol > li")).toHaveLength(6);
    expect(timeline.querySelectorAll("ol > li details")).toHaveLength(6);
    expect(timeline.querySelector("img")).toHaveAttribute("alt", "");
    expect(timeline.querySelector("img")?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(observer).not.toHaveBeenCalled();
    const details = screen.getAllByText("Review details")[2].closest("details")!;
    fireEvent.click(details.querySelector("summary")!);
    expect(details).toHaveAttribute("open");
  });

  it("plays six one-shot instrument beats and coordinates the third valve, pin, and card", () => {
    vi.useFakeTimers();
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
    const { container } = render(<TrumpetRecruitmentTimeline steps={steps} />);
    const timeline = container.firstElementChild!;
    const milestone = (index: number) => timeline.querySelectorAll("ol > li")[index - 1];
    const valve = (index: number) => timeline.querySelector(`[data-motion-part="valve-${index}"]`);
    expect(timeline).toHaveAttribute("data-beat", "0");
    expect(observe).toHaveBeenCalledTimes(1);

    act(() => trigger(true));
    expect(timeline).toHaveAttribute("data-beat", "1");
    expect(milestone(1)).toHaveAttribute("data-active", "true");
    act(() => vi.advanceTimersByTime(620));
    expect(timeline).toHaveAttribute("data-beat", "2");
    expect(valve(1)).toHaveAttribute("data-pressed", "true");

    const focusedSummary = milestone(3).querySelector("summary")!;
    focusedSummary.focus();
    fireEvent.click(focusedSummary);
    act(() => vi.advanceTimersByTime(620));
    expect(timeline).toHaveAttribute("data-beat", "3");
    expect(valve(2)).toHaveAttribute("data-pressed", "true");
    expect(timeline.querySelector('[data-vibrate="true"]')).not.toBeNull();
    expect(milestone(3)).toHaveAttribute("data-active", "true");
    expect(focusedSummary).toHaveFocus();
    expect(focusedSummary.closest("details")).toHaveAttribute("open");

    act(() => vi.advanceTimersByTime(620));
    expect(timeline).toHaveAttribute("data-beat", "4");
    expect(valve(1)).toHaveAttribute("data-pressed", "true");
    expect(valve(3)).toHaveAttribute("data-pressed", "true");
    act(() => vi.advanceTimersByTime(620));
    expect(timeline).toHaveAttribute("data-beat", "5");
    expect(valve(2)).toHaveAttribute("data-pressed", "true");
    expect(valve(3)).toHaveAttribute("data-pressed", "true");
    act(() => vi.advanceTimersByTime(620));
    expect(timeline).toHaveAttribute("data-beat", "6");
    expect(timeline.querySelector('[data-motion-part="bell"]')).toHaveAttribute("data-resolve", "true");

    act(() => { trigger(false); trigger(true); vi.advanceTimersByTime(5000); });
    expect(timeline).toHaveAttribute("data-beat", "6");
    expect(disconnect).toHaveBeenCalled();
    expect(focusedSummary.closest("details")).toHaveAttribute("open");
  });
});
