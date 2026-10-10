const { chromium, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const base = (process.env.QA_BASE_URL || "").replace(/\/$/, "");
const authStatePath = process.env.QA_AUTH_STATE || "";
const routePath = "/admin/source-protocol";
const outputDir = path.resolve(
  "docs/source-protocol/qa/real-route-availability",
);
const tempDir = path.resolve("test-results/source-protocol-real-route");

if (!base) throw new Error("QA_BASE_URL is required.");
if (!authStatePath || !fs.existsSync(authStatePath))
  throw new Error(
    "QA_AUTH_STATE must point to an existing gitignored Playwright storage-state file.",
  );
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

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
      const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
      const ratio = contrast(fg, bg);
      samples.push({
        text: directText.slice(0, 100),
        ratio: Number(ratio.toFixed(2)),
        required,
        disabled,
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
    const pageErrors = [];
    const responseFailures = [];
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme === "light" ? "light" : "dark",
      storageState: authStatePath,
      recordVideo: { dir: tempDir, size: { width, height } },
      serviceWorkers: "block",
      extraHTTPHeaders: process.env.VERCEL_OIDC_TOKEN
        ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
        : process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? {
              "x-vercel-protection-bypass":
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
              "x-vercel-set-bypass-cookie": "true",
            }
          : undefined,
    });
    await context.addInitScript(
      (preference) => localStorage.setItem("theme", preference),
      theme,
    );
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        url.hostname === "va.vercel-scripts.com" ||
        url.hostname === "vercel.live"
      )
        return route.abort();
      if (request.method() !== "GET" && url.origin === new URL(base).origin) {
        writes.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({
          status: 405,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Read-only real-route QA blocked this request.",
          }),
        });
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400)
        responseFailures.push(
          `${response.status()} ${new URL(response.url()).pathname}`,
        );
    });
    const overviewResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        "/api/admin/source-protocol/overview",
    );
    await page.goto(`${base}${routePath}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`${routePath}$`), {
      timeout: 90000,
    });
    const overviewResponse = await overviewResponsePromise;
    assert.equal(
      overviewResponse.status(),
      200,
      `Overview returned ${overviewResponse.status()}`,
    );
    const overviewBody = await overviewResponse.json();
    assert.equal(
      overviewBody.available,
      true,
      "Real Source Protocol schema/data path is unavailable",
    );
    assert.ok(
      overviewBody.summary && typeof overviewBody.summary === "object",
      "Real overview did not return summary data",
    );

    await expect(
      page.getByRole("heading", { name: "Source Protocol" }),
    ).toBeVisible({ timeout: 90000 });
    await expect(
      page.getByText("Failed to load source protocol overview"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Banned Books Rights-Ready Corpus" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("theme")))
      .toBe(theme);
    if (theme === "light")
      await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    else await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    const optionalProjectionAvailable = Boolean(
      overviewBody.bannedBooksEvidenceQa,
    );
    const optionalProjectionUnavailable = Boolean(
      overviewBody.bannedBooksEvidenceQaUnavailable,
    );
    assert.ok(
      optionalProjectionAvailable || optionalProjectionUnavailable,
      "Optional Evidence QA projection returned neither data nor a fail-closed status",
    );
    if (optionalProjectionUnavailable) {
      await expect(
        page.getByTestId("banned-books-evidence-unavailable"),
      ).toBeVisible();
    } else {
      await expect(page.getByText("Evidence QA approval queue")).toBeVisible();
    }

    await page.evaluate(
      ({ width, theme }) => {
        const banner = document.createElement("div");
        banner.textContent = `REAL ROUTE · ${width}px · ${theme}`;
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

    const contrast = await auditContrast(page);
    assert.deepEqual(
      contrast.failures,
      [],
      `${theme} ${width}px contrast failures: ${JSON.stringify(contrast.failures)}`,
    );
    const overflow = await page
      .locator("#admin-main")
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    assert.equal(overflow, false, `${theme} ${width}px horizontal overflow`);
    assert.deepEqual(
      writes,
      [],
      `${theme} ${width}px attempted same-origin writes: ${writes.join(", ")}`,
    );
    assert.deepEqual(
      pageErrors,
      [],
      `${theme} ${width}px page errors: ${pageErrors.join(", ")}`,
    );
    assert.deepEqual(
      responseFailures,
      [],
      `${theme} ${width}px HTTP failures: ${responseFailures.join(", ")}`,
    );

    await page
      .locator("#admin-main")
      .evaluate((element) => element.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(outputDir, `${width}-${theme}-real-route.png`),
    });
    results.push({
      route: `${base}${routePath}`,
      width,
      height,
      theme_preference: theme,
      effective_theme: theme === "light" ? "light" : "dark",
      overview_status: overviewResponse.status(),
      available: overviewBody.available,
      live_summary_present: true,
      optional_evidence_projection: optionalProjectionAvailable
        ? "available"
        : "fail_closed_unavailable",
      minimum_contrast_ratio: contrast.minimum_ratio,
      contrast_failures: 0,
      horizontal_overflow: false,
      same_origin_writes: 0,
      page_errors: 0,
      http_failures: 0,
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
    "source-protocol-real-route-walkthrough.mp4",
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
        real_overview_responses: results.filter(
          (result) => result.overview_status === 200,
        ).length,
        minimum_contrast_ratio: Math.min(
          ...results.map((result) => result.minimum_contrast_ratio),
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
