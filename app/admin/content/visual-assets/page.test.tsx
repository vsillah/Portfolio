/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VisualAssetsReviewPage from "./page";

vi.mock("@/components/ProtectedRoute", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: "admin-token" })),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

function candidate(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `candidate-${index}`,
    entity_type: "service",
    entity_id: `service-${index}`,
    title: `Service ${index}`,
    theme: index % 2 === 0 ? "dark" : "light",
    current_url: null,
    candidate_url: `https://example.com/candidate-${index}.png`,
    candidate_storage_path: `products/visual-candidates/service-${index}/candidate-${index}.png`,
    capture_route: `/services/service-${index}`,
    score: 70,
    reason_codes: ["missing_image"],
    status: "proposed",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    metadata: {},
    created_at: `2026-06-28T12:${String(index).padStart(2, "0")}:00.000Z`,
    updated_at: `2026-06-28T12:${String(index).padStart(2, "0")}:00.000Z`,
    ...overrides,
  };
}

const capturedCandidates = Array.from({ length: 13 }, (_, index) =>
  candidate(index + 1),
);
const missingCandidates = [
  candidate(101, {
    id: "needs-capture-1",
    title: "Missing Screenshot Service",
    candidate_url: null,
    candidate_storage_path: null,
  }),
];

describe("VisualAssetsReviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/approve")) {
          return {
            ok: true,
            json: async () => ({ candidate: { id: url.split("/").at(-2) } }),
          };
        }
        if (url.includes("candidate_state=needs_capture")) {
          return {
            ok: true,
            json: async () => ({ candidates: missingCandidates }),
          };
        }
        return {
          ok: true,
          json: async () => ({ candidates: capturedCandidates }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to captured review candidates with pagination controls", async () => {
    render(<VisualAssetsReviewPage />);

    expect(
      await screen.findByRole("heading", { name: "Homepage Visual Assets" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("Page 1 of 2")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Approve Visible" }),
    ).toBeEnabled();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/visual-assets/candidates?status=proposed&candidate_state=captured&limit=250",
        expect.objectContaining({
          headers: { Authorization: "Bearer admin-token" },
        }),
      );
    });
  });

  it("separates the missing-capture queue from the captured review queue", async () => {
    render(<VisualAssetsReviewPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "needs capture" }),
    );

    expect(
      await screen.findByText("Missing Screenshot Service"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("needs capture").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/visual-assets/candidates?status=proposed&candidate_state=needs_capture&limit=250",
        expect.objectContaining({
          headers: { Authorization: "Bearer admin-token" },
        }),
      );
    });
  });

  it("approves only visible captured candidates and leaves apply-approved untouched", async () => {
    render(<VisualAssetsReviewPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Approve Visible" }),
    );

    await waitFor(() => {
      expect(
        vi
          .mocked(fetch)
          .mock.calls.filter(([input]) => String(input).includes("/approve"))
          .length,
      ).toBe(12);
    });
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) =>
          String(input).includes("/apply-approved"),
        ),
    ).toBe(false);
  });
});
