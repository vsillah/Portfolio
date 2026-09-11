import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import Modal from "./AttachProposalDocumentModal";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const props = {
  proposalId: "synthetic",
  accessToken: "synthetic",
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};
const state = {
  binding_eligible: true,
  document_identity: {
    revision: "44444444-4444-4444-8444-444444444444",
    pdf_url: null,
    contract_pdf_url: null,
  },
};
it("reuses request identity after ambiguous failure and shows explicit receipt", async () => {
  const requests: FormData[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      if (!init.method) return { ok: true, json: async () => state };
      requests.push(init.body);
      return requests.length === 1
        ? {
            ok: false,
            json: async () => ({ error: "Retry the same selection" }),
          }
        : { ok: true, json: async () => ({ document: { id: "saved" } }) };
    }),
  );
  render(<Modal {...props} />);
  await waitFor(() =>
    expect(
      screen.getByRole("option", { name: "Primary proposal PDF" }),
    ).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Document role"), {
    target: { value: "primary" },
  });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Synthetic" },
  });
  fireEvent.change(screen.getByLabelText("PDF file"), {
    target: {
      files: [new File(["%PDF-"], "a.pdf", { type: "application/pdf" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await screen.findByRole("status");
  expect(requests[0].get("request_id")).toBe(requests[1].get("request_id"));
  expect(requests[1].get("binding_role")).toBe("primary");
  expect(props.onSuccess).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(props.onSuccess).toHaveBeenCalledOnce();
});
it("locks role options on issued proposal while keeping ordinary attachments", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...state, binding_eligible: false }),
    })),
  );
  render(<Modal {...props} />);
  await screen.findByText(/locked after issuance/);
  expect(
    screen.getByRole("option", { name: "Primary proposal PDF" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("option", { name: "Reviewed customer agreement PDF" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("option", { name: "Supporting attachment" }),
  ).not.toBeDisabled();
});
it("prevents double submit and cancel during pending upload", async () => {
  let release!: (v: any) => void;
  const fetcher = vi.fn(async (_url, init) =>
    !init.method
      ? { ok: true, json: async () => state }
      : new Promise((r) => {
          release = r;
        }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<Modal {...props} />);
  await waitFor(() =>
    expect(
      screen.getByRole("option", { name: "Primary proposal PDF" }),
    ).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Synthetic" },
  });
  fireEvent.change(screen.getByLabelText("PDF file"), {
    target: {
      files: [new File(["%PDF-"], "a.pdf", { type: "application/pdf" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(2);
  release({ ok: true, json: async () => ({}) });
  await screen.findByRole("status");
});
it("historical replay never claims the old PDF is current", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => ({
      ok: true,
      json: async () =>
        init.method ? { document: { is_current: false } } : state,
    })),
  );
  render(<Modal {...props} />);
  await waitFor(() =>
    expect(
      screen.getByRole("option", { name: "Primary proposal PDF" }),
    ).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Document role"), {
    target: { value: "primary" },
  });
  expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Synthetic" },
  });
  fireEvent.change(screen.getByLabelText("PDF file"), {
    target: {
      files: [new File(["%PDF-"], "a.pdf", { type: "application/pdf" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Current documents are unchanged",
  );
});
