const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const base = new URL(process.env.QA_BASE_URL || "http://localhost:3187");
if (!["localhost", "127.0.0.1"].includes(base.hostname))
  throw Error(
    "Synthetic QA requires a local base URL; hosted auth bypass is not supported.",
  );
const sweep = process.env.QA_SCREENSHOTS === "true";
const mobile = process.env.QA_MOBILE === "true";
const widths = mobile ? [390, 360] : [1440, 768];
const out = path.resolve(
  "local-private/document-roles" + (mobile ? "/mobile" : ""),
);
fs.mkdirSync(out, { recursive: true });
const sid = "11111111-1111-4111-8111-111111111111";
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: mobile ? 390 : 1440, height: 1000 },
    ...(sweep
      ? {}
      : {
          recordVideo: {
            dir: out,
            size: { width: mobile ? 390 : 1440, height: 1000 },
          },
        }),
  });
  const external = [],
    writes = [],
    publicReads = [];
  let docs = [],
    eligible = true,
    failNext = false;
  const identity = {
    revision: "44444444-4444-4444-8444-444444444444",
    pdf_url: null,
    contract_pdf_url: null,
  };
  const pdf = await require("pdf-lib").PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  await context.addInitScript(() => {
    const b = (s) => btoa(JSON.stringify(s));
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token: `${b({ alg: "HS256" })}.${b({ sub: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic`,
        refresh_token: "synthetic",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          email: "operator@example.invalid",
          role: "authenticated",
          app_metadata: { role: "admin" },
          user_metadata: {},
        },
      }),
    );
  });
  const contact = {
    id: 42,
    name: "Synthetic Reviewer",
    email: "reviewer@example.invalid",
    company: "Synthetic Practice",
  };
  const session = {
    id: sid,
    contact_submission_id: 42,
    diagnostic_audit_id: 42,
    products_presented: [],
    funnel_stage: "prospect",
    client_name: contact.name,
  };
  const proposal = {
    id: "22222222-2222-4222-8222-222222222222",
    status: "draft",
    client_name: contact.name,
    client_company: contact.company,
    bundle_name: "Fictional workflow design",
    total_amount: 997,
    line_items: [
      {
        title: "Fictional workflow prototype",
        price: 997,
        description:
          "Editable tracker and review guide using fictional records.",
      },
    ],
    terms_text:
      "Deliverables\n1  Editable fictional tracker.\n2  Review guide and walkthrough.\nPayment terms\nFixed fee $997. Deposit $498.50 after written agreement before kickoff. Balance $498.50 after delivery acceptance.\nSchedule\nAbout 10 business days after agreed kickoff.\nScope\n- Fictional data only.\n- No live messaging.",
    valid_until: null,
    access_code: null,
    pdf_url: null,
  };
  await context.route("**/*", async (r) => {
    const u = new URL(r.request().url()),
      p = u.pathname;
    const json = (d) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(d) });
    if (!["localhost", "127.0.0.1"].includes(u.hostname)) {
      external.push(u.origin);
      return r.abort();
    }
    if (u.port === "55999")
      return json(
        p.includes("/auth/")
          ? {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              email: "operator@example.invalid",
            }
          : [{ role: "admin" }],
      );
    if (p === "/__synthetic_document.pdf")
      return r.fulfill({ contentType: "application/pdf", body: bytes });
    if (p.match(/^\/api\/admin\/proposals\/[^/]+\/documents$/)) {
      if (r.request().method() === "GET")
        return json({
          documents: docs,
          document_identity: identity,
          binding_eligible: eligible,
        });
      if (r.request().method() === "POST") {
        const body = r.request().postDataBuffer().toString();
        const field = (name) =>
          body
            .split('name="' + name + '"')[1]
            ?.split("\r\n\r\n")[1]
            ?.split("\r\n")[0];
        writes.push({
          method: "POST",
          path: p,
          role: field("binding_role"),
          requestId: field("request_id"),
          mocked: true,
        });
        if (failNext) {
          failNext = false;
          return r.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error:
                "Synthetic retry: save outcome unknown. Retry the same selection.",
            }),
          });
        }
        const role = field("binding_role");
        const doc = {
          id: field("request_id"),
          title: field("title"),
          document_type: field("document_type"),
          binding_role: role,
          current_role: role === "supporting" ? null : role,
          display_order: docs.length,
          created_at: new Date().toISOString(),
          signedUrl: base.origin + "/__synthetic_document.pdf",
        };
        if (!docs.some((d) => d.id === doc.id)) docs.push(doc);
        return json({ document: doc });
      }
    }
    if (
      p.match(/^\/api\/admin\/proposals\/[^/]+\/documents\/[^/]+$/) &&
      r.request().method() === "DELETE"
    ) {
      const id = p.split("/").pop();
      docs = docs.filter((d) => d.id !== id);
      writes.push({ method: "DELETE", path: p, mocked: true });
      return json({ success: true });
    }
    if (p.startsWith("/api/") && r.request().method() !== "GET") {
      writes.push(p);
      return json({});
    }
    if (p === "/api/proposals")
      return json({
        proposal:
          u.searchParams.get("sales_session_id") === sid ? proposal : null,
      });
    if (p.startsWith("/api/proposals/")) {
      publicReads.push(p);
      return json({});
    }
    if (p === "/api/admin/sales/sessions") return json({ sessions: [session] });
    if (p === "/api/admin/sales")
      return json({
        audits: [
          {
            id: 42,
            status: "completed",
            contact_submission_id: 42,
            contact_submissions: contact,
            business_challenges: [],
            tech_stack: [],
            automation_needs: [],
            ai_readiness: "beginner",
            budget_timeline: {},
            decision_making: {},
            diagnostic_data: {},
          },
        ],
      });
    if (p === "/api/admin/outreach/leads/42") return json(contact);
    if (p === "/api/admin/sales/products") return json({ content: [] });
    if (p === "/api/admin/sales/scripts") return json({ scripts: [] });
    if (p === "/api/admin/sales/bundles") return json({ bundles: [] });
    if (p.startsWith("/api/"))
      return json({
        tasks: [],
        meetings: [],
        reports: [],
        sessions: [],
        audits: [],
        data: [],
      });
    return r.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const marks = [];
  const started = Date.now();
  const hold = async (label, ms = 1800) => {
    marks.push({ label, seconds: (Date.now() - started) / 1000 });
    await page.waitForTimeout(sweep ? 0 : ms);
  };
  async function attach() {
    await page
      .getByRole("button", {
        name: "Attach report or document (PDF)",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog", { name: "Attach report or document", exact: true })
      .waitFor();
  }
  const dialog = () =>
    page.getByRole("dialog", {
      name: "Attach report or document",
      exact: true,
    });
  async function bounds() {
    const issues = await dialog().evaluate((el) => {
      const b = el.getBoundingClientRect();
      return {
        outside:
          b.left < 0 ||
          b.right > innerWidth ||
          b.top < 0 ||
          b.bottom > innerHeight,
        overflow: el.scrollWidth > el.clientWidth + 2,
      };
    });
    if (issues.outside || issues.overflow) throw Error(JSON.stringify(issues));
  }
  for (const width of sweep ? widths : [mobile ? 390 : 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base.origin + `/admin/sales/conversation/${sid}`);
    await page.getByRole("button", { name: /Open proposal panel/ }).click();
    await page.getByText("Expiry: No expiry", { exact: true }).waitFor();
    await hold("Native proposal and documents drawer");
    for (const role of ["supporting", "primary", "agreement"]) {
      await attach();
      await dialog()
        .getByLabel("Title", { exact: true })
        .fill(
          "Synthetic " + role + " document with a readable descriptive title",
        );
      await dialog().getByLabel("Document role").selectOption(role);
      if (role === "supporting")
        await dialog()
          .getByLabel("Type", { exact: true })
          .selectOption("other");
      await dialog().getByLabel("PDF file", { exact: true }).setInputFiles({
        name: "synthetic.pdf",
        mimeType: "application/pdf",
        buffer: bytes,
      });
      await bounds();
      await page.screenshot({ path: out + `/role-${role}-${width}.png` });
      await hold("Choose " + role + " role");
      if (role === "agreement") {
        failNext = true;
        await dialog()
          .getByRole("button", { name: "Upload", exact: true })
          .click();
        await dialog().getByRole("alert").waitFor();
        await hold("Ambiguous response with same-request retry");
        await dialog()
          .getByRole("button", { name: "Reload document review" })
          .click();
        await dialog().getByLabel("Title", { exact: true }).waitFor();
      }
      await dialog()
        .getByRole("button", { name: "Upload", exact: true })
        .click();
      await dialog().getByRole("status").waitFor();
      await hold(role + " saved receipt");
      await dialog().getByRole("button", { name: "Done", exact: true }).click();
    }
    await page.getByText("Reviewed agreement", { exact: true }).waitFor();
    await page.screenshot({ path: out + `/drawer-${width}.png` });
    await hold("Bound roles and retained history");
    // Every changed action: read document link, supporting removal, locked role + reload + cancel.
    const link = page
      .getByRole("link", { name: /Synthetic supporting document/ })
      .first();
    const [tab,response] = await Promise.all([
      context.waitForEvent("page"),
      context.waitForEvent("response", {predicate:r=>r.url()===base.origin+"/__synthetic_document.pdf"}),
      link.click(),
    ]);
    if(response.status()!==200 || !response.headers()["content-type"].includes("application/pdf"))throw Error("Document read failed");
    await tab.close();
    await page
      .getByRole("button", { name: "Remove document", exact: true })
      .first()
      .click();
    eligible = false;
    await attach();
    await dialog()
      .getByText(/locked after issuance/)
      .waitFor();
    await bounds();
    await page.screenshot({ path: out + `/locked-${width}.png` });
    await hold("Issued or signed role selection locked");
    await dialog().getByRole("button", { name: "Cancel" }).click();
    eligible = true;
  }
  if (errors.length || publicReads.length)
    throw Error(JSON.stringify({ errors, publicReads }));
  const video = sweep ? null : await page.video().path();
  await context.close();
  await browser.close();
  if (video)
    require("node:child_process").execFileSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(marks[0].seconds),
        "-i",
        video,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        out + "/proposal-document-roles.mp4",
      ],
      { stdio: "ignore" },
    );
  fs.writeFileSync(
    out + (sweep ? "/screenshot-evidence.json" : "/evidence.json"),
    JSON.stringify(
      {
        marks,
        externalRequests: [],
        blockedExternalRequests: external,
        writes,
        publicReads,
        pageErrors: errors,
        scope:
          "Local actual conversation route; all API writes mocked; synthetic PDF only",
        widths: sweep ? widths : [mobile ? 390 : 1440],
      },
      null,
      2,
    ),
  );
  console.log("PASS", out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
