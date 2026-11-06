import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const root = new URL(".", import.meta.url).pathname;
const revision = process.env.REVIEW_COMMIT;
if (!revision) throw new Error("Set REVIEW_COMMIT to the reviewed source commit");
const port = process.env.REVIEW_PORT ?? "3117";
const url = `http://localhost:${port}/work/trumpet-trainer/recruitment?rev=${revision}`;
const browser = await chromium.launch({ headless: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function dragSlide(page, dx, dy = 2) {
  const slide = page.locator("#trumpet-social-slide");
  await slide.scrollIntoViewIfNeeded();
  const bounds = await slide.boundingBox();
  if (!bounds) throw new Error("Carousel slide is missing");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

async function record(name, width, height) {
  const folder = await mkdtemp(join(tmpdir(), `trumpet-${name}-`));
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", recordVideo: { dir: folder, size: { width, height } } });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  if ((await page.locator('meta[name="robots"]').getAttribute("content")) !== "noindex, nofollow") throw new Error("Noindex missing");
  if (await page.locator("form").count()) throw new Error("Unexpected form");
  if (await page.getByText("Gameplay preview").count()) throw new Error("Redundant media badge returned");
  if (await page.getByText(/A concept preview for the adults supporting a new player/).count()) throw new Error("Redundant hero callout returned");
  if (await page.getByText(/An example path, not a fixed schedule or a promise of progress/).count()) throw new Error("Redundant timeline subtitle returned");
  if (/tester interest|earlier invitation|recruitment/i.test(await page.locator("main").textContent())) throw new Error("Recruitment copy on the page");
  await pause(2000);
  await page.getByRole("heading", { name: "Inside Trumpet Trainer" }).scrollIntoViewIfNeeded();
  await pause(700);
  await page.locator("video").evaluate(async (video) => { await video.play().catch(() => {}); });
  await pause(1400);
  await page.locator("video").evaluate((video) => video.pause());
  const carousel = page.getByRole("region", { name: "Trumpet Trainer practice screens" });
  await carousel.scrollIntoViewIfNeeded();
  await page.evaluate(() => { const element = document.querySelector('[aria-label="Trumpet Trainer practice screens"]'); if (element) scrollTo(0, scrollY + element.getBoundingClientRect().top - 100); });
  await dragSlide(page, -95);
  if (await carousel.getByRole("status").textContent() !== "Screen 2 of 7") throw new Error("Carousel swipe did not advance");
  await pause(650);
  for (let index = 3; index <= 7; index++) { await carousel.getByRole("button", { name: "Next screen" }).click(); await pause(550); }
  await page.waitForFunction(() => { const image = document.querySelector('img[alt^="Trumpet Trainer screen 7"]'); return image?.complete && image.naturalWidth > 0; });
  await pause(700);
  await dragSlide(page, 95);
  if (await carousel.getByRole("status").textContent() !== "Screen 6 of 7") throw new Error("Carousel swipe did not reverse");
  await pause(500);
  await carousel.getByRole("tab", { name: "Show screen 7" }).click();
  const personas = page.getByRole("group", { name: "Choose an example" });
  await personas.scrollIntoViewIfNeeded();
  await pause(700);
  for (let index = 0; index < 3; index++) { await page.getByRole("button", { name: "Next example" }).click(); await pause(700); }
  const timeline = page.getByRole("region", { name: "Example practice path" });
  await timeline.scrollIntoViewIfNeeded();
  await pause(900);
  for (let index = 1; index <= 6; index++) {
    await timeline.getByRole("button", { name: new RegExp(`^Step ${index},`) }).click();
    if (await timeline.locator("[data-visual-step]").getAttribute("data-visual-step") !== String(index)) throw new Error(`Milestone ${index} visual missing`);
    await timeline.locator("[data-visual-step]").scrollIntoViewIfNeeded();
    await pause(650);
  }
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
    if (await page.getByText("Gameplay preview").count()) throw new Error("Redundant media badge returned");
    if (await page.getByText(/A concept preview for the adults supporting a new player/).count()) throw new Error("Redundant hero callout returned");
    if (await page.getByText(/An example path, not a fixed schedule or a promise of progress/).count()) throw new Error("Redundant timeline subtitle returned");
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(root, `hero-${width}-${theme}.png`) });
    const navigation = page.locator("nav").first();
    await navigation.evaluate((element) => { element.style.display = "none"; });
    const timeline = page.getByRole("region", { name: "Example practice path" });
    await timeline.getByRole("button", { name: /^Step 1,/ }).click();
    await page.locator('section[aria-labelledby="plan"]').screenshot({ path: join(root, `practice-${width}-${theme}.png`) });
    await timeline.screenshot({ path: join(root, `timeline-${width}-${theme}.png`) });
    if ((width === 360 && theme === "light") || (width === 1280 && theme === "dark")) {
      for (let index = 1; index <= 6; index++) {
        await timeline.getByRole("button", { name: new RegExp(`^Step ${index},`) }).click();
        await timeline.locator("[data-visual-step]").screenshot({ path: join(root, `vignette-${width}-${theme}-${index}.png`) });
      }
    }
    if (width === 360 || width === 1280) await page.getByRole("heading", { level: 1 }).screenshot({ path: join(root, `headline-${width}-${theme}.png`) });
    await page.getByRole("tab", { name: "Show screen 7" }).click();
    await page.waitForFunction(() => { const image = document.querySelector('img[alt^="Trumpet Trainer screen 7"]'); return image?.complete && image.naturalWidth > 0; });
    await page.locator("#trumpet-social-slide").screenshot({ path: join(root, `song-builder-${width}-${theme}.png`) });
    await page.getByRole("tab", { name: "Show screen 3" }).click();
    const carouselStatus = page.getByRole("region", { name: "Trumpet Trainer practice screens" }).getByRole("status");
    await dragSlide(page, -95);
    if (await carouselStatus.textContent() !== "Screen 4 of 7") throw new Error(`${width} ${theme} swipe forward failed`);
    await dragSlide(page, 95);
    if (await carouselStatus.textContent() !== "Screen 3 of 7") throw new Error(`${width} ${theme} swipe back failed`);
    await dragSlide(page, -35);
    if (await carouselStatus.textContent() !== "Screen 3 of 7") throw new Error(`${width} ${theme} swipe snap-back failed`);
    await navigation.evaluate((element) => { element.style.display = ""; });
  }
  await page.close();
}

try {
  for (const width of [360, 768, 1280]) await stills(width);
  if (process.env.REVIEW_STILLS_ONLY === "1") console.log(JSON.stringify({ revision, url, stillsOnly: true }));
  else {
    const desktop = await record("desktop", 1280, 800);
    const mobile = await record("mobile", 360, 780);
    console.log(JSON.stringify({ revision, url, desktop, mobile }));
  }
} finally { await browser.close(); }
