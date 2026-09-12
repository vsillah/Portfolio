import { supabaseAdmin } from "@/lib/supabase";

export const DOCUMENT_ROLES = ["supporting", "primary", "agreement"] as const;
export const PDF_LIMIT = 10 * 1024 * 1024;
export const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type DocumentIdentity = {
  revision: string;
  pdf_url: string | null;
  contract_pdf_url: string | null;
};
export function validDocumentIdentity(
  value: unknown,
): value is DocumentIdentity {
  if (!value || typeof value !== "object") return false;
  if (!UUID.test(String((value as Record<string, unknown>).revision ?? "")))
    return false;
  return ["pdf_url", "contract_pdf_url"].every(
    (key) =>
      key in value &&
      ((value as Record<string, unknown>)[key] === null ||
        typeof (value as Record<string, unknown>)[key] === "string"),
  );
}
export function documentIdentity(p: {
  document_revision?: string;
  pdf_url?: string | null;
  contract_pdf_url?: string | null;
}): DocumentIdentity {
  return {
    revision: p.document_revision ?? "",
    pdf_url: p.pdf_url ?? null,
    contract_pdf_url: p.contract_pdf_url ?? null,
  };
}
/** Resolve only our immutable Storage references; legacy issued URLs remain compatible. */
export async function proposalDocumentReadback<
  T extends {
    id: string;
    document_revision?: string;
    pdf_url?: string | null;
    contract_pdf_url?: string | null;
  },
>(p: T) {
  const identity = documentIdentity(p);
  const resolve = async (url: string | null) => {
    if (!url?.startsWith("storage:")) return url;
    const prefix = `storage:documents/proposal-docs/${p.id}/`;
    if (
      !url.startsWith(prefix) ||
      !/^[a-f0-9-]{36}\.pdf$/.test(url.slice(prefix.length))
    )
      throw new Error("Invalid stored document reference");
    const { data, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(url.slice("storage:documents/".length), 3600);
    if (error || !data?.signedUrl)
      throw new Error("Document unavailable. Reload to retry.");
    return data.signedUrl;
  };
  return {
    ...p,
    document_identity: identity,
    pdf_url: await resolve(identity.pdf_url),
    contract_pdf_url: await resolve(identity.contract_pdf_url),
  };
}
export function documentRpcStatus(code?: string) {
  return code === "P0002"
    ? 404
    : code === "22023"
      ? 400
      : code === "P0001"
        ? 409
        : 503;
}

export function isUnissuedBoundProposal(p: {
  access_code?: string | null;
  pdf_url?: string | null;
  contract_pdf_url?: string | null;
}) {
  return (
    !p.access_code &&
    [p.pdf_url, p.contract_pdf_url].some((url) =>
      url?.startsWith("storage:documents/"),
    )
  );
}

/** Mirrors delete_proposal_supporting_document; SQL remains authoritative on mutation. */
export function documentDeletionReason(
  proposal: {
    status?: string | null;
    pdf_url?: string | null;
    contract_pdf_url?: string | null;
    [key: string]: unknown;
  },
  doc: { binding_role?: string; file_path: string },
): string | null {
  if (
    proposal.status !== "draft" ||
    [
      "access_code",
      "sent_at",
      "viewed_at",
      "accepted_at",
      "paid_at",
      "signed_at",
      "contract_signed_at",
    ].some((key) => proposal[key] != null)
  )
    return "Removal locked after issuance, viewing or signing.";
  if (doc.binding_role !== "supporting")
    return "Primary and agreement history is retained.";
  const referenced = [proposal.pdf_url, proposal.contract_pdf_url].some(
    (url) =>
      url === "storage:documents/" + doc.file_path ||
      url?.split("?")[0].endsWith("/documents/" + doc.file_path),
  );
  return referenced
    ? "Referenced proposal and agreement PDFs are retained."
    : null;
}
