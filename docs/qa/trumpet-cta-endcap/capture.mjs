import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const revision = process.env.REVIEW_COMMIT;
if (!revision) throw new Error("Set REVIEW_COMMIT to the reviewed source commit");
const port = process.env.REVIEW_PORT ?? "3124";
const url = `http://localhost:${port}/work/trumpet-trainer/recruitment?rev=${revision}`;
const output = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch({ headless: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(page, width, theme) {
  await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
  const endcap = page.getByRole("region", { name: "Ready to hear the next note?" });
  await endcap.scrollIntoViewIfNeeded();
  const primary = endcap.getByRole("link", { name: /Try Trumpet Trainer/ });
  const secondary = endcap.getByRole("link", { name: "See the product story" });
  if ((await primary.getAttribute("href")) !== "https://trumpet-trainer-zeta.vercel.app/") throw new Error("Primary destination changed");
  if ((await primary.getAttribute("target")) !== "_blank") throw new Error("Primary must open a new tab");
  if (!(await primary.getAttribute("rel"))?.includes("noopener noreferrer")) throw new Error("Primary link safety missing");
  if ((await secondary.getAttribute("href")) !== "/work/trumpet-trainer") throw new Error("Product story destination changed");
  if ((await page.locator('meta[name="robots"]').getAttribute("content")) !== "noindex, nofollow") throw new Error("Noindex missing");
  if (await page.locator("form").count()) throw new Error("Unexpected form");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${width} ${theme} horizontal overflow`);
  await primary.focus();
  if (!(await primary.evaluate((node) => document.activeElement === node))) throw new Error("Primary link cannot receive focus");
  await page.keyboard.press("Tab");
  if (!(await secondary.evaluate((node) => document.activeElement === node))) throw new Error("Keyboard cannot reach secondary link");
  await endcap.screenshot({ path: join(output, `endcap-${width}-${theme}.png`) });
  return { endcap, primary, secondary };
}

async function stills(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  for (const theme of ["light", "dark"]) await check(page, width, theme);
  if (errors.length) throw new Error(errors.join("; "));
  await page.close();
}

async function record(name, width, height) {
  const folder = await mkdtemp(join(tmpdir(), `trumpet-cta-${name}-`));
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", recordVideo: { dir: folder, size: { width, height } } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await check(page, width, "light");
  await pause(1800);
  await check(page, width, "dark");
  await pause(1800);
  if (errors.length) throw new Error(errors.join("; "));
  const rawVideo = await page.video().path();
  await context.close();
  const destination = join(output, `${name}-endcap.mp4`);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", rawVideo, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", destination]);
  await rm(folder, { recursive: true, force: true });
  return destination;
}

try {
  for (const width of [360, 768, 1280]) await stills(width);
  const desktop = await record("desktop", 1280, 600);
  const mobile = await record("mobile", 360, 650);
  console.log(JSON.stringify({ revision, url, desktop, mobile }));
} finally {
  await browser.close();
}
