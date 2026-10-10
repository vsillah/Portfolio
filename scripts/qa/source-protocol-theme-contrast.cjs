const { chromium, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const base = (process.env.QA_BASE_URL || "http://127.0.0.1:4036").replace(
  /\/$/,
  "",
);
const routePath = "/admin/source-protocol";
const outputDir = path.resolve("docs/source-protocol/qa/theme-contrast");
const tempDir = path.resolve("test-results/source-protocol-theme-contrast");
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

const user = {
  id: "privacy-safe-source-protocol-admin",
  email: "qa@example.invalid",
  role: "authenticated",
  aud: "authenticated",
  user_metadata: {},
  app_metadata: {},
};
const session = {
  access_token: "privacy-safe-source-protocol-token",
  refresh_token: "privacy-safe-source-protocol-refresh",
  expires_at: 4102444800,
  expires_in: 3600,
  token_type: "bearer",
  user,
};

const overview = {
  available: true,
  generatedAt: "2026-10-10T12:00:00.000Z",
  summary: {
    creators: 2,
    portalAccounts: 3,
    works: 1,
    activeGrants: 1,
    retrievableChunks: 1,
    answerReceipts: 1,
    monthlyPayouts: 1,
    openDisputes: 1,
    heldPayouts: 1,
    accruedPayoutUsd: 14.75,
  },
  creators: [
    {
      id: "creator-001",
      display_name: "Fixture Author",
      protected_identity: false,
      categories: ["essay"],
      rights_holder_types: ["author"],
      verification_status: "verified",
      created_at: "2026-10-01T12:00:00.000Z",
    },
    {
      id: "creator-002",
      display_name: "Protected",
      protected_identity: true,
      categories: ["oral history"],
      rights_holder_types: ["community"],
      verification_status: "review",
      created_at: "2026-10-02T12:00:00.000Z",
    },
  ],
  portalAccounts: [
    {
      id: "portal-active",
      creator_id: "creator-001",
      user_id: "user-active",
      user_email: "active@example.invalid",
      creator_display_name: "Fixture Author",
      status: "active",
      can_view_earnings: true,
      can_view_receipts: true,
      created_at: "2026-10-03T12:00:00.000Z",
    },
    {
      id: "portal-pending",
      creator_id: "creator-002",
      user_id: "user-pending",
      user_email: "pending@example.invalid",
      creator_display_name: "Protected identity",
      status: "pending",
      can_view_earnings: false,
      can_view_receipts: true,
      created_at: "2026-10-04T12:00:00.000Z",
    },
    {
      id: "portal-revoked",
      creator_id: "creator-002",
      user_id: "user-revoked",
      user_email: "revoked@example.invalid",
      creator_display_name: "Protected identity",
      status: "revoked",
      can_view_earnings: false,
      can_view_receipts: false,
      created_at: "2026-10-05T12:00:00.000Z",
    },
  ],
  works: [
    {
      id: "work-001",
      title: "Fixture Work",
      rights_holder_type: "author",
      ban_status: "challenged",
      review_status: "approved",
      community_consent_required: false,
      chain_of_title_verified: true,
    },
  ],
  licenseGrants: [
    {
      id: "grant-001",
      status: "active",
      allowed_uses: ["RAG"],
      blocked_topics: ["biometrics"],
      expires_at: null,
    },
  ],
  chunks: [
    {
      id: "chunk-001",
      citation_label: "Fixture citation",
      source_location: "Page 4",
      is_retrievable: true,
      sensitive_topics: ["identity"],
      created_at: "2026-10-06T12:00:00.000Z",
    },
  ],
  receipts: [
    {
      id: "receipt-001",
      model_id: "fixture/model",
      generated_at: "2026-10-07T12:00:00.000Z",
      creator_pool_usd: 0.75,
      cited_chunk_ids: ["chunk-001"],
    },
  ],
  receiptChunks: [
    {
      answer_receipt_id: "receipt-001",
      citation_label: "Fixture citation",
      accrued_payout_usd: 0.75,
    },
  ],
  monthlyPayouts: [
    {
      id: "payout-001",
      creator_external_id: "creator-001",
      settlement_period: "2026-09",
      attributed_token_count: 920,
      accrued_payout_usd: 14.75,
      settlement_status: "held",
      hold_reason: "Open review",
    },
  ],
  disputes: [
    {
      id: "dispute-001",
      dispute_type: "attribution",
      status: "open",
      summary: "Fixture review remains open.",
    },
  ],
  modelReviews: [
    {
      id: "review-001",
      reviewed_at: "2026-10-08T12:00:00.000Z",
      incumbent_model_id: "fixture/v1",
      recommended_model_id: "fixture/v2",
      recommendation: "hold",
      quality_gate_passed: true,
      license_governance_gate_passed: false,
    },
  ],
  bannedBooksCorpus: {
    generatedAt: "2026-10-09T12:00:00.000Z",
    scope:
      "Synthetic challenged-title metadata for privacy-safe interface review.",
    licenseModel: "RAG only after an active rights grant.",
    sourceSpine: [
      { name: "Fixture challenged-title index", role: "Metadata evidence." },
    ],
    swarmAgents: [
      {
        key: "source-registry",
        name: "Amina, Source Registry Lead",
        lane: "Discovery evidence",
        output: "Evidence packet",
        boundary: "No full text",
        approvalGate: "Rights review",
      },
    ],
    outreachPackets: [
      {
        key: "author-permission",
        audience: "author",
        subject: "Fixture permission request",
        purpose: "Confirm RAG rights.",
        permissionAsk: ["Retrieval and citation"],
        followUpCadenceDays: [7, 21],
        approvalGate: "Human approval",
        guardrails: ["No external send"],
      },
    ],
    sourceIngestionQueue: {
      generatedAt: "2026-10-09T12:00:00.000Z",
      mode: "metadata_only_dry_run",
      policy: "Metadata and evidence only; no copyrighted full text.",
      sources: [],
      summary: {
        sourceCount: 2,
        candidateCount: 2,
        existingRecordMatches: 1,
        stageableCandidates: 0,
        evidenceReviewRequired: 1,
        blockedFullTextActions: 1,
      },
      candidates: [
        {
          sourceKey: "fixture-index",
          externalId: "fixture-title",
          canonicalTitle: "Fixture Challenged Title",
          authors: ["Fixture Author"],
          status: "existing_record",
          evidenceQuality: "confirmed",
          evidenceType: "challenge_list",
          existingRecordId: "fixture-record",
          stagedRecordDraft: null,
          nextAction: "Attach provenance.",
        },
        {
          sourceKey: "fixture-index",
          externalId: "held-title",
          canonicalTitle: "Held Candidate",
          authors: ["Fixture Writer"],
          status: "needs_evidence_review",
          evidenceQuality: "pending",
          evidenceType: "district_row",
          existingRecordId: null,
          stagedRecordDraft: null,
          nextAction: "Hold for evidence.",
        },
      ],
      blockedActions: ["Full-text ingestion"],
    },
    summary: {
      stagedRecords: 2,
      sourceSpineCount: 1,
      outreachPacketCount: 1,
      rightsReadyRecords: 1,
      outreachReadyRecords: 1,
      activeLicenseRecords: 0,
      retrievableRecords: 0,
      blockedRecords: 1,
    },
    records: [
      {
        id: "fixture-record",
        canonicalTitle: "Fixture Challenged Title",
        authors: ["Fixture Author"],
        banStatus: "challenged",
        jurisdictionContext: "Synthetic district evidence.",
        rightsholderCandidate: { name: "Fixture Author", confidence: "medium" },
        outreachStatus: "not_started",
        licenseStatus: "not_requested",
        ingestionStatus: "blocked",
        nextAction: "Review provenance.",
      },
    ],
    safeguards: [
      "No full text before license approval.",
      "Human review before outreach.",
    ],
  },
  bannedBooksEvidenceQa: {
    generatedAt: "2026-10-09T12:00:00.000Z",
    reviewer: "Timbuktu Scribe",
    sourceImportPath: "fixtures/source-protocol.json",
    dryRun: true,
    summary: {
      importRows: 2,
      decisions: 2,
      approvedQueueAppends: 1,
      needsMoreEvidence: 1,
      rejected: 0,
      blocked: 1,
      alreadyQueued: 0,
    },
    rows: [
      {
        externalId: "fixture-title",
        canonicalTitle: "Fixture Challenged Title",
        importStatus: "ready_for_qa",
        decision: "approved",
        approved: true,
        blocked: false,
        reason: "Metadata evidence approved.",
        queueAppendDraft: { externalId: "fixture-title" },
      },
      {
        externalId: "held-title",
        canonicalTitle: "Held Candidate",
        importStatus: "needs_evidence_review",
        decision: "needs_more_evidence",
        approved: false,
        blocked: true,
        reason: "Hold for evidence.",
        queueAppendDraft: null,
      },
    ],
    queueAppendDrafts: [{ externalId: "fixture-title" }],
    blockedActions: ["No writes were performed."],
  },
};

const emptyOverview = {
  ...overview,
  summary: {
    creators: 0,
    portalAccounts: 0,
    works: 0,
    activeGrants: 0,
    retrievableChunks: 0,
    answerReceipts: 0,
    monthlyPayouts: 0,
    openDisputes: 0,
    heldPayouts: 0,
    accruedPayoutUsd: 0,
  },
  creators: [],
  portalAccounts: [],
  works: [],
  licenseGrants: [],
  chunks: [],
  receipts: [],
  receiptChunks: [],
  monthlyPayouts: [],
  disputes: [],
  modelReviews: [],
  bannedBooksCorpus: undefined,
  bannedBooksEvidenceQa: undefined,
};

async function auditContrast(page) {
  return page.getByTestId("source-protocol-page").evaluate((root) => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return [0, 0, 0, 0];
      const parts = match[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const blend = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [0, 1, 2]
        .map(
          (index) =>
            (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) /
            alpha,
        )
        .concat(alpha);
    };
    const luminance = (rgb) => {
      const linear = rgb.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const contrast = (one, two) => {
      const [high, low] = [luminance(one), luminance(two)].sort(
        (a, b) => b - a,
      );
      return (high + 0.05) / (low + 0.05);
    };
    const background = (element) => {
      const ancestors = [];
      let current = element;
      while (current) {
        ancestors.unshift(current);
        current = current.parentElement;
      }
      return ancestors.reduce(
        (result, ancestor) =>
          blend(parse(getComputedStyle(ancestor).backgroundColor), result),
        [255, 255, 255, 1],
      );
    };
    const candidates = Array.from(
      root.querySelectorAll(
        "h1,h2,h3,p,span,button,a,label,dt,dd,th,td,option,div",
      ),
    );
    const samples = [];
    for (const element of candidates) {
      const directText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!directText) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        rect.width === 0 ||
        rect.height === 0
      )
        continue;
      const disabled = Boolean(
        element.closest('[disabled],[aria-disabled="true"]'),
      );
      const bg = background(element);
      const fg = blend(parse(style.color), bg);
      const size = Number.parseFloat(style.fontSize);
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const ratio = contrast(fg, bg);
      samples.push({
        text: directText.slice(0, 100),
        ratio: Number(ratio.toFixed(2)),
        required: large ? 3 : 4.5,
        disabled,
        color: style.color,
        background: `rgb(${bg.slice(0, 3).map(Math.round).join(", ")})`,
      });
    }
    const audited = samples.filter((sample) => !sample.disabled);
    return {
      samples: audited.length,
      disabled_samples: samples.length - audited.length,
      minimum_ratio: Math.min(...audited.map((sample) => sample.ratio)),
      failures: audited.filter((sample) => sample.ratio < sample.required),
      lowest: audited.sort((a, b) => a.ratio - b.ratio).slice(0, 12),
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const clips = [];
  const scenarios = [1440, 768, 390].flatMap((width) =>
    ["light", "dark", "system"].map((theme) => ({ width, theme })),
  );

  for (const { width, theme } of scenarios) {
    const height = width === 390 ? 844 : 1000;
    const writes = [];
    const externalRequests = [];
    const pageErrors = [];
    let responseMode = "full";
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme === "light" ? "light" : "dark",
      recordVideo: { dir: tempDir, size: { width, height } },
      serviceWorkers: "block",
      extraHTTPHeaders: process.env.VERCEL_OIDC_TOKEN
        ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
        : undefined,
    });
    await context.addInitScript(
      ({ session, theme }) => {
        localStorage.setItem("theme", theme);
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function getItem(key) {
          if (/^sb-.*-auth-token$/.test(key)) return JSON.stringify(session);
          return originalGetItem.call(this, key);
        };
      },
      { session, theme },
    );
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const json = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (
        url.hostname === "va.vercel-scripts.com" ||
        url.hostname === "vercel.live"
      )
        return route.abort();
      if (
        method !== "GET" &&
        (url.origin === new URL(base).origin || /supabase/i.test(url.hostname))
      ) {
        writes.push(`${method} ${url.pathname}`);
        return json({ error: "Read-only QA blocked this request." }, 405);
      }
      if (url.pathname === "/auth/v1/user") return json(user);
      if (url.pathname === "/rest/v1/user_profiles")
        return json([{ id: user.id, email: user.email, role: "admin" }]);
      if (url.pathname === "/api/user/profile")
        return json({
          profile: { id: user.id, email: user.email, role: "admin" },
        });
      if (url.pathname === "/api/admin/source-protocol/overview") {
        if (responseMode === "error")
          return json({ error: "Privacy-safe fixture failure." }, 503);
        return json(responseMode === "empty" ? emptyOverview : overview);
      }
      if (
        url.origin === new URL(base).origin &&
        url.pathname.startsWith("/api/")
      )
        return json({});
      if (url.origin !== new URL(base).origin) {
        externalRequests.push(`${method} ${url.origin}${url.pathname}`);
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${base}${routePath}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`${routePath}$`), {
      timeout: 90000,
    });
    await expect(
      page.getByRole("heading", { name: "Source Protocol" }),
    ).toBeVisible({ timeout: 90000 });
    await expect(
      page.getByRole("heading", { name: "Banned Books Rights-Ready Corpus" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("theme")))
      .toBe(theme);
    if (theme === "light")
      await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    else await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    await page.evaluate(
      ({ width, theme }) => {
        const banner = document.createElement("div");
        banner.setAttribute("data-testid", "qa-evidence-banner");
        banner.textContent = `Source Protocol contrast QA · ${width}px · ${theme}`;
        Object.assign(banner.style, {
          position: "fixed",
          left: "12px",
          top: "72px",
          zIndex: "9999",
          padding: "8px 12px",
          borderRadius: "8px",
          background: "#07101c",
          color: "#ffffff",
          border: "1px solid #d4af37",
          font: "600 12px system-ui",
        });
        document.body.appendChild(banner);
      },
      { width, theme },
    );

    const pageRoot = page.getByTestId("source-protocol-page");
    const scrollAdminTop = async () => {
      await page
        .locator("#admin-main")
        .evaluate((element) => element.scrollTo(0, 0));
      await page.waitForTimeout(250);
    };
    const hasHorizontalOverflow = () =>
      page
        .locator("#admin-main")
        .evaluate(
          (element) =>
            element.scrollWidth > element.clientWidth ||
            document.documentElement.scrollWidth > innerWidth,
        );
    const status = pageRoot.locator('[data-contrast-audit="protocol-status"]');
    await expect(status).toContainText("Review needed");
    const activeTab = page.getByRole("button", { name: /Banned Books/i });
    await expect(activeTab).toHaveAttribute("aria-pressed", "true");
    await activeTab.focus();
    await expect(activeTab).toBeFocused();
    const mainContrast = await auditContrast(page);
    assert.deepEqual(
      mainContrast.failures,
      [],
      `${theme} ${width}px contrast failures: ${JSON.stringify(mainContrast.failures)}`,
    );
    assert.equal(
      await hasHorizontalOverflow(),
      false,
      `${theme} ${width}px main surface overflow`,
    );
    await scrollAdminTop();
    await page.screenshot({
      path: path.join(outputDir, `${width}-${theme}-overview.png`),
    });

    const tabNames = [
      "Portal Access",
      "Creators",
      "Works",
      "Grants",
      "Chunks",
      "Receipts",
      "Payouts",
      "Model Reviews",
    ];
    let portalContrast;
    for (const name of tabNames) {
      const button = page
        .getByRole("button", { name: new RegExp(name, "i") })
        .first();
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      assert.equal(
        await hasHorizontalOverflow(),
        false,
        `${theme} ${width}px ${name} overflow`,
      );
      if (name === "Portal Access") {
        await expect(page.getByText("active@example.invalid")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Save portal link" }),
        ).toBeDisabled();
        const saveButtonColors = await page
          .getByRole("button", { name: "Save portal link" })
          .evaluate((element) => {
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, color: style.color };
          });
        await page
          .getByTestId("source-protocol-portal-form")
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(outputDir, `${width}-${theme}-portal.png`),
        });
        await page.getByRole("button", { name: "Revoke" }).first().hover();
        portalContrast = await auditContrast(page);
        assert.deepEqual(
          portalContrast.failures,
          [],
          `${theme} ${width}px portal contrast failures: ${JSON.stringify(portalContrast.failures)}`,
        );
        await page.screenshot({
          path: path.join(outputDir, `${width}-${theme}-portal-statuses.png`),
        });
        portalContrast.disabled_primary_colors = saveButtonColors;
      }
    }

    let emptyStateChecked = false;
    let errorStateChecked = false;
    if (
      (width === 1440 && theme === "light") ||
      (width === 390 && theme === "dark")
    ) {
      responseMode = "empty";
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText("No banned-books corpus projection is available."),
      ).toBeVisible();
      await page.getByRole("button", { name: /Portal Access/i }).click();
      await expect(page.getByText("No portal accounts yet.")).toBeVisible();
      assert.deepEqual((await auditContrast(page)).failures, []);
      await page.screenshot({
        path: path.join(outputDir, `${width}-${theme}-empty.png`),
        fullPage: true,
      });
      emptyStateChecked = true;

      responseMode = "error";
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText("Failed to load source protocol overview"),
      ).toBeVisible();
      assert.deepEqual((await auditContrast(page)).failures, []);
      await page.screenshot({
        path: path.join(outputDir, `${width}-${theme}-error.png`),
        fullPage: true,
      });
      errorStateChecked = true;
    }

    assert.equal(
      writes.length,
      0,
      `${theme} ${width}px attempted writes: ${writes.join(", ")}`,
    );
    assert.equal(
      pageErrors.length,
      0,
      `${theme} ${width}px page errors: ${pageErrors.join(", ")}`,
    );
    const legacyClasses = await pageRoot.evaluate((root) =>
      Array.from(root.querySelectorAll("[class]"))
        .map((element) => element.getAttribute("class") || "")
        .filter((className) =>
          /(?:border|bg|divide)-silicon-slate|(?<!dark:)text-(?:amber|emerald|red)-(?:200|300)\b/.test(
            className,
          ),
        ),
    );
    assert.deepEqual(
      legacyClasses,
      [],
      `${theme} ${width}px fixed dark classes: ${legacyClasses.join(", ")}`,
    );

    results.push({
      route: `${base}${routePath}`,
      width,
      height,
      theme_preference: theme,
      effective_theme: theme === "light" ? "light" : "dark",
      tabs_checked: ["Banned Books", ...tabNames],
      states_checked: [
        "selected",
        "focus",
        "hover",
        "disabled",
        "active badge",
        "pending badge",
        "revoked badge",
      ],
      empty_state_checked: emptyStateChecked,
      error_state_checked: errorStateChecked,
      contrast: { overview: mainContrast, portal: portalContrast },
      horizontal_overflow: false,
      writes: [],
      external_requests_blocked: externalRequests,
      page_errors: [],
    });

    const video = page.video();
    await context.close();
    const raw = await video.path();
    const clip = path.join(tempDir, `${width}-${theme}.mp4`);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        raw,
        "-vf",
        "scale=1440:1000:force_original_aspect_ratio=decrease,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:color=0x07101c",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        clip,
      ],
      { stdio: "ignore" },
    );
    fs.unlinkSync(raw);
    clips.push(clip);
  }

  await browser.close();
  const concatFile = path.join(tempDir, "clips.txt");
  fs.writeFileSync(
    concatFile,
    clips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join("\n") +
      "\n",
  );
  const finalVideo = path.join(
    outputDir,
    "source-protocol-theme-contrast-walkthrough.mp4",
  );
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      finalVideo,
    ],
    { stdio: "ignore" },
  );
  fs.writeFileSync(
    path.join(outputDir, "results.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        finalVideo,
        scenarios: results.length,
        minimum_contrast_ratio: Math.min(
          ...results.flatMap((result) => [
            result.contrast.overview.minimum_ratio,
            result.contrast.portal?.minimum_ratio ?? 99,
          ]),
        ),
        writes: 0,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
