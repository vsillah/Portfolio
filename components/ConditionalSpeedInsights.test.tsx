import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConditionalSpeedInsights from "./ConditionalSpeedInsights";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => <div data-testid="speed-insights" /> }));

describe("Speed Insights route boundary", () => {
  it("omits the telemetry script from recruitment review", () => {
    usePathname.mockReturnValue("/work/trumpet-trainer/recruitment");
    render(<ConditionalSpeedInsights />);
    expect(screen.queryByTestId("speed-insights")).not.toBeInTheDocument();
  });

  it("keeps telemetry on the existing public product page", () => {
    usePathname.mockReturnValue("/work/trumpet-trainer");
    render(<ConditionalSpeedInsights />);
    expect(screen.getByTestId("speed-insights")).toBeInTheDocument();
  });
});
