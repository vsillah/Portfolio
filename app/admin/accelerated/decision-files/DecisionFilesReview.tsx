"use client";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Breadcrumbs from "@/components/admin/Breadcrumbs";
import { fetchWithSessionRecovery } from "@/lib/authenticated-fetch";
import { lessons } from "@/lib/accelerated-decision-file";
import { AGENTIFIED_VERSION, agentifiedLessons } from "@/lib/agentified-workshop";
import { catalogOfferHref } from "@/lib/accelerated-service-review";

type Item = {
  id: string;
  content_version?: string;
  learner_name: string;
  learner_email: string;
  answers: Record<string, string>;
  submitted_at: string;
  review_status: string;
  linked_audit_id: number | null;
  review_note: string | null;
  candidates: {
    id: string | number;
    kind: "service" | "product";
    title: string;
    reason: string;
  }[];
  approvedOfferKeys?: string[];
};
const fixtureItems: Item[] = [
  { id: "11111111-1111-4111-8111-111111111111", learner_name: "Synthetic Learner A", learner_email: "learner-a@example.invalid", answers: { L01: "Our team needs an intake workflow.", L02: "Test the intake handoff." }, submitted_at: "2026-11-05T12:00:00Z", review_status: "pending", linked_audit_id: null, review_note: null, candidates: [{ id: "synthetic-service", kind: "service", title: "Intake workflow workshop", reason: "Shared topics: intake, workflow" }] },
  { id: "33333333-3333-4333-8333-333333333333", learner_name: "Synthetic Learner B", learner_email: "learner-b@example.invalid", answers: { L03: "Map a local decision before taking action." }, submitted_at: "2026-11-05T12:05:00Z", review_status: "pending", linked_audit_id: null, review_note: null, candidates: [] },
];
export default function DecisionFilesReview({ fixture = false }: { fixture?: boolean }) {
  const [items, setItems] = useState<Item[]>(fixture ? fixtureItems : []);
  const [showEmpty, setShowEmpty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [auditIds, setAuditIds] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    if (fixture) return;
    const response = await fetchWithSessionRecovery(
      "/api/admin/accelerated/decision-files",
    );
    if (!response?.ok) {
      setError("Could not load the protected review queue.");
      return;
    }
    const data = await response.json();
    setItems(data.items);
    setError("");
  }, [fixture]);
  useEffect(() => {
    if (!fixture) void load();
  }, [fixture, load]);
  const save = async (item: Item, status: string) => {
    if (fixture) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, review_status: status, review_note: notes[item.id] ?? entry.review_note, linked_audit_id: status === "linked" ? Number(auditIds[item.id]) : entry.linked_audit_id } : entry));
      return;
    }
    setBusy(item.id);
    const response = await fetchWithSessionRecovery(
      "/api/admin/accelerated/decision-files",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status,
          note: notes[item.id] ?? item.review_note ?? "",
          auditId: auditIds[item.id],
        }),
      },
    );
    if (!response?.ok) {
      const data = await response?.json();
      setError(data?.error || "Could not save the review.");
      setBusy("");
      return;
    }
    await load();
    setBusy("");
  };
  const approveOffer = async (item: Item, candidate: Item['candidates'][number]) => {
    if (fixture) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, approvedOfferKeys: [...(entry.approvedOfferKeys ?? []), `${candidate.kind}:${candidate.id}`] } : entry));
      return;
    }
    setBusy(item.id);
    const response = await fetchWithSessionRecovery('/api/admin/accelerated/decision-files', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, kind: candidate.kind, offerId: candidate.id }),
    });
    if (!response?.ok) {
      const result = await response?.json();
      setError(result?.error || 'Could not approve recommendation.');
    } else { setError(''); await load(); }
    setBusy('');
  };
  const content = (
      <main className="mx-auto max-w-6xl px-4 py-8 text-foreground">
        <Breadcrumbs
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Workshop files" },
          ]}
        />
        <h1 className="text-3xl font-semibold mt-6">
          Workshop files for review
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Learner evidence for human review. Match an existing offer only when
          the fit is supported. Assessment scores are handled separately.
        </p>
        {fixture && <div className="mt-4 rounded border border-amber-500 p-3 text-sm" role="status">Synthetic development fixture · No data is fetched or saved. Candidate names are examples; external actions remain outside this review. <button className="underline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => setShowEmpty((value) => !value)}>{showEmpty ? "Show review queue" : "Show empty queue"}</button></div>}
        {error && (
          <p role="alert" className="mt-4 text-red-600">
            {error}
          </p>
        )}
        {(showEmpty || items.length === 0) && (
          <p className="mt-8">
            No workshop files are waiting. Refresh after a learner sends one.
          </p>
        )}
        <div className="mt-5 space-y-5">
          {!showEmpty && items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{item.learner_name}</h2>
                  <p className="text-sm">{item.learner_email}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.content_version === AGENTIFIED_VERSION ? 'Agentified Operating File' : 'Accelerated Decision File'}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.review_status} ·{" "}
                  {new Date(item.submitted_at).toLocaleString()}
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer font-medium">
                  Read learner file
                </summary>
                <div className="mt-3 space-y-4">
                  {(item.content_version === AGENTIFIED_VERSION ? agentifiedLessons.map((lesson) => ({ id: lesson.id, artifact: lesson.outputs.join(' + ') })) : lessons).map(
                    (lesson) =>
                      item.answers[lesson.id]?.trim() && (
                        <section key={lesson.id}>
                          <h3 className="font-semibold">
                            {lesson.id} · {lesson.artifact}
                          </h3>
                          <p className="whitespace-pre-wrap text-sm">
                            {item.answers[lesson.id]}
                          </p>
                        </section>
                      ),
                  )}
                </div>
              </details>
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="font-semibold">Catalog candidates for review</h3>
                {item.candidates.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {item.candidates.map((candidate) => (
                      <li key={`${candidate.kind}-${candidate.id}`} className="flex flex-wrap items-center gap-2">
                        {catalogOfferHref(candidate) ? <a
                          className="underline"
                          href={catalogOfferHref(candidate)!}
                        >
                          {candidate.title}
                        </a> : <span>{candidate.title} (example)</span>}{" "}
                        · {candidate.reason}
                        <button type="button" className="admin-console-button-secondary min-h-9 disabled:opacity-50"
                          disabled={busy === item.id || item.review_status !== 'linked' || !!item.approvedOfferKeys?.includes(`${candidate.kind}:${candidate.id}`)}
                          title={item.review_status !== 'linked' ? 'Attach a verified assessment first' : undefined}
                          onClick={() => void approveOffer(item, candidate)}>
                          {item.approvedOfferKeys?.includes(`${candidate.kind}:${candidate.id}`) ? 'Approved for member' : 'Approve for member'}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No supported catalog match yet. Review the full service
                    catalog before choosing a next step.
                  </p>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Review note
                  <textarea
                    className="mt-1 block min-h-20 w-full rounded border border-border bg-background p-2"
                    value={notes[item.id] ?? item.review_note ?? ""}
                    onChange={(e) =>
                      setNotes((current) => ({
                        ...current,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-sm">
                  Existing assessment audit ID
                  <input
                    className="mt-1 block w-full rounded border border-border bg-background p-2"
                    inputMode="numeric"
                    value={
                      auditIds[item.id] ?? String(item.linked_audit_id ?? "")
                    }
                    onChange={(e) =>
                      setAuditIds((current) => ({
                        ...current,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    Create or verify the assessment in{" "}
                    <a className="underline" href="/admin/sales">
                      Sales
                    </a>
                    , then attach its audit ID here. The linked contact email
                    must match this learner.
                  </span>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="admin-console-button-secondary min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy === item.id}
                  onClick={() => save(item, "reviewing")}
                >
                  Mark reviewing
                </button>
                <button
                  className="admin-console-button-primary min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    busy === item.id ||
                    !(auditIds[item.id] ?? item.linked_audit_id)
                  }
                  title={!(auditIds[item.id] ?? item.linked_audit_id) ? "Enter an existing assessment audit ID first" : undefined}
                  onClick={() => save(item, "linked")}
                >
                  Attach assessment
                </button>
                <button
                  className="admin-console-button-secondary min-h-10 border-amber-500/60 text-amber-700 dark:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy === item.id}
                  onClick={() => save(item, "closed")}
                >
                  Close review
                </button>
              </div>
              {!(auditIds[item.id] ?? item.linked_audit_id) && <p className="mt-2 text-xs text-muted-foreground">To attach an assessment, enter a verified existing audit ID above.</p>}
            </article>
          ))}
        </div>
      </main>
  );
  return fixture ? content : <ProtectedRoute>{content}</ProtectedRoute>;
}
