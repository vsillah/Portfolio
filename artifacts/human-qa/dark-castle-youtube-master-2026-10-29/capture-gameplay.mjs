import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname);
const videoDir = path.join(root, 'source', 'gameplay-video');
const stillDir = path.join(root, 'source', 'gameplay-stills');
await fs.mkdir(videoDir, { recursive: true });
await fs.mkdir(stillDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: videoDir, size: { width: 1920, height: 1080 } },
  reducedMotion: 'no-preference'
});
const page = await context.newPage();
const video = page.video();

await page.goto('https://dark-castle-chess.vercel.app/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.keyboard.press('Escape');
const introContinue = page.getByRole('button', { name: 'Continue', exact: true });
if (await introContinue.isVisible()) await introContinue.click();
await page.waitForTimeout(1000);
if (await page.locator('#browserTour[open]').count()) await page.locator('#tourExit').click();
await page.getByRole('button', { name: 'Explore', exact: true }).waitFor({ state: 'visible' });
await page.getByRole('button', { name: 'Explore', exact: true }).click();
const exploreContinue = page.getByRole('button', { name: 'Continue', exact: true });
if (await exploreContinue.isVisible()) await exploreContinue.click();
await page.waitForTimeout(1200);

await page.screenshot({ path: path.join(stillDir, '01-explore-start.png') });
await page.locator('[aria-label="e2 White pawn"]').click();
await page.locator('[aria-label="e4"]').click();
await page.waitForTimeout(2800);
await page.screenshot({ path: path.join(stillDir, '02-explore-e4.png') });

await page.getByRole('button', { name: 'Try this position against the computer' }).click();
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(stillDir, '03-handoff.png') });

await page.getByRole('button', { name: 'Start game', exact: true }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(stillDir, '04-computer-response.png') });
await page.waitForTimeout(1800);

await context.close();
await browser.close();

const recorded = await video.path();
const output = path.join(root, 'source', 'dark-castle-live-gameplay.webm');
await fs.rename(recorded, output);
console.log(output);

