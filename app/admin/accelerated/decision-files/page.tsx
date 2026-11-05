"use client";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Breadcrumbs from "@/components/admin/Breadcrumbs";
import { fetchWithSessionRecovery } from "@/lib/authenticated-fetch";
import { lessons } from "@/lib/accelerated-decision-file";

type Item = {
  id: string;
  learner_name: string;
  learner_email: string;
  answers: Record<string, string>;
  submitted_at: string;
  review_status: string;
  linked_audit_id: number | null;
  review_note: string | null;
  candidates: {
    id: number;
    kind: "service" | "product";
    title: string;
    reason: string;
  }[];
};
export default function DecisionFilesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [auditIds, setAuditIds] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = async () => {
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
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (item: Item, status: string) => {
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
  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-8 text-foreground">
        <Breadcrumbs
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Accelerated decision files" },
          ]}
        />
        <h1 className="text-3xl font-semibold mt-6">
          Accelerated decision files
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Learner evidence for human review. Match an existing offer only when
          the fit is supported. Assessment scores are handled separately.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-red-600">
            {error}
          </p>
        )}
        {items.length === 0 && (
          <p className="mt-8">
            No decision files are waiting. Refresh after a learner sends one.
          </p>
        )}
        <div className="mt-5 space-y-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{item.learner_name}</h2>
                  <p className="text-sm">{item.learner_email}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.review_status} ·{" "}
                  {new Date(item.submitted_at).toLocaleString()}
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer font-medium">
                  Read learner decision file
                </summary>
                <div className="mt-3 space-y-4">
                  {lessons.map(
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
                      <li key={`${candidate.kind}-${candidate.id}`}>
                        <a
                          className="underline"
                          href={
                            candidate.kind === "service"
                              ? `/services/${candidate.id}`
                              : `/store/${candidate.id}`
                          }
                        >
                          {candidate.title}
                        </a>{" "}
                        · {candidate.reason}
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
                  disabled={busy === item.id}
                  onClick={() => save(item, "reviewing")}
                >
                  Mark reviewing
                </button>
                <button
                  disabled={
                    busy === item.id ||
                    !(auditIds[item.id] ?? item.linked_audit_id)
                  }
                  onClick={() => save(item, "linked")}
                >
                  Attach assessment
                </button>
                <button
                  disabled={busy === item.id}
                  onClick={() => save(item, "closed")}
                >
                  Close review
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </ProtectedRoute>
  );
}
