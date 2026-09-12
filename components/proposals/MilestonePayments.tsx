"use client";
import { invoiceMilestoneNextStep } from "@/lib/proposal-invoice-milestones";
import {
  RefreshCw,
  X,
  Check,
  Receipt,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
type Review = {
  enabled: boolean;
  settlement_mode?: "stripe_checkout" | "manual_invoice";
  can_configure?: boolean;
  amount: number;
  signed: boolean;
  document_identity: { revision: string };
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
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
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
  async function act(
    action: string,
    settlement?: "stripe_checkout" | "manual_invoice",
  ) {
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
              : action === "configure"
                ? { action, settlement_mode: settlement || "stripe_checkout" }
                : action === "record_receipt"
                  ? {
                      action,
                      milestone: (data?.plan?.installments_paid || 0) + 1,
                      amount: Number(receiptAmount),
                      reference: receiptReference,
                      revision: data?.document_identity.revision,
                    }
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
      setReceiptReference("");
      setReceiptAmount("");
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
  const invoiceManaged = data?.settlement_mode === "manual_invoice";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(data?.amount || 0);
  const button =
    "inline-flex max-w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/20 px-4 py-2.5 text-sm font-medium leading-snug transition-colors hover:bg-radiant-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-imperial-navy disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";
  const field =
    "mt-2 block w-full min-w-0 rounded-lg border border-platinum-white/15 bg-imperial-navy/70 px-3 py-2.5 text-base font-normal leading-relaxed text-platinum-white shadow-inner outline-none transition-colors placeholder:text-platinum-white/30 focus:border-radiant-gold/60 focus:ring-2 focus:ring-radiant-gold/10";
  const refresh = (
    <button
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-platinum-white/10 text-platinum-white/50 transition-colors hover:border-radiant-gold/30 hover:bg-radiant-gold/5 hover:text-radiant-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold/60 disabled:opacity-40"
      disabled={busy}
      onClick={() =>
        load()
          .then(() => setError(""))
          .catch((e) => setError(e.message))
      }
      title="Refresh payment status"
      aria-label="Refresh payment status"
    >
      <RefreshCw size={15} aria-hidden="true" />
    </button>
  );
  return (
    <section
      aria-label="Milestone payments"
      className="my-6 min-w-0 space-y-5 break-words rounded-2xl border border-radiant-gold/15 bg-gradient-to-br from-silicon-slate/60 to-imperial-navy/80 p-5 text-platinum-white shadow-sm sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-radiant-gold/15 bg-radiant-gold/10 text-radiant-gold">
            <Receipt size={19} aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold tracking-wide">
            Project payments
          </h2>
        </div>
        {refresh}
      </div>
      {!data?.enabled ? (
        <div className="flex flex-wrap gap-3">
          <button
            className={button}
            disabled={busy}
            onClick={() => act("configure")}
          >
            Use two equal milestone payments
          </button>
          <button
            className={button}
            disabled={busy}
            onClick={() => act("configure", "manual_invoice")}
          >
            Use invoice-managed milestones
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
            {[
              {
                label: "Initial",
                received: count > 0,
                pending: "After both signatures, before agreed kickoff",
              },
              {
                label: "Final",
                received: count === 2,
                pending: "Due only after you accept delivery",
              },
            ].map(({ label, received, pending }) => (
              <div
                key={label}
                role="group"
                aria-label={`${label} ${amount} · ${received ? "Received" : pending}`}
                className="min-w-0 rounded-xl border border-platinum-white/10 bg-imperial-navy/35 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-platinum-white/55">
                    {label}
                  </p>
                  {received && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-medium leading-none text-emerald-200">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Received
                    </span>
                  )}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-platinum-white">
                  {amount}
                </p>
                {!received && (
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-platinum-white/60">
                    {pending}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-platinum-white/45">
            No recurring fee. Kickoff is agreed separately.
          </p>
          {adminToken && data.can_configure && (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                act(
                  "configure",
                  invoiceManaged ? "stripe_checkout" : "manual_invoice",
                )
              }
            >
              {invoiceManaged
                ? "Switch to milestone checkout"
                : "Use invoice-managed milestones"}
            </button>
          )}
          {invoiceManaged && (
            <p
              role="status"
              className="max-w-3xl border-l-2 border-radiant-gold/40 pl-4 text-sm leading-relaxed text-platinum-white/80"
            >
              {invoiceMilestoneNextStep(
                data.signed,
                count,
                data.plan?.delivery_status === "accepted",
                amount,
              )}
            </p>
          )}
          {invoiceManaged &&
            adminToken &&
            data.signed &&
            (count === 0 ||
              (count === 1 && data.plan?.delivery_status === "accepted")) && (
              <div className="space-y-4 rounded-xl border border-platinum-white/10 bg-imperial-navy/30 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Receipt
                    size={15}
                    className="text-radiant-gold/80"
                    aria-hidden="true"
                  />
                  Record a receipt
                </h3>
                <p className="text-xs leading-relaxed text-platinum-white/50">
                  Record only a verified invoice payment. This does not create
                  or send an invoice.
                </p>
                <label className="block text-xs font-medium text-platinum-white/65">
                  Receipt reference
                  <input
                    className={field}
                    value={receiptReference}
                    onChange={(e) => setReceiptReference(e.target.value)}
                    maxLength={200}
                  />
                </label>
                <label className="block text-xs font-medium text-platinum-white/65">
                  Amount received (USD)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={
                      field +
                      " [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    }
                    value={receiptAmount}
                    onChange={(e) => setReceiptAmount(e.target.value)}
                  />
                </label>
                <button
                  className={button + " bg-radiant-gold text-imperial-navy"}
                  disabled={
                    busy ||
                    receiptReference.trim().length < 3 ||
                    Number(receiptAmount) !== data.amount
                  }
                  onClick={() => act("record_receipt")}
                >
                  Record {count === 0 ? "initial" : "final"} receipt {amount}
                </button>
              </div>
            )}
          {count === 0 && !adminToken && !invoiceManaged && (
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
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/20 bg-radiant-gold/10 px-4 py-2.5 text-sm font-medium text-gold-light transition-colors hover:bg-radiant-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold/60"
              href={dashboard}
            >
              Open your client dashboard{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          )}
          {data.plan && (
            <p className="border-t border-platinum-white/10 pt-4 text-xs font-medium uppercase tracking-wide text-gold-light/75">
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
          {data.plan?.delivery_summary && (
            <p className="max-w-3xl text-sm leading-relaxed text-platinum-white/65">
              {data.plan.delivery_summary}
            </p>
          )}
          {data.plan?.delivery_status === "changes_requested" &&
            data.plan?.delivery_feedback && (
              <p className="rounded-lg border border-rose-300/15 bg-rose-300/5 p-3 text-sm leading-relaxed text-rose-100/80">
                Corrections requested: {data.plan.delivery_feedback}
              </p>
            )}
          {adminToken &&
            count === 1 &&
            ["pending", "changes_requested"].includes(
              data.plan?.delivery_status || "",
            ) && (
              <>
                <label className="block text-xs font-medium text-platinum-white/65">
                  Delivery evidence and acceptance criteria
                  <textarea
                    className={field}
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
                <label className="block text-xs font-medium text-platinum-white/65">
                  Feedback (optional)
                  <textarea
                    className={field}
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
          {token && count === 1 && !invoiceManaged && (
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
        <p
          role="alert"
          className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm leading-relaxed text-red-300"
        >
          {error}
        </p>
      )}
    </section>
  );
}
