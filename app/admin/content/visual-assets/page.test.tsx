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
        if (url.includes("/reject")) {
          return {
            ok: true,
            json: async () => ({ candidate: { id: url.split("/").at(-2), status: "rejected" } }),
          };
        }
        if (url.includes("/regenerate")) {
          return {
            ok: true,
            json: async () => ({
              replacementCandidate: { id: "replacement-1", status: "proposed" },
              capture: { captured: 1, passed: 1, blocked: 0 },
            }),
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

  it("does not approve candidates blocked by Idia automated review", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/approve")) {
        return {
          ok: true,
          json: async () => ({ candidate: { id: url.split("/").at(-2) } }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [
            candidate(1, {
              metadata: {
                agent_review: {
                  decision: "passed",
                  summary: "Passed automated quality review for dark human approval.",
                },
              },
            }),
            candidate(2, {
              id: "blocked-candidate",
              metadata: {
                agent_review: {
                  decision: "blocked",
                  summary: "Blocked before human review: dark mode mismatch.",
                },
              },
            }),
          ],
        }),
      } as Response;
    });

    render(<VisualAssetsReviewPage />);

    expect(await screen.findByText("Idia blocked")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve Visible" }));

    await waitFor(() => {
      const approvalCalls = vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes("/approve"));
      expect(approvalCalls).toHaveLength(1);
      expect(String(approvalCalls[0][0])).toContain("candidate-1");
    });
  });

  it("requires rejection feedback before regenerating a candidate", async () => {
    render(<VisualAssetsReviewPage />);

    const rejectButton = (await screen.findAllByRole("button", { name: "Reject" }))[0];
    fireEvent.click(rejectButton);

    expect(screen.getByRole("dialog", { name: "Reject candidate" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Rejection reason"), {
      target: { value: "Too much blank space and the product is not clear." },
    });
    fireEvent.change(screen.getByLabelText("Regeneration recommendation"), {
      target: { value: "Tighten the crop and show the feature cards." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Too much blank space" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject & Regenerate" }));

    await waitFor(() => {
      const rejectCall = vi
        .mocked(fetch)
        .mock.calls.find(([input]) => String(input).includes("/reject"));
      expect(rejectCall).toBeDefined();
      expect(JSON.parse(String(rejectCall?.[1]?.body))).toMatchObject({
        reason: "Too much blank space and the product is not clear.",
        recommendation: "Tighten the crop and show the feature cards.",
        reasonCodes: expect.arrayContaining(["high_blank_space_ratio"]),
      });
    });

    await waitFor(() => {
      const regenerateCall = vi
        .mocked(fetch)
        .mock.calls.find(([input]) => String(input).includes("/regenerate"));
      expect(regenerateCall).toBeDefined();
      expect(JSON.parse(String(regenerateCall?.[1]?.body))).toMatchObject({
        reason: "Too much blank space and the product is not clear.",
        recommendation: "Tighten the crop and show the feature cards.",
        reasonCodes: expect.arrayContaining(["high_blank_space_ratio"]),
      });
    });
  });
});
