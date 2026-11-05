import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.getAllByRole("button", { name: /^Copy / })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "educator email" }));
    const educatorEmail = screen.getByRole("tabpanel");
    expect(educatorEmail).toHaveTextContent("Vambah Sillah");
    expect(educatorEmail).toHaveTextContent("AmaduTown Advisory Solutions helps mission-driven teams turn scattered work into governed AI workflows, reviewable handoffs, and measurable next steps.");
    expect(educatorEmail).toHaveTextContent("https://amadutown.com");
    expect(educatorEmail).not.toHaveTextContent(/\+1\s*\(?\d{3}\)?|phone:/i);
    expect(screen.getByRole("link", { name: "Inspect adult interest form" })).toHaveAttribute("href", "/work/trumpet-trainer#interest");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("shows a six-step sequence with accessible details and learning thresholds", () => {
    render(<RecruitmentReviewPage />);
    const sequence = screen.getByRole("heading", { name: "14 days, six steps" }).nextElementSibling;
    expect(sequence?.querySelectorAll("ol > li")).toHaveLength(6);
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("pilot-fit signals")).toBeInTheDocument();
    const boundaries = screen.getByText("Operating boundaries and stop signals").closest("details");
    expect(boundaries).toHaveTextContent("No scraped lists, student rosters, contact import, or paid ads");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("keeps the gameplay card top aligned at its natural content height", () => {
    render(<RecruitmentReviewPage />);
    const gameplay = screen.getByLabelText("Synthetic Trumpet Trainer gameplay");
    const card = gameplay.parentElement;
    expect(card).toHaveClass("self-start");
    expect(card).toContainElement(screen.getByText("Captioned gameplay. No child or customer recording."));
    expect(card?.parentElement).toHaveClass("lg:grid-cols-2");
  });
});
