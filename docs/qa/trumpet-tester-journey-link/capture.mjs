import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

const revision = process.env.REVIEW_COMMIT;
if (!revision) throw new Error("Set REVIEW_COMMIT to the source commit");
const port = process.env.REVIEW_PORT ?? "3187";
const base = `http://localhost:${port}`;
const output = new URL(".", import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(page, width, theme) {
  await page.goto(`${base}/work/trumpet-trainer?rev=${revision}#interest`, { waitUntil: "networkidle" });
  await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
  const section = page.locator("#interest");
  await section.scrollIntoViewIfNeeded();
  const link = section.getByRole("link", { name: "See the tester experience" });
  if (await link.count() !== 1) throw new Error(`${width} ${theme}: tester CTA must appear once`);
  if (await link.getAttribute("href") !== "/work/trumpet-trainer/recruitment") throw new Error("CTA destination changed");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${width} ${theme}: horizontal overflow`);
  const bounds = await link.boundingBox();
  if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width) throw new Error(`${width} ${theme}: CTA clipped`);
  await link.focus();
  const focus = await link.evaluate((element) => ({
    active: document.activeElement === element,
    style: getComputedStyle(element).outlineStyle,
    width: getComputedStyle(element).outlineWidth,
  }));
  if (!focus.active || focus.style === "none" || focus.width === "0px") throw new Error(`${width} ${theme}: focus ring missing`);
  await section.screenshot({ path: join(output, `interest-${width}-${theme}.png`) });
  await link.press("Enter");
  await page.waitForURL("**/work/trumpet-trainer/recruitment");
  if (await page.locator('meta[name="robots"]').getAttribute("content") !== "noindex, nofollow") throw new Error("Recruitment noindex changed");
  if (await page.locator("form").count()) throw new Error("Unexpected recruitment form");
  const back = page.getByRole("link", { name: /Back to Trumpet Trainer/ });
  await back.click();
  await page.waitForURL(`${base}/work/trumpet-trainer`);
}

async function record(name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, recordVideo: { dir: output, size: { width, height } }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${base}/work/trumpet-trainer?rev=${revision}#interest`, { waitUntil: "networkidle" });
  await page.locator("#interest").scrollIntoViewIfNeeded();
  await pause(1300);
  const link = page.locator("#interest").getByRole("link", { name: "See the tester experience" });
  await link.focus();
  await pause(600);
  await link.click();
  await page.waitForURL("**/work/trumpet-trainer/recruitment");
  await pause(1600);
  await page.getByRole("link", { name: /Back to Trumpet Trainer/ }).click();
  await page.waitForURL(`${base}/work/trumpet-trainer`);
  await pause(1200);
  const source = await page.video().path();
  await context.close();
  await rename(source, join(output, `${name}.webm`));
  execFileSync("ffmpeg", ["-y", "-i", join(output, `${name}.webm`), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(output, `${name}.mp4`)], { stdio: "pipe" });
  await unlink(join(output, `${name}.webm`));
}

try {
  for (const width of [360, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    for (const theme of ["light", "dark"]) await check(page, width, theme);
    await page.close();
  }
  await record("desktop-journey", 1280, 800);
  await record("mobile-journey", 360, 800);
} finally {
  await browser.close();
}
