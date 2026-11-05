import { describe, expect, it, vi } from "vitest";
vi.mock("./DecisionFilesReview", () => ({ default: () => null }));
import DecisionFilesPage from "./page";

describe("operator fixture gate", () => {
  it("enables the synthetic queue only for the exact development query", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fixture = await DecisionFilesPage({ searchParams: Promise.resolve({ qa_fixture: "accelerated_decision_file_v1" }) });
    const ordinary = await DecisionFilesPage({ searchParams: Promise.resolve({ qa_fixture: "other" }) });
    expect(fixture.props.fixture).toBe(true);
    expect(ordinary.props.fixture).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    const production = await DecisionFilesPage({ searchParams: Promise.resolve({ qa_fixture: "accelerated_decision_file_v1" }) });
    expect(production.props.fixture).toBe(false);
    vi.unstubAllEnvs();
  });
});
