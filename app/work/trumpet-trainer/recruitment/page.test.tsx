import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecruitmentReviewPage, { metadata } from "./page";

vi.mock("@/components/Navigation", () => ({ default: () => <nav aria-label="Site navigation" /> }));

describe("Trumpet Trainer recruitment review", () => {
  it("keeps the campaign inactive and makes all audiences, media, and drafts reviewable", () => {
    render(<RecruitmentReviewPage />);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("first practice step");
    expect(screen.getByText(/This page sends nothing, stores no contacts/)).toBeInTheDocument();
    for (const role of ["Parents or guardians", "Private trumpet tutors", "Band educators", "Community music programs"]) {
      expect(screen.getByRole("heading", { name: role })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("figure")).toHaveLength(7);
    expect(screen.getAllByRole("button", { name: /^Copy / })).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Inspect adult interest form" })).toHaveAttribute("href", "/work/trumpet-trainer#interest");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
