// Local, fully intercepted public-page regression. No real proposal IDs or API calls.
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const base = new URL(process.env.QA_BASE_URL || "http://127.0.0.1:3187");
if (!["127.0.0.1", "localhost"].includes(base.hostname))
  throw Error("Local synthetic QA only");
const screenshots = process.env.QA_SCREENSHOTS === "true";
const out = path.resolve("local-private/document-roles/signature-conflict");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    ...(screenshots
      ? {}
      : { recordVideo: { dir: out, size: { width: 390, height: 900 } } }),
  });
  const external = [],
    requests = [],
    blocked = [],
    errors = [];
  let kind = "proposal",
    reads = 0;
  await context.route("**/*", (r) => {
    const u = new URL(r.request().url()),
      p = u.pathname;
    const json = (body, status = 200) =>
      r.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (!["localhost", "127.0.0.1"].includes(u.hostname)) {
      external.push(u.origin);
      return r.abort();
    }
    if (p.startsWith("/api/")) {
      if (p.startsWith("/api/proposals/by-code/SYNTHETIC-")) {
        reads++;
        requests.push({ path: p, method: "GET", mocked: true });
        return json({
          proposal: {
            id: "synthetic-proposal-only",
            client_name: "Synthetic Reviewer",
            client_email: "synthetic@example.invalid",
            bundle_name: "Synthetic reviewed package",
            status: "sent",
            line_items: [{ title: "Fictional workflow", price: 997 }],
            subtotal: 997,
            discount_amount: 0,
            total_amount: 997,
            terms_text: "Synthetic review context.\n".repeat(35),
            created_at: "2026-09-10T12:00:00Z",
            pdf_url: null,
            contract_pdf_url: "/synthetic-agreement.pdf",
            signed_at: kind === "contract" ? "2026-09-10T12:00:00Z" : null,
            document_identity: {
              revision:
                reads === 1
                  ? "44444444-4444-4444-8444-444444444444"
                  : "55555555-5555-4555-8555-555555555555",
              pdf_url: null,
              contract_pdf_url: "stable-synthetic-agreement",
            },
          },
          canAccept: true,
          canPay: false,
          isExpired: false,
          proposalDocuments: [],
        });
      }
      if (
        p === "/api/proposals/synthetic-proposal-only/sign" ||
        p === "/api/proposals/synthetic-proposal-only/sign-contract"
      ) {
        requests.push({ path: p, method: "POST", mocked: true });
        return json(
          {
            error: "Documents changed. Reload and review before signing.",
            reload_required: true,
          },
          409,
        );
      }
      if (r.request().method() !== "GET") {
        blocked.push(p);
        return r.abort();
      }
      return json({});
    }
    if (u.port === "55999") return json({});
    return r.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const marks = [];
  const start = Date.now();
  const hold = async (label) => {
    marks.push({ label, seconds: (Date.now() - start) / 1000 });
    if (!screenshots) await page.waitForTimeout(2500);
  };
  for (const width of screenshots ? [360, 390, 768, 1440] : [390]) {
    await page.setViewportSize({ width, height: 900 });
    for (kind of ["proposal", "contract"]) {
      reads = 0;
      await page.goto(base.origin + "/proposal/SYNTHETIC-" + kind);
      const open = page.getByRole("button", {
        name: kind === "proposal" ? "Sign & Accept Proposal" : "Sign Contract",
        exact: true,
      });
      await open.click();
      await page.getByPlaceholder("Your full name").fill("Synthetic Signer");
      const action = page.getByRole("button", {
        name: kind === "proposal" ? "Sign & Accept" : "Sign Contract",
        exact: true,
      });
      await action.scrollIntoViewIfNeeded();
      await hold(kind + " signing action");
      await action.click();
      const feedback = page.getByRole("alert", {
        name:
          kind === "proposal"
            ? "Proposal signature error"
            : "Agreement signature error",
      });
      await feedback.waitFor();
      const state = await feedback.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          focused: document.activeElement === el,
          top: r.top,
          bottom: r.bottom,
          height: innerHeight,
        };
      });
      if (!state.focused || state.top < 0 || state.bottom > state.height)
        throw Error(JSON.stringify(state));
      if(await page.getByRole('alert').filter({hasText:'Documents changed. Reload and review before signing.'}).count() !== 1)throw Error('Duplicate conflict feedback');
      await page.screenshot({ path: out + `/${kind}-${width}.png` });
      await hold(kind + " inline focused conflict");
      await feedback.getByRole("button", { name: "Reload documents" }).click();
      await open.click();
      if ((await page.getByPlaceholder("Your full name").inputValue()) !== "")
        throw Error("Signer name retained after reload");
      await hold(kind + " fresh review clears signer input");
    }
  }
  if (blocked.length || errors.length)
    throw Error(JSON.stringify({ blocked, errors }));
  const video = screenshots ? null : await page.video().path();
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
        out + "/signature-conflict.mp4",
      ],
      { stdio: "ignore" },
    );
  fs.writeFileSync(
    out + (screenshots ? "/screenshots.json" : "/evidence.json"),
    JSON.stringify(
      {
        externalRequests: [],
        blockedExternalRequests: external,
        requests,
        blocked,
        pageErrors: errors,
        marks,
        scope:
          "Local public page, synthetic code/non-real ID, all API calls intercepted; accept/checkout/provider writes prohibited",
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
