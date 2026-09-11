"use client";
import { RefreshCw, X, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
type Review = {
  enabled: boolean;
  amount: number;
  signed: boolean;
  document_identity: unknown;
  plan: null | {
    installments_paid: number;
    delivery_status: string;
    delivery_summary: string | null;
    delivery_revision: string | null;
    delivery_feedback: string | null;
  };
};
export default function MilestonePayments({
  proposalId,
  accessCode,
  token,
  adminToken,
}: {
  proposalId?: string;
  accessCode?: string;
  token?: string;
  adminToken?: string;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [data, setData] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [dashboard, setDashboard] = useState("");
  const url = token
    ? `/api/client/dashboard/${token}/milestones`
    : `/api/proposals/${proposalId}/milestones`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(adminToken
      ? { Authorization: `Bearer ${adminToken}` }
      : { "x-proposal-access": accessCode || "" }),
  };
  const load = useCallback(async () => {
    const r = await fetch(url, {
      headers: adminToken
        ? { Authorization: `Bearer ${adminToken}` }
        : { "x-proposal-access": accessCode || "" },
    });
    if (r.status === 404 && token) return;
    if (!r.ok) throw new Error("Payment status unavailable. Try refresh.");
    setData(await r.json());
  }, [url, adminToken, accessCode, token]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      const paying = action === "pay";
      const r = await fetch(
        paying && !token ? `/api/proposals/${proposalId}/accept` : url,
        {
          method: "POST",
          headers,
          body: JSON.stringify(
            paying
              ? token
                ? { action, document_identity: data?.document_identity }
                : { milestone: 1, document_identity: data?.document_identity }
              : { action, note, revision: data?.plan?.delivery_revision },
          ),
        },
      );
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Action unavailable");
      if (b.checkoutUrl) {
        window.location.assign(b.checkoutUrl);
        return;
      }
      setNote("");
      setRejecting(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry after refreshing");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!token && !adminToken && data?.plan?.installments_paid && proposalId) {
      fetch(`/api/proposals/${proposalId}/dashboard-link`, {
        headers: { "x-proposal-access": accessCode || "" },
      })
        .then((r) => r.json())
        .then((b) => setDashboard(b.dashboard_url || ""))
        .catch(() => setError("Dashboard link unavailable. Refresh to retry."));
    }
  }, [data, token, adminToken, proposalId, accessCode]);
  if (!data?.enabled && !adminToken)
    return error ? <p role="alert">{error}</p> : null;
  const count = data?.plan?.installments_paid || 0;
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(data?.amount || 0);
  const button =
    "rounded-lg border border-radiant-gold/25 px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <section
      aria-label="Milestone payments"
      className="my-6 rounded-xl border border-radiant-gold/25 bg-silicon-slate/60 text-platinum-white p-4 space-y-3 min-w-0 break-words"
    >
      <h2 className="font-semibold">Project payments</h2>
      {!data?.enabled ? (
        <button
          className={button}
          disabled={busy}
          onClick={() => act("configure")}
        >
          Use two equal milestone payments
        </button>
      ) : (
        <>
          <p>
            Initial {amount} ·{" "}
            {count > 0
              ? "Received"
              : "After both signatures, before agreed kickoff"}
          </p>
          <p>
            Final {amount} ·{" "}
            {count === 2 ? "Received" : "Due only after you accept delivery"}
          </p>
          <p className="text-sm">
            No recurring fee. Kickoff is agreed separately.
          </p>
          {count === 0 && !adminToken && (
            <button
              className={button}
              disabled={busy || !data.signed}
              onClick={() => act("pay")}
            >
              {data.signed
                ? `Pay initial ${amount}`
                : "Sign proposal and agreement first"}
            </button>
          )}
          {dashboard && (
            <a className="block underline" href={dashboard}>
              Open your client dashboard
            </a>
          )}
          {data.plan && (
            <p className="text-sm font-medium">
              {
                (
                  {
                    pending: "Delivery not yet submitted",
                    review: "Delivery awaiting client review",
                    changes_requested: "Corrections requested",
                    accepted: "Delivery accepted",
                  } as Record<string, string>
                )[data.plan.delivery_status]
              }
            </p>
          )}
          {data.plan?.delivery_summary && <p>{data.plan.delivery_summary}</p>}
          {data.plan?.delivery_status === "changes_requested" &&
            data.plan?.delivery_feedback && (
              <p>Corrections requested: {data.plan.delivery_feedback}</p>
            )}
          {adminToken &&
            count === 1 &&
            ["pending", "changes_requested"].includes(
              data.plan?.delivery_status || "",
            ) && (
              <>
                <label className="block">
                  Delivery evidence and acceptance criteria
                  <textarea
                    className="block w-full bg-transparent border rounded p-2"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={3000}
                  />
                </label>
                <button
                  className={button}
                  disabled={busy || !note.trim()}
                  onClick={() => act("submit")}
                >
                  Submit delivery for client review
                </button>
              </>
            )}
          {token &&
            data.plan?.delivery_status === "review" &&
            (rejecting ? (
              <div className="space-y-3">
                <label className="block">
                  Feedback (optional)
                  <textarea
                    className="block w-full bg-transparent border rounded p-2"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={3000}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={button + " text-red-300 border-red-500/50"}
                    disabled={busy}
                    onClick={() => act("reject")}
                  >
                    Submit correction request
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setRejecting(false);
                      setNote("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  className={
                    button +
                    " text-red-300 border-red-500/50 flex items-center gap-2"
                  }
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                >
                  <X size={16} />
                  Request corrections
                </button>
                <button
                  className={
                    button +
                    " bg-radiant-gold text-imperial-navy flex items-center gap-2"
                  }
                  disabled={busy}
                  onClick={() => act("accept")}
                >
                  <Check size={16} />
                  Delivery meets the agreed criteria
                </button>
              </div>
            ))}
          {token && count === 1 && (
            <button
              className={button}
              disabled={busy || data.plan?.delivery_status !== "accepted"}
              onClick={() => act("pay")}
            >
              {data.plan?.delivery_status === "accepted"
                ? `Pay final ${amount}`
                : "Final payment locked until delivery acceptance"}
            </button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            load()
              .then(() => setError(""))
              .catch((e) => setError(e.message))
          }
          title="Refresh payment status"
          aria-label="Refresh payment status"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </section>
  );
}
