"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";

const recipient = "vambah@amadutown.com";
const roles = [
  "Parent or guardian",
  "Private trumpet tutor",
  "Band educator",
  "Community music program",
];
const levels = [
  "Just starting",
  "First year",
  "More than one year",
  "Supporting several levels",
];

const prohibitedChildDetails = [
  /\b(?:child(?:ren)?'?s?|student'?s?|kid'?s?)\s+name\s*(?::|=|is\b)/i,
  /\b(?:child(?:ren)?'?s?|student'?s?|kid'?s?)\s+school\s*(?::|=|is\b)/i,
  /\bschool\s*[:=]\s*\S/i,
  /\bschool\s+name\s*(?::|=|is\b)/i,
  /\b(?:exact\s+)?age\s*[:=]\s*\d+\b/i,
  /\baged\s+\d+\b/i,
  /\b(?:home\s+)?address\s*(?::|=|is\b)/i,
  /\b(?:photo|picture|image|recording|audio clip|video)\s*(?:of\s+(?:my|the|a)\s+(?:child|student|kid)|attached\b|included\b|uploaded\b|:)/i,
];

export default function TrumpetInterestForm() {
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const values = Object.fromEntries(data.entries()) as Record<string, string>;
    const freeText = `${values.interest || ""} ${values.notes || ""}`;
    if (prohibitedChildDetails.some((pattern) => pattern.test(freeText))) {
      setStatus(
        "Please remove child identifiers, school details, addresses, photos, or recordings before preparing your note.",
      );
      setDraft("");
      return;
    }
    const body = `Adult name: ${values.name}\nEmail: ${values.email}\nRole: ${values.role}\nStudent experience: ${values.experience}\nInterest: ${values.interest}\nOptional notes: ${values.notes || "None"}\n\nI understand this is non-binding interest, not enrollment.`;
    setDraft(
      `mailto:${recipient}?subject=${encodeURIComponent("Trumpet Trainer pilot interest")}&body=${encodeURIComponent(body)}`,
    );
    setStatus(
      "Your note is ready. Open it in your email app, review it, and send it if you choose. Nothing has been sent by this website.",
    );
  }

  return (
    <div
      id="interest"
      className="scroll-mt-28 rounded-3xl border border-radiant-gold/30 bg-card p-6 shadow-xl sm:p-8"
    >
      <span className="font-heading text-xs uppercase tracking-widest text-radiant-gold">
        Adult tester interest
      </span>
      <h2 className="mt-3 font-premium text-3xl">
        Tell us what you would want to test.
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This review form builds an email draft on your device. It does not send,
        save, or enroll anyone. Please keep child details out of every field.
      </p>
      <Link
        href="/work/trumpet-trainer/recruitment"
        className="mt-5 inline-flex min-h-12 max-w-full items-center gap-2 rounded-full border border-radiant-gold/60 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-radiant-gold hover:text-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold"
      >
        See the tester experience <ArrowRight aria-hidden="true" size={17} className="shrink-0" />
      </Link>
      <form
        onChange={() => {
          setDraft("");
          setStatus("");
        }}
        onSubmit={handleSubmit}
        className="mt-7 space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Your name
            <input
              required
              name="name"
              maxLength={80}
              autoComplete="name"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"
            />
          </label>
          <label className="block text-sm font-medium">
            Your email
            <input
              required
              name="email"
              type="email"
              maxLength={120}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"
            />
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Your role
            <select
              required
              name="role"
              defaultValue=""
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"
            >
              <option value="" disabled>
                Choose a role
              </option>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Approximate student experience
            <select
              required
              name="experience"
              defaultValue=""
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"
            >
              <option value="" disabled>
                Choose a range
              </option>
              {levels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          What interests you about testing?
          <textarea
            required
            name="interest"
            maxLength={500}
            rows={3}
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"
          />
        </label>
        <label className="block text-sm font-medium">
          Optional notes
          <textarea
            name="notes"
            maxLength={500}
            rows={2}
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-radiant-gold"
          />
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
          <input
            required
            name="adultConfirmation"
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-radiant-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold"
          />
          <span>
            I confirm I am an adult and have not included a child name, school
            name, exact age, address, photo, or recording in this note.
          </span>
        </label>
        <button
          type="submit"
          className="min-h-12 w-full rounded-full bg-radiant-gold px-6 py-3 font-semibold text-imperial-navy transition-colors hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold"
        >
          Prepare email draft
        </button>
      </form>
      {status && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-radiant-gold/30 p-4 text-sm leading-6"
        >
          {status}
        </p>
      )}
      {draft && (
        <a
          href={draft}
          className="mt-4 inline-flex min-h-12 items-center rounded-full border border-radiant-gold px-6 py-3 font-semibold text-radiant-gold hover:bg-radiant-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-radiant-gold"
        >
          Open email draft for {email}
        </a>
      )}
    </div>
  );
}
