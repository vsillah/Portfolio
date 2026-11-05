import { chromium } from "playwright-core";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

const origin = process.env.QA_ORIGIN || "http://localhost:3217";
const output = path.resolve("docs/qa/trumpet-trainer-launch");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});

try {
  for (const width of [360, 768, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      recordVideo:
        width === 1280 || width === 360
          ? { dir: output, size: { width, height: 900 } }
          : undefined,
    });
    const page = await context.newPage();
    const response = await page.goto(
      `${origin}/work/trumpet-trainer?qa=portfolio-launch`,
      { waitUntil: "networkidle" },
    );
    if (response?.status() !== 200)
      throw new Error(`${width}px route returned ${response?.status()}`);
    await page
      .getByRole("heading", { name: /Make the first few minutes/i })
      .waitFor();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      )
    )
      throw new Error(`${width}px horizontal overflow`);
    await page.screenshot({
      path: path.join(output, `route-${width}.png`),
      fullPage: true,
    });
    if (width !== 768) {
      await page.waitForTimeout(900);
      for (const anchor of ["#how-it-works", "#interest"]) {
        await page.locator(anchor).scrollIntoViewIfNeeded();
        await page.waitForTimeout(900);
      }
    }
    await page.getByRole("link", { name: "Explore tester interest" }).click();
    if (!page.url().endsWith("#interest"))
      throw new Error("Hero CTA did not reach form");
    await page.getByLabel("Your name").fill("Adult Tester");
    await page.getByLabel("Your email").fill("teacher@schools.org");
    await page.getByLabel("Your role").selectOption("Band educator");
    await page
      .getByLabel("Approximate student experience")
      .selectOption("Just starting");
    await page
      .getByLabel("What interests you about testing?")
      .fill("I teach at a school and want to test short practice routines.");
    await page.getByRole("button", { name: "Prepare email draft" }).click();
    if (await page.getByRole("link", { name: /Open email draft/i }).count())
      throw new Error("Draft prepared without adult confirmation");
    await page
      .getByRole("checkbox", { name: /I confirm I am an adult/i })
      .check();
    for (const notes of [
      "School: Lincoln Middle",
      "Child's name: Example",
      "Age: 10",
    ]) {
      await page.getByLabel("Optional notes").fill(notes);
      await page.getByRole("button", { name: "Prepare email draft" }).click();
      await page.getByText(/Please remove child identifiers/i).waitFor();
      if (await page.getByRole("link", { name: /Open email draft/i }).count())
        throw new Error(`Child detail was accepted: ${notes}`);
      if (notes.startsWith("School:") && width !== 768)
        await page.waitForTimeout(800);
    }
    if (width !== 768) await page.waitForTimeout(900);
    await page
      .getByLabel("Optional notes")
      .fill("I can offer usability feedback.");
    await page.getByRole("button", { name: "Prepare email draft" }).click();
    await page.getByText(/Nothing has been sent by this website/i).waitFor();
    if (width !== 768) await page.waitForTimeout(1200);
    const draft = await page
      .getByRole("link", { name: /Open email draft/i })
      .getAttribute("href");
    if (!draft?.startsWith("mailto:vambah@amadutown.com?"))
      throw new Error("Email draft missing");
    if (
      !draft.includes("teacher%40schools.org") ||
      !draft.includes("I%20teach%20at%20a%20school")
    )
      throw new Error("Adult school context was not preserved in draft");
    if (width === 1280) {
      await page
        .getByRole("link", { name: "See the practice concept" })
        .click();
      await page
        .getByRole("link", { name: /Review the interest form/i })
        .click();
      await page.getByRole("link", { name: /Back to Work/i }).click();
      await page.getByRole("link", { name: /Trumpet Trainer/i }).waitFor();
    }
    const video = width === 1280 || width === 360 ? page.video() : null;
    await context.close();
    if (video)
      await rename(
        await video.path(),
        path.join(output, `walkthrough-${width}.webm`),
      );
  }
} finally {
  await browser.close();
}
