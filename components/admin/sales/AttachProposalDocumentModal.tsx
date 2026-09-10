"use client";
import { useEffect, useRef, useState } from "react";
type Identity = {
  revision: string;
  pdf_url: string | null;
  contract_pdf_url: string | null;
};
export default function AttachProposalDocumentModal({
  proposalId,
  accessToken,
  onClose,
  onSuccess,
}: {
  proposalId: string;
  accessToken: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("strategy_report");
  const [role, setRole] = useState("supporting");
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<{
    document_identity: Identity;
    binding_eligible: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    setReview(null);
    setError("");
    if (!accessToken) {
      setError("Sign in before attaching a document.");
      return;
    }
    fetch(`/api/admin/proposals/${proposalId}/documents`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error || "Could not load document review.");
        if (active) setReview(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [proposalId, accessToken, revision]);
  const change = () => {
    requestId.current = null;
    setDone("");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || !review || !file || !accessToken) return;
    if (role !== "supporting" && !review.binding_eligible) {
      setError(
        "Primary and agreement PDFs require an unissued unsigned draft.",
      );
      return;
    }
    if (
      file.type !== "application/pdf" ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Select a PDF up to 10 MB.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title.trim());
      form.set(
        "document_type",
        role === "primary"
          ? "proposal_package"
          : role === "agreement"
            ? "other"
            : type,
      );
      form.set("binding_role", role);
      form.set("request_id", requestId.current);
      form.set("document_identity", JSON.stringify(review.document_identity));
      const r = await fetch(`/api/admin/proposals/${proposalId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(d.error || "Upload failed. Retry the same selection.");
      setDone(
        d.document?.is_current === false && role !== "supporting"
          ? "Upload already saved in history. Current documents are unchanged. Select Done to refresh the review."
          : `${role === "primary" ? "Primary proposal" : role === "agreement" ? "Reviewed agreement" : "Supporting document"} saved.${d.cleanup_pending ? " Temporary upload cleanup is pending." : ""}`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Save outcome unknown. Retry the same selection.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attach report or document"
        className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6"
      >
        <h3 className="text-lg font-semibold mb-4">
          Attach report or document
        </h3>
        {done ? (
          <>
            <p role="status" className="text-green-300 mb-4">
              {done}
            </p>
            <button
              className="w-full rounded-lg bg-blue-600 p-2"
              onClick={onSuccess}
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
              <label className="block">
                Document role
                <select
                  aria-label="Document role"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    change();
                  }}
                  className="block w-full bg-gray-800 rounded p-2 mt-1"
                >
                  <option value="supporting">Supporting attachment</option>
                  <option value="primary" disabled={!review?.binding_eligible}>
                    Primary proposal PDF
                  </option>
                  <option
                    value="agreement"
                    disabled={!review?.binding_eligible}
                  >
                    Reviewed customer agreement PDF
                  </option>
                </select>
              </label>
              {review && !review.binding_eligible && (
                <p className="text-xs text-gray-400">
                  Primary and agreement PDFs are locked after issuance, viewing
                  or signing.
                </p>
              )}
              <label className="block">
                Title
                <input
                  aria-label="Title"
                  value={title}
                  maxLength={200}
                  required
                  onChange={(e) => {
                    setTitle(e.target.value);
                    change();
                  }}
                  className="block w-full bg-gray-800 rounded p-2 mt-1"
                />
              </label>
              {role === "supporting" && (
                <label className="block">
                  Type
                  <select
                    aria-label="Type"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      change();
                    }}
                    className="block w-full bg-gray-800 rounded p-2 mt-1"
                  >
                    <option value="strategy_report">Strategy Report</option>
                    <option value="opportunity_quantification">
                      Opportunity Quantification
                    </option>
                    <option value="proposal_package">Proposal Package</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              )}
              <label className="block">
                PDF file (up to 10 MB)
                <input
                  aria-label="PDF file"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    change();
                  }}
                  className="block w-full min-w-0 text-sm mt-2"
                />
              </label>
            </fieldset>
            {!review && !error && <p role="status">Loading document review…</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="flex-1 rounded-lg bg-gray-800 p-2"
              >
                Cancel
              </button>
              <button
                disabled={busy || !review || !file || !title.trim()}
                type="submit"
                className="flex-1 rounded-lg bg-blue-600 p-2 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Upload"}
              </button>
            </div>
            {error && (
              <div role="alert" className="text-sm text-red-300 break-words">
                {error}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRevision((n) => n + 1);
                  }}
                  className="block underline mt-1"
                >
                  Reload document review
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
