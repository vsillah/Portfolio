import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const revision = process.env.REVIEW_COMMIT;
if (!revision) throw new Error("Set REVIEW_COMMIT to the reviewed source commit");
const port = process.env.REVIEW_PORT ?? "3124";
const url = `http://localhost:${port}/work/trumpet-trainer/recruitment?rev=${revision}`;
const output = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch({ headless: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const trumpetTop = 43 / 800;
const trumpetBottom = 766 / 800;

async function checkTimeline(page, width, theme) {
  const timeline = page.getByRole("region", { name: "Example practice path" });
  const geometry = await timeline.evaluate((region, posterBounds) => {
    const layout = region.querySelector("[data-timeline-layout]");
    const stage = region.querySelector("[data-timeline-stage]");
    const spine = region.querySelector('[data-timeline-spine="base"]');
    const arrow = region.querySelector('[data-timeline-direction="down"]');
    if (!layout || !stage || !spine || !arrow) return null;
    const layoutRect = layout.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const path = spine.getAttribute("d")?.match(/^M [\d.-]+ ([\d.-]+) V ([\d.-]+)$/);
    const arrowY = [...(arrow.getAttribute("d") ?? "").matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map((match) => Number(match[1]));
    return { top: Number(path?.[1]), bottom: Number(path?.[2]),
      visibleTop: stageRect.top - layoutRect.top + stageRect.height * posterBounds.top,
      visibleBottom: stageRect.top - layoutRect.top + stageRect.height * posterBounds.bottom,
      arrowY, branches: region.querySelectorAll("[data-branch-step]").length,
      cards: [...region.querySelectorAll("button[data-side]")].map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }) };
  }, { top: trumpetTop, bottom: trumpetBottom });
  if (!geometry || geometry.branches !== 6 || geometry.cards.length !== 6) throw new Error(`${width} ${theme} timeline is incomplete`);
  if (!(geometry.top > geometry.visibleTop && geometry.bottom < geometry.visibleBottom)) throw new Error(`${width} ${theme} rail extends outside visible trumpet`);
  if (Math.max(...geometry.arrowY) >= geometry.visibleBottom) throw new Error(`${width} ${theme} rail arrow extends outside visible trumpet`);
  for (let index = 1; index < geometry.cards.length; index += 1) {
    if (geometry.cards[index].top < geometry.cards[index - 1].bottom - 1 &&
        geometry.cards[index].left < geometry.cards[index - 1].right &&
        geometry.cards[index].right > geometry.cards[index - 1].left) throw new Error(`${width} ${theme} timeline cards overlap`);
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`${width} ${theme} horizontal overflow`);
  await page.evaluate(() => scrollTo(0, 0));
  const clip = await timeline.boundingBox();
  if (!clip) throw new Error(`${width} ${theme} timeline is not visible`);
  const fullPage = await page.screenshot({ fullPage: true });
  await sharp(fullPage).extract({ left: Math.floor(clip.x), top: Math.floor(clip.y),
    width: Math.ceil(clip.width), height: Math.ceil(clip.height) })
    .png().toFile(join(output, `timeline-${width}-${theme}.png`));
  return timeline;
}

async function check(page, width, theme) {
  await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
  await pause(250);
  const endcap = page.getByRole("region", { name: "Ready to hear the next note?" });
  await endcap.scrollIntoViewIfNeeded();
  const primary = endcap.getByRole("link", { name: /Try Trumpet Trainer/ });
  const secondary = endcap.getByRole("link", { name: "See the product story" });
  if ((await primary.getAttribute("href")) !== "https://trumpet-trainer-zeta.vercel.app/") throw new Error("Primary destination changed");
  if ((await primary.getAttribute("target")) !== "_blank") throw new Error("Primary must open a new tab");
  if (!(await primary.getAttribute("rel"))?.includes("noopener noreferrer")) throw new Error("Primary link safety missing");
  if ((await secondary.getAttribute("href")) !== "/work/trumpet-trainer") throw new Error("Product story destination changed");
  const fill = await secondary.evaluate((element) => ({ button: getComputedStyle(element).backgroundColor, section: getComputedStyle(element.closest("section")).backgroundColor }));
  if (fill.button === "rgba(0, 0, 0, 0)") throw new Error(`${width} ${theme} product-story CTA fill is transparent`);
  if (theme === "light" && fill.button === fill.section) throw new Error(`${width} light CTA must have a light fill`);
  if (theme === "dark" && fill.button !== fill.section) throw new Error(`${width} dark CTA fill must match the navy endcap`);
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
  for (const theme of ["light", "dark"]) {
    await check(page, width, theme);
    await checkTimeline(page, width, theme);
  }
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
  for (const theme of ["light", "dark"]) {
    await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
    const timeline = await checkTimeline(page, width, theme);
    await timeline.scrollIntoViewIfNeeded();
    await pause(900);
    await page.locator('[data-timeline-stage]').scrollIntoViewIfNeeded();
    await pause(900);
    await check(page, width, theme);
    await pause(1500);
  }
  if (errors.length) throw new Error(errors.join("; "));
  const rawVideo = await page.video().path();
  await context.close();
  const destination = join(output, `${name}-endcap.mp4`);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", rawVideo, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", destination]);
  await rm(folder, { recursive: true, force: true });
  return destination;
}

try {
  for (const width of [360, 768, 1062, 1280]) await stills(width);
  const desktop = await record("desktop", 1280, 600);
  const mobile = await record("mobile", 360, 650);
  console.log(JSON.stringify({ revision, url, desktop, mobile }));
} finally {
  await browser.close();
}
