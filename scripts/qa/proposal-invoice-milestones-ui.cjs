const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const base = new URL(process.env.QA_BASE_URL || "http://127.0.0.1:3188");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const out = require("node:path").resolve("local-private/invoice-milestone-qa");
fs.mkdirSync(out, { recursive: true });
const id = "11111111-1111-4111-8111-111111111111",
  code = "A".repeat(48),
  token = "B".repeat(64);
(async () => {
  const browser = await chromium.launch();
  for (const width of [1440, 390, 360, 768]) {
    let proposalSigned = false,
      contractSigned = false,
      paid = 0,
      delivery = "review",
      feedback = "",
      stale = true;
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      recordVideo: { dir: out, size: { width, height: 900 } },
    });
    const page = await ctx.newPage();
    const marks = [];
    const started = Date.now();
    const hold = async (label) => {
      marks.push({ label, seconds: (Date.now() - started) / 1000 });
      await page.waitForTimeout(3000);
    };
    const checkoutRequests = [];
    const errors = [],
      blocked = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const identity = {
      revision: "22222222-2222-4222-8222-222222222222",
      pdf_url: "synthetic.pdf",
      contract_pdf_url: "synthetic-agreement.pdf",
    };
    const state = () => ({
      enabled: true,
      settlement_mode: "manual_invoice",
      amount: 498.5,
      signed: proposalSigned && contractSigned,
      document_identity: identity,
      plan: paid
        ? {
            installments_paid: paid,
            delivery_status: delivery,
            delivery_revision: identity.revision,
            delivery_summary:
              "Five fictional cases demonstrated against the written acceptance criteria.",
            delivery_feedback: feedback,
          }
        : null,
    });
    await ctx.route("**/*", (r) => {
      const u = new URL(r.request().url()),
        p = u.pathname;
      const json = (b, status = 200) =>
        r.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(b),
        });
      if (u.origin !== base.origin) {
        blocked.push(u.origin);
        return r.abort();
      }
      if (!p.startsWith("/api/")) return r.continue();
      if (p.includes("/by-code/"))
        return json({
          proposal: {
            id,
            client_name: "Synthetic Reviewer",
            client_email: "qa@example.invalid",
            bundle_name: "Follow-up workflow prototype",
            status: paid === 2 ? "paid" : "sent",
            payment_schedule: "milestones",
            milestone_settlement: "manual_invoice",
            line_items: [
              { title: "One fictional referral workflow", price: 997 },
            ],
            subtotal: 997,
            total_amount: 997,
            discount_amount: 0,
            created_at: "2026-09-10",
            terms_text:
              "One workflow using fictional cases. $498.50 after both signatures before agreed kickoff; $498.50 only after accepted delivery. No recurring fee.",
            pdf_url: null,
            contract_pdf_url: "/synthetic-agreement.pdf",
            signed_at: proposalSigned ? "2026-09-10" : null,
            contract_signed_at: contractSigned ? "2026-09-10" : null,
            document_identity: identity,
          },
          canAccept: true,
          canPay: true,
          isExpired: false,
          proposalDocuments: [],
        });
      if (p.endsWith("/sign") || p.endsWith("/sign-contract")) {
        if (stale) {
          stale = false;
          return json(
            { error: "Documents changed. Reload and review before signing." },
            409,
          );
        }
        if (p.endsWith("/sign-contract")) contractSigned = true;
        else proposalSigned = true;
        return json({ success: true });
      }
      if (p.endsWith("/milestones")) {
        if (r.request().method() === "GET") return json(state());
        const b = r.request().postDataJSON();
        if (b.action === "reject") {
          delivery = "changes_requested";
          assert.equal(b.note, "");
          feedback = b.note;
          return json({ success: true });
        }
        if (b.action === "accept") {
          delivery = "accepted";
          return json({ success: true });
        }
        if (b.action === "pay") {
          paid = 2;
          return json({ paid: true });
        }
      }
      if (
        p.endsWith("/accept") ||
        p.includes("/installments/") ||
        p.includes("/payments/")
      ) {
        checkoutRequests.push(p);
        return json({ error: "Invoice-managed checkout blocked" }, 409);
      }
      if (p.endsWith("/dashboard-link"))
        return json({
          dashboard_url: base.origin + "/client/dashboard/" + token,
        });
      if (p === `/api/client/dashboard/${token}`)
        return json({
          stage: "client",
          data: {
            project: {
              id,
              project_name: "Synthetic workflow",
              client_name: "Synthetic Reviewer",
              client_company: "Synthetic Practice",
              project_start_date: null,
              current_phase: 1,
            },
            assessment: null,
            scores: {
              categoryScores: {
                business_challenges: 0,
                tech_stack: 0,
                automation_needs: 0,
                ai_readiness: 0,
                budget_timeline: 0,
                decision_making: 0,
              },
              overallScore: 0,
              delta: { absolute: 0, percentage: 0 },
            },
            gapAnalysis: [],
            tasks: [],
            milestones: [],
            snapshots: [],
            documents: [],
            timeTracking: { total_seconds: 0, by_target: [] },
            accountSummary: null,
            nextMeeting: null,
          },
        });
      return json({ recommendations: [], data: [], tasks: [], milestones: [] });
    });
    await page.goto(base.origin + "/proposal/" + code + "?payment=success");
    await expect(page.getByRole("status")).toContainText("Review and sign");
    await hold("Unsigned documents; initial payment locked");
    await page
      .getByRole("button", { name: "Sign & Accept Proposal", exact: true })
      .click();
    await page.getByPlaceholder("Your full name").fill("Synthetic Reviewer");
    await page
      .getByRole("button", { name: "Sign & Accept", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Reload documents" }),
    ).toBeVisible();
    await hold("Stale document rejected");
    await page.getByRole("button", { name: "Reload documents" }).click();
    await page
      .getByRole("button", { name: "Sign & Accept Proposal", exact: true })
      .click();
    assert.equal(
      await page.getByPlaceholder("Your full name").inputValue(),
      "",
    );
    await page.getByPlaceholder("Your full name").fill("Synthetic Reviewer");
    await page
      .getByRole("button", { name: "Sign & Accept", exact: true })
      .click();
    await expect(page.getByPlaceholder("Your full name")).toBeHidden();
    assert.equal(proposalSigned, true);
    await hold("Proposal signature recorded");
    await page
      .getByRole("button", { name: "Sign Contract", exact: true })
      .click();
    await page.getByPlaceholder("Your full name").fill("Synthetic Reviewer");
    await page
      .getByRole("button", { name: "Sign Contract", exact: true })
      .click();
    const panel = page.getByRole("region", { name: "Milestone payments" });
    await expect(panel.getByRole("status")).toContainText(
      "Both documents are signed",
    );
    await panel.scrollIntoViewIfNeeded();
    const noCheckout = async () => {
      await expect(
        page.getByRole("button", {
          name: /Pay initial|Pay final|Proceed to payment|Pay in Full|monthly/i,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByText(/per month|monthly installments/i),
      ).toHaveCount(0);
      assert.deepEqual(checkoutRequests, []);
    };
    await noCheckout();
    await expect(panel.getByRole("status")).toContainText(
      "No deposit has been recorded",
    );
    await expect(
      page.getByRole("link", { name: "Open your client dashboard" }),
    ).toHaveCount(0);
    await page.screenshot({ path: `${out}/signed-unpaid-${width}.png` });
    await hold(
      "Both signatures; separate $498.50 invoice next step; no deposit or checkout",
    );
    await page.getByRole("button", { name: "Refresh payment status" }).click();
    await expect(panel.getByRole("status")).toContainText(
      "No deposit has been recorded",
    );
    await hold(
      "Refresh preserves truthful signed/unpaid state despite payment=success query",
    );
    // Later receipt states are synthetic API fixtures, independently tested against real local SQL.
    paid = 1;
    await page.getByRole("button", { name: "Refresh payment status" }).click();
    await expect(
      panel.getByRole("group", {
        name: "Initial $498.50 · Received",
        exact: true,
      }),
    ).toBeVisible();
    await hold(
      "Recorded initial receipt; existing dashboard becomes available",
    );
    await page
      .getByRole("link", { name: "Open your client dashboard" })
      .click();
    const dp = page.getByRole("region", { name: "Milestone payments" });
    await dp.scrollIntoViewIfNeeded();
    await expect(dp.getByRole("status")).toContainText(
      "due only after you accept delivery",
    );
    await noCheckout();
    await hold(
      "Existing dashboard; final invoice waits for delivery acceptance",
    );
    await page
      .getByRole("button", { name: "Delivery meets the agreed criteria" })
      .click();
    await expect(dp.getByRole("status")).toContainText(
      "Final payment has not been recorded",
    );
    await noCheckout();
    await page.screenshot({
      path: `${out}/accepted-final-unpaid-${width}.png`,
    });
    await hold(
      "Accepted delivery; separate final $498.50 invoice; still unpaid",
    );
    paid = 2;
    await page.getByRole("button", { name: "Refresh payment status" }).click();
    await expect(
      dp.getByRole("group", {
        name: "Initial $498.50 · Received",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dp.getByRole("group", { name: "Final $498.50 · Received", exact: true }),
    ).toBeVisible();
    await expect(dp.getByRole("status")).toContainText(
      "No further payment is due",
    );
    await noCheckout();
    await page.screenshot({ path: `${out}/completed-${width}.png` });
    await hold("Both manual receipts recorded; no further amount due");
    assert.equal(
      await dp.evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
    );
    assert.deepEqual(errors, []);
    const video = await page.video().path();
    await ctx.close();
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        video,
        "-c:v",
        "libx264",
        "-crf",
        "16",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        `${out}/invoice-milestones-${width}.mp4`,
      ],
      { stdio: "ignore" },
    );
    fs.writeFileSync(
      `${out}/receipt-${width}.json`,
      JSON.stringify({
        scope:
          "Actual localhost native proposal and dashboard; all APIs/provider/delivery evidence mocked",
        externalRequests: [],
        blockedExternal: blocked,
        errors,
        width,
        marks,
        finalState: state(),
        checkoutRequests,
        signedUnpaidAsserted: true,
        completionAsserted: true,
      }),
    );
    console.log("PASS", width);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
