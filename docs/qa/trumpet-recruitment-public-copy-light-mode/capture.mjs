import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const root = new URL(".", import.meta.url).pathname;
const revision = process.env.REVIEW_COMMIT;
if (!revision) throw new Error("Set REVIEW_COMMIT to the reviewed source commit");
const url = `http://localhost:3117/work/trumpet-trainer/recruitment?rev=${revision}`;
const browser = await chromium.launch({ headless: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function record(name, width, height) {
  const folder = await mkdtemp(join(tmpdir(), `trumpet-${name}-`));
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", recordVideo: { dir: folder, size: { width, height } } });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  if ((await page.locator('meta[name="robots"]').getAttribute("content")) !== "noindex, nofollow") throw new Error("Noindex missing");
  if (await page.locator("form").count()) throw new Error("Unexpected form");
  await pause(1100);
  await page.getByRole("heading", { name: "Inside Trumpet Trainer" }).scrollIntoViewIfNeeded();
  await pause(700);
  await page.locator("video").evaluate(async (video) => { await video.play().catch(() => {}); });
  await pause(1400);
  await page.locator("video").evaluate((video) => video.pause());
  const carousel = page.getByRole("region", { name: "Trumpet Trainer practice screens" });
  await carousel.scrollIntoViewIfNeeded();
  for (let index = 2; index <= 7; index++) { await carousel.getByRole("button", { name: "Next screen" }).click(); await pause(550); }
  const personas = page.getByRole("group", { name: "Choose an example" });
  await personas.scrollIntoViewIfNeeded();
  await pause(700);
  for (let index = 0; index < 3; index++) { await page.getByRole("button", { name: "Next example" }).click(); await pause(700); }
  const timeline = page.getByRole("region", { name: "Example practice path" });
  await timeline.scrollIntoViewIfNeeded();
  await pause(900);
  for (const index of [3, 6]) { await timeline.getByRole("button", { name: new RegExp(`^Step ${index},`) }).click(); await pause(850); }
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await pause(1000);
  await timeline.getByRole("button", { name: /^Step 1,/ }).click();
  await pause(950);
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
  await pause(1200);
  if (failures.length) throw new Error(failures.join("; "));
  const rawVideo = await page.video().path();
  await context.close();
  const output = join(root, `${name}-walkthrough.mp4`);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", rawVideo, "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", output]);
  await rm(folder, { recursive: true, force: true });
  return output;
}

async function stills(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "networkidle" });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
    await pause(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow) throw new Error(`${width} ${theme} overflow ${overflow}`);
    await page.getByRole("region", { name: "Example practice path" }).screenshot({ path: join(root, `timeline-${width}-${theme}.png`) });
    if (width === 360 || width === 1280) await page.getByRole("heading", { level: 1 }).screenshot({ path: join(root, `headline-${width}-${theme}.png`) });
  }
  await page.close();
}

try {
  for (const width of [360, 768, 1280]) await stills(width);
  const desktop = await record("desktop", 1280, 800);
  const mobile = await record("mobile", 360, 780);
  console.log(JSON.stringify({ revision, url, desktop, mobile }));
} finally { await browser.close(); }
