import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
vi.mock("@/components/ProtectedRoute", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/admin/Breadcrumbs", () => ({ default: () => null }));
vi.mock("@/lib/authenticated-fetch", () => ({ fetchWithSessionRecovery: vi.fn() }));
import DecisionFilesReview from "./DecisionFilesReview";

describe("synthetic operator review", () => {
  it("shows the candidate as noninteractive example text with no broken service link", () => {
    const markup = renderToStaticMarkup(<DecisionFilesReview fixture />);
    expect(markup).toContain("Intake workflow workshop (example)");
    expect(markup).not.toContain('href="/services/synthetic-service"');
    expect(markup).toContain("Enter an existing assessment audit ID first");
  });
});
