import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import RecruitmentReviewPage, { metadata } from "./page";

vi.mock("@/components/Navigation", () => ({ default: () => <nav aria-label="Site navigation" /> }));
const require = createRequire(import.meta.url);

describe("Trumpet Trainer recruitment review", () => {
  it("keeps static persona media out of the unrelated admin function trace", () => {
    const config = require("../../../../next.config.js");
    const exclusions = config.experimental.outputFileTracingExcludes["/api/admin/social-content/*/bind-approved-master"];
    expect(exclusions).toContain("./public/work/trumpet-trainer/personas/*");
  });

  it("keeps the campaign inactive and makes all audiences, media, and drafts reviewable", () => {
    render(<RecruitmentReviewPage />);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("first practice step");
    expect(screen.getByText(/This page sends nothing, stores no contacts/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Avery" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Social carousel slide 1 of 7" })).toBeInTheDocument();
    expect(within(screen.getByRole("tablist", { name: "Choose a social slide" })).getAllByRole("tab")).toHaveLength(7);
    expect(within(screen.getByRole("tablist", { name: "Choose a message draft" })).getAllByRole("tab")).toHaveLength(6);
    expect(screen.getAllByRole("button", { name: /^Copy / })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "educator email" }));
    const educatorEmail = screen.getByRole("tabpanel", { name: "educator email" });
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
    expect(sequence?.querySelectorAll("ol > li details")).toHaveLength(6);
    expect(sequence?.querySelectorAll("svg")).toHaveLength(0);
    const trumpet = sequence?.querySelector("img");
    expect(trumpet).toHaveAttribute("alt", "");
    expect(trumpet?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(new URL(trumpet?.getAttribute("src") || "", "http://localhost").searchParams.get("url")).toBe("/work/trumpet-trainer/design/trumpet-timeline-poster.png");
    expect(readFileSync(join(process.cwd(), "public/work/trumpet-trainer/design/trumpet-timeline-poster.png")).length).toBeGreaterThan(0);
    expect(sequence?.textContent).not.toContain("𝄞");
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("pilot-fit signals")).toBeInTheDocument();
    const boundaries = screen.getByText("Operating boundaries and stop signals").closest("details");
    expect(boundaries).toHaveTextContent("No scraped lists, student rosters, contact import, or paid ads");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("keeps one adult-specific profile visible at a time", () => {
    render(<RecruitmentReviewPage />);
    const audience = screen.getByRole("heading", { name: "Four adult perspectives" }).closest("section");
    expect(audience).not.toBeNull();
    expect(within(audience!).getAllByRole("article")).toHaveLength(1);
    const copy = [
      ["Parents or guardians", "Parent or guardian", "Avery", "Make the next note obvious."],
      ["Private trumpet tutors", "Private trumpet tutor", "Morgan", "A beginner can follow it alone."],
      ["Band educators", "Band educator", "Casey", "Clarify one step without added admin."],
      ["Community music programs", "Community program lead", "Jordan", "Add practice time without complex setup."],
    ];
    for (const [audienceName, role, name, proof] of copy) {
      fireEvent.click(within(audience!).getByRole("button", { name: `Show ${audienceName}` }));
      const card = within(audience!).getByRole("article");
      expect(within(card).getByRole("heading", { name })).toBeInTheDocument();
      expect(card).toHaveTextContent(role);
      expect(card).toHaveTextContent(proof);
      expect(within(card).getByText("Contact path")).toBeInTheDocument();
    }
  });

  it("gives the playable gameplay video the full content width and retains its fallback", () => {
    render(<RecruitmentReviewPage />);
    const gameplay = screen.getByLabelText("Synthetic Trumpet Trainer gameplay") as HTMLVideoElement;
    expect(gameplay).toHaveAttribute("controls");
    expect(gameplay).toHaveAttribute("preload", "metadata");
    expect(gameplay).toHaveClass("aspect-video", "w-full");
    expect(gameplay.querySelector("source")).toHaveAttribute("src", "/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4");
    expect(gameplay).toHaveTextContent("The seven-slide social carousel below shows the reviewed product path.");
    expect(gameplay.parentElement).toContainElement(screen.getByText("Captioned gameplay. No child or customer recording."));
    const mediaSource = screen.getByText("Media source and claim limits").closest("details");
    expect(mediaSource).toHaveTextContent("c19989a3b156ce97326e35b335e169014ca076f3");
    expect(mediaSource).toHaveTextContent("The corrected Song Builder social slide has a separate source below.");
    const carouselSource = screen.getByText("Carousel provenance").closest("details");
    expect(carouselSource).toHaveTextContent("Slides 1–6 are the historical review assets");
    expect(carouselSource).toHaveTextContent("a558583a7b4a16919a9dae0a82718ff7ec4c4891");
    expect(carouselSource).toHaveTextContent("The earlier slides and gameplay video were not recaptured.");
    expect(screen.queryByRole("img", { name: "Trumpet Trainer home screen from the synthetic gameplay capture" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review the full carousel" })).not.toBeInTheDocument();
  });
});
